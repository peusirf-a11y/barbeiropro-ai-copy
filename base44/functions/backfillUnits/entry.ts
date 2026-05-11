// backfillUnits — cria a "Matriz" da empresa atual e propaga unit_id em
// Appointment (registros legados) quando vazio.
//
// É IDEMPOTENTE: usa Company.units_backfilled_at como flag. Pode ser
// chamado múltiplas vezes sem efeito colateral.
//
// Chamado pelo frontend (auto-trigger no AppLayout) na primeira vez que
// o owner abre o app pós-deploy.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Descobre a empresa do usuário (owner ou via TeamMember)
    const myCompanies = await base44.entities.Company.filter({ owner_email: user.email });
    let company = myCompanies?.[0];
    if (!company) {
      const tm = (await base44.entities.TeamMember.filter({ email: user.email }, '-created_date', 1))?.[0];
      if (tm?.company_id) {
        company = await base44.entities.Company.get(tm.company_id);
      }
    }
    if (!company) {
      return Response.json({ error: 'No company found' }, { status: 404 });
    }

    // Idempotência: se já rodou, retorna o estado atual
    if (company.units_backfilled_at) {
      const units = await base44.asServiceRole.entities.Unit.filter({ company_id: company.id });
      return Response.json({ status: 'already_done', units });
    }

    // A5 — Defesa server-side contra disparos paralelos (2 tabs, retry rápido).
    // Se já existe Unit para esta company, outro processo paralelo passou pelo
    // create. Marcamos a flag e devolvemos as units existentes em vez de criar duplicado.
    const existingUnits = await base44.asServiceRole.entities.Unit.filter({ company_id: company.id });
    if (existingUnits.length > 0) {
      console.warn(`[backfillUnits] units já existem para company ${company.id} sem flag — corrigindo`);
      await base44.asServiceRole.entities.Company.update(company.id, {
        units_backfilled_at: new Date().toISOString(),
      });
      return Response.json({ status: 'recovered', units: existingUnits });
    }

    // Cria a Matriz herdando dados da Company
    const matriz = await base44.asServiceRole.entities.Unit.create({
      company_id: company.id,
      name: 'Matriz',
      address: company.address || '',
      phone: company.phone || '',
      whatsapp: company.whatsapp || '',
      business_hours: company.business_hours || {},
      active: true,
      is_default: true,
      sort_order: 0,
    });

    console.log(`[backfillUnits] Matriz criada: ${matriz.id} para company ${company.id}`);

    // Propaga unit_id em Appointments existentes que estão sem
    const apptsSemUnit = await base44.asServiceRole.entities.Appointment.filter({
      company_id: company.id,
    }, '-created_date', 1000);
    let updated = 0;
    for (const a of apptsSemUnit) {
      if (!a.unit_id) {
        await base44.asServiceRole.entities.Appointment.update(a.id, { unit_id: matriz.id });
        updated++;
      }
    }
    console.log(`[backfillUnits] ${updated} agendamentos atualizados com unit_id`);

    // Marca a empresa como migrada
    await base44.asServiceRole.entities.Company.update(company.id, {
      units_backfilled_at: new Date().toISOString(),
      multi_unit_enabled: company.multi_unit_enabled ?? false,
      customers_shared_across_units: company.customers_shared_across_units ?? true,
    });

    return Response.json({
      status: 'ok',
      matriz_id: matriz.id,
      appointments_updated: updated,
    });
  } catch (error) {
    console.error('[backfillUnits] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});