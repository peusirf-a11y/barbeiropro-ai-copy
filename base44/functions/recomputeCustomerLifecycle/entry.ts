// Recalcula lifecycle_status dos clientes da empresa.
//
// Modos:
//   - { customer_id }         → recalcula apenas esse cliente
//   - { company_id }          → recalcula todos os clientes da empresa
//   - {}                      → recalcula TODA a base (uso pelo job diário; admin only)
//
// Para cada cliente:
//   1) Lê settings (Company.crm_settings)
//   2) Busca atendimentos concluídos do cliente, encontra o último (last_completed_at)
//   3) Calcula novo lifecycle_status com lib/customerLifecycle
//   4) Só faz update se houve mudança (evita writes desnecessários)
//
// Idempotente: pode rodar quantas vezes for, sempre converge ao estado correto.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Replicamos a lógica pura aqui (Deno não importa de @/lib).
const DEFAULT_CRM_SETTINGS = {
  fiel_min_appointments: 5,
  em_risco_days: 30,
  inativo_days: 60,
  perdido_days: 90,
};

function getCrmSettings(company) {
  const s = company?.crm_settings || {};
  return {
    fiel_min_appointments: Number(s.fiel_min_appointments) || DEFAULT_CRM_SETTINGS.fiel_min_appointments,
    em_risco_days: Number(s.em_risco_days) || DEFAULT_CRM_SETTINGS.em_risco_days,
    inativo_days: Number(s.inativo_days) || DEFAULT_CRM_SETTINGS.inativo_days,
    perdido_days: Number(s.perdido_days) || DEFAULT_CRM_SETTINGS.perdido_days,
  };
}

function computeLifecycleStatus(customer, settings, now = new Date()) {
  if (!customer) return 'primeira_visita';
  const total = Number(customer.total_appointments) || 0;
  const lastIso = customer.last_completed_at || customer.last_appointment_at;
  if (!lastIso || total <= 1) return 'primeira_visita';
  const last = new Date(lastIso);
  if (Number.isNaN(last.getTime())) return 'primeira_visita';
  const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (days >= settings.perdido_days) return 'perdido';
  if (days >= settings.inativo_days) return 'inativo';
  if (days >= settings.em_risco_days) return 'em_risco';
  if (total >= settings.fiel_min_appointments) return 'fiel';
  return 'primeira_visita';
}

async function recomputeOne(sdk, customer, settings) {
  // Busca último atendimento concluído (caso o customer ainda não tenha last_completed_at)
  const concluded = await sdk.entities.Appointment.filter(
    { company_id: customer.company_id, customer_id: customer.id, status: 'concluido' },
    '-completed_at',
    1,
  );
  const lastCompleted = concluded?.[0];
  const lastCompletedAt = lastCompleted?.completed_at || lastCompleted?.scheduled_at || customer.last_completed_at || null;

  const totalConcluded = await sdk.entities.Appointment.filter(
    { company_id: customer.company_id, customer_id: customer.id, status: 'concluido' },
    '-completed_at',
    500,
  ).then(arr => arr?.length || 0);

  const enriched = {
    ...customer,
    total_appointments: totalConcluded || customer.total_appointments || 0,
    last_completed_at: lastCompletedAt,
  };
  const newStatus = computeLifecycleStatus(enriched, settings);

  const patch = {};
  if (enriched.last_completed_at && enriched.last_completed_at !== customer.last_completed_at) {
    patch.last_completed_at = enriched.last_completed_at;
  }
  if (enriched.total_appointments !== customer.total_appointments) {
    patch.total_appointments = enriched.total_appointments;
  }
  if (newStatus !== customer.lifecycle_status) {
    patch.lifecycle_status = newStatus;
    patch.lifecycle_updated_at = new Date().toISOString();
  }

  if (Object.keys(patch).length === 0) {
    return { id: customer.id, changed: false, status: newStatus };
  }
  await sdk.entities.Customer.update(customer.id, patch);
  return { id: customer.id, changed: true, status: newStatus, patch };
}

Deno.serve(async (req) => {
  console.log('[recomputeCustomerLifecycle] start');
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const { customer_id, company_id } = payload || {};

    // Modo 1: cliente específico
    if (customer_id) {
      const customer = await sdk.entities.Customer.get(customer_id);
      if (!customer) return Response.json({ error: 'customer_not_found' }, { status: 404 });
      const company = await sdk.entities.Company.get(customer.company_id);
      const settings = getCrmSettings(company);
      const result = await recomputeOne(sdk, customer, settings);
      return Response.json({ success: true, mode: 'single', result });
    }

    // Modo 2: empresa específica (uso pelo on-conclude com company_id alvo)
    if (company_id) {
      const company = await sdk.entities.Company.get(company_id);
      const settings = getCrmSettings(company);
      const customers = await sdk.entities.Customer.filter({ company_id }, '-created_date', 1000);
      let changed = 0;
      const results = [];
      for (const c of customers) {
        try {
          const r = await recomputeOne(sdk, c, settings);
          if (r.changed) changed++;
          results.push(r);
        } catch (e) {
          console.error('[recomputeCustomerLifecycle] customer error:', c.id, e.message);
        }
      }
      return Response.json({ success: true, mode: 'company', total: customers.length, changed });
    }

    // Modo 3: TODA a base (admin only — usado pelo job diário)
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const companies = await sdk.entities.Company.list('-created_date', 500);
    let totalCustomers = 0;
    let totalChanged = 0;
    for (const company of companies) {
      const settings = getCrmSettings(company);
      const customers = await sdk.entities.Customer.filter({ company_id: company.id }, '-created_date', 1000);
      totalCustomers += customers.length;
      for (const c of customers) {
        try {
          const r = await recomputeOne(sdk, c, settings);
          if (r.changed) totalChanged++;
        } catch (e) {
          console.error('[recomputeCustomerLifecycle] customer error:', c.id, e.message);
        }
      }
    }
    return Response.json({ success: true, mode: 'global', companies: companies.length, customers: totalCustomers, changed: totalChanged });
  } catch (error) {
    console.error('[recomputeCustomerLifecycle] error:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});