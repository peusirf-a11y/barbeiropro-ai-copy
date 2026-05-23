// ============================================================================
// seedTestTenant — Provisiona um tenant E2E completo e determinístico.
// ============================================================================
//
// PAYLOAD:
//   { slug?: string = "e2e-barbershop", reset?: boolean = false }
//
// SEGURANÇA (em ordem):
//   1. Caller DEVE ser super_admin (user.role === 'admin') OU
//      Deno.env.get('ALLOW_E2E_SEED') === 'true'
//   2. Slug DEVE começar com "e2e-" (nunca toca em produção).
//   3. Tudo idempotente: nomes prefixados [E2E], lookup por chave única.
//
// IDEMPOTÊNCIA:
//   - Company por slug
//   - Customer por (company_id, email)
//   - Service / Professional / Plan por (company_id, name)
//   - Appointment por (company_id, customer_id, scheduled_at)
//   - CashRegister: apenas 1 aberto por empresa (claim único)
//   - FinancialEntry: chaves determinísticas via notes "[E2E:tag]"
//
// OBSERVABILIDADE:
//   AuditLog action="E2E_SEED_CREATED" / "E2E_SEED_RESET"
//   SecurityEvent quando seed é rejeitado em produção.
//
// Performance alvo: < 5s para criar/atualizar ~30 entidades.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { timingSafeEqual } from 'node:crypto';

// ── Constantes (cópia literal de lib/testing/testTenantFactory.js) ─────────
const E2E_TENANT = {
  slug: 'e2e-barbershop',
  name: '[E2E] Barbearia Teste',
  owner_email: 'e2e@teste.com',
  owner_name: '[E2E] Admin Teste',
  phone: '11999990000',
  whatsapp: '11999990000',
  primary_color: '#2563EB',
  secondary_color: '#F8F7F3',
};
const E2E_CUSTOMER_PASSWORD = 'E2E#StrongPassword2026';
const E2E_PLAN = {
  name: '[E2E] Plano Enterprise Teste',
  price_monthly: 397,
  features: [
    'crm', 'crm_retention', 'appointments', 'financial_dashboard',
    'subscriptions', 'dashboard', 'cashier', 'analytics',
    'advanced_reports', 'ai_growth', 'reviews', 'team_management',
    'commissions', 'combos',
  ],
};
const E2E_CUSTOMERS = [
  { name: '[E2E] Ana Silva',       email: 'ana.silva.e2e@teste.com',       phone: '11900001001' },
  { name: '[E2E] Ana Paula',       email: 'ana.paula.e2e@teste.com',       phone: '11900001002' },
  { name: '[E2E] João Pedro',      email: 'joao.pedro.e2e@teste.com',      phone: '11900001003' },
  { name: '[E2E] Carlos Henrique', email: 'carlos.henrique.e2e@teste.com', phone: '11900001004' },
  { name: '[E2E] Fernanda Lima',   email: 'fernanda.lima.e2e@teste.com',   phone: '11900001005' },
];
const E2E_SERVICES = [
  { name: '[E2E] Corte',         price: 50, duration_minutes: 30 },
  { name: '[E2E] Barba',         price: 35, duration_minutes: 20 },
  { name: '[E2E] Corte + Barba', price: 75, duration_minutes: 50 },
];
const E2E_PROFESSIONAL = {
  name: '[E2E] Barbeiro Teste',
  email: 'barbeiro.e2e@teste.com',
  phone: '11900002000',
  commission_percentage: 50,
};

// ── Helpers ────────────────────────────────────────────────────────────────

// PBKDF2-SHA256 (mesmo pipeline do customerAuth) — para customers da área pública.
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100000 },
    keyMaterial, 256,
  );
  const arr = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + arr.length);
  combined.set(salt);
  combined.set(arr, salt.length);
  return Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isoOffsetDays(days, hour = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function authorizeCaller(sdk, base44) {
  // 1. Super admin via Base44 platform
  try {
    const user = await base44.auth.me();
    if (user?.role === 'admin') return { ok: true, actor: user.email, mode: 'super_admin' };
  } catch { /* sem sessão */ }

  // 2. Flag de ambiente para CI/staging
  if (Deno.env.get('ALLOW_E2E_SEED') === 'true') {
    return { ok: true, actor: 'env:ALLOW_E2E_SEED', mode: 'env_flag' };
  }

  return { ok: false };
}

async function audit(sdk, payload) {
  try {
    await sdk.entities.AuditLog.create({ severity: 'info', ...payload });
  } catch (err) {
    console.warn('[seedTestTenant] AuditLog falhou:', err.message);
  }
}

async function securityEvent(sdk, payload) {
  try {
    await sdk.entities.SecurityEvent.create(payload);
  } catch { /* não-bloqueante */ }
}

// Apaga em lote por filtro. Trata listas grandes com paginação.
async function purgeEntity(sdk, entityName, filter) {
  let total = 0;
  // Limit de segurança para não loopar infinito caso filter retorne lixo
  for (let i = 0; i < 50; i++) {
    const batch = await sdk.entities[entityName].filter(filter, '-created_date', 200).catch(() => []);
    if (!batch || batch.length === 0) break;
    for (const item of batch) {
      try {
        await sdk.entities[entityName].delete(item.id);
        total++;
      } catch (err) {
        console.warn(`[seedTestTenant] delete ${entityName}/${item.id} falhou:`, err.message);
      }
    }
    if (batch.length < 200) break;
  }
  return total;
}

// Limpa dados de um tenant E2E (mantém Company e Plan — recriados via upsert).
async function purgeTenantData(sdk, company_id) {
  const entities = [
    'Appointment', 'FinancialEntry', 'CashRegister', 'CustomerSubscription',
    'SubscriptionUsage', 'Customer', 'Professional', 'Service', 'ServiceCategory',
    'Unit', 'Review', 'BlockedTime', 'WhatsAppMessage', 'CustomerConsent',
    'PrivacyAuditLog', 'AuditLog', 'TeamMember', 'SecurityRateLimit',
  ];
  const counts = {};
  for (const e of entities) {
    counts[e] = await purgeEntity(sdk, e, { company_id });
  }
  return counts;
}

// ──────────────────────────────────────────────────────────────────────────
// SEEDERS — cada um idempotente, retorna o registro final.
// ──────────────────────────────────────────────────────────────────────────

async function upsertCompany(sdk, slug) {
  const existing = await sdk.entities.Company.filter({ slug }, '-created_date', 1).catch(() => []);
  const data = {
    name: E2E_TENANT.name,
    slug,
    owner_email: E2E_TENANT.owner_email,
    owner_name: E2E_TENANT.owner_name,
    phone: E2E_TENANT.phone,
    whatsapp: E2E_TENANT.whatsapp,
    primary_color: E2E_TENANT.primary_color,
    secondary_color: E2E_TENANT.secondary_color,
    status: 'active',
    subscription_status: 'active',
    is_blocked_by_billing: false,
    onboarding_completed: true,
    onboarding_step: 99,
    plan_name: 'Enterprise',
    multi_unit_enabled: false,
    customers_shared_across_units: true,
  };
  if (existing?.[0]) {
    return await sdk.entities.Company.update(existing[0].id, data);
  }
  return await sdk.entities.Company.create(data);
}

async function upsertPlan(sdk, company_id) {
  const existing = await sdk.entities.Plan.filter({ name: E2E_PLAN.name }, '-created_date', 1).catch(() => []);
  const data = {
    name: E2E_PLAN.name,
    price_monthly: E2E_PLAN.price_monthly,
    features: E2E_PLAN.features,
    active: true,
    visibility: 'private',
    allowed_company_ids: [company_id],
    sort_order: 999,
  };
  if (existing?.[0]) {
    return await sdk.entities.Plan.update(existing[0].id, data);
  }
  return await sdk.entities.Plan.create(data);
}

async function upsertProfessional(sdk, company_id) {
  const existing = await sdk.entities.Professional
    .filter({ company_id, name: E2E_PROFESSIONAL.name }, '-created_date', 1).catch(() => []);
  const data = {
    company_id,
    name: E2E_PROFESSIONAL.name,
    email: E2E_PROFESSIONAL.email,
    phone: E2E_PROFESSIONAL.phone,
    commission_percentage: E2E_PROFESSIONAL.commission_percentage,
    active: true,
  };
  if (existing?.[0]) {
    return await sdk.entities.Professional.update(existing[0].id, data);
  }
  return await sdk.entities.Professional.create(data);
}

async function upsertServices(sdk, company_id) {
  const out = [];
  for (const s of E2E_SERVICES) {
    const existing = await sdk.entities.Service
      .filter({ company_id, name: s.name }, '-created_date', 1).catch(() => []);
    const data = { company_id, ...s, active: true };
    if (existing?.[0]) {
      out.push(await sdk.entities.Service.update(existing[0].id, data));
    } else {
      out.push(await sdk.entities.Service.create(data));
    }
  }
  return out;
}

async function upsertCustomers(sdk, company_id) {
  const passwordHash = await hashPassword(E2E_CUSTOMER_PASSWORD);
  const out = [];
  for (const c of E2E_CUSTOMERS) {
    const existing = await sdk.entities.Customer
      .filter({ company_id, email: c.email }, '-created_date', 1).catch(() => []);
    const data = {
      company_id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: 'active',
      password_hash: passwordHash,
    };
    if (existing?.[0]) {
      out.push(await sdk.entities.Customer.update(existing[0].id, data));
    } else {
      out.push(await sdk.entities.Customer.create(data));
    }
  }
  return out;
}

// Cobre todos os cenários pedidos: concluído, cancelado, futuro, pendente, falha pagamento.
async function seedAppointments(sdk, company_id, customers, professional, services) {
  const [corte, barba, comboService] = services;
  const cliente1 = customers[0]; // Ana Silva
  const cliente2 = customers[1]; // Ana Paula
  const cliente3 = customers[2]; // João Pedro
  const cliente4 = customers[3]; // Carlos
  const cliente5 = customers[4]; // Fernanda

  const baseAppt = {
    company_id,
    professional_id: professional.id,
    professional_name: professional.name,
  };

  const definitions = [
    // Concluído (ontem) — gera histórico, dashboard, métricas
    {
      ...baseAppt, customer_id: cliente1.id, customer_name: cliente1.name, customer_phone: cliente1.phone,
      service_id: corte.id, service_name: corte.name, price: corte.price,
      scheduled_at: isoOffsetDays(-1, 10), status: 'concluido',
      completed_at: isoOffsetDays(-1, 11), paid: true, paid_at: isoOffsetDays(-1, 11),
      payment_method: 'card', source: 'interno',
    },
    {
      ...baseAppt, customer_id: cliente3.id, customer_name: cliente3.name, customer_phone: cliente3.phone,
      service_id: comboService.id, service_name: comboService.name, price: comboService.price,
      scheduled_at: isoOffsetDays(-2, 15), status: 'concluido',
      completed_at: isoOffsetDays(-2, 16), paid: true, paid_at: isoOffsetDays(-2, 16),
      payment_method: 'pix', source: 'online',
    },
    // Cancelado (ontem)
    {
      ...baseAppt, customer_id: cliente2.id, customer_name: cliente2.name, customer_phone: cliente2.phone,
      service_id: barba.id, service_name: barba.name, price: barba.price,
      scheduled_at: isoOffsetDays(-1, 16), status: 'cancelado', source: 'interno',
    },
    // Futuro confirmado
    {
      ...baseAppt, customer_id: cliente4.id, customer_name: cliente4.name, customer_phone: cliente4.phone,
      service_id: corte.id, service_name: corte.name, price: corte.price,
      scheduled_at: isoOffsetDays(2, 14), status: 'confirmado', source: 'online',
    },
    // Pendente (agendado, hoje +2h)
    {
      ...baseAppt, customer_id: cliente5.id, customer_name: cliente5.name, customer_phone: cliente5.phone,
      service_id: barba.id, service_name: barba.name, price: barba.price,
      scheduled_at: isoOffsetDays(0, new Date().getHours() + 2), status: 'agendado', source: 'interno',
    },
    // Falha de pagamento online
    {
      ...baseAppt, customer_id: cliente1.id, customer_name: cliente1.name, customer_phone: cliente1.phone,
      service_id: corte.id, service_name: corte.name, price: corte.price,
      scheduled_at: isoOffsetDays(3, 11), status: 'cancelado',
      payment_status: 'failed', paid_online: false, source: 'online',
    },
  ];

  const out = [];
  for (const def of definitions) {
    // Idempotência: (company_id, customer_id, scheduled_at) é chave determinística
    const existing = await sdk.entities.Appointment.filter({
      company_id, customer_id: def.customer_id, scheduled_at: def.scheduled_at,
    }, '-created_date', 1).catch(() => []);
    if (existing?.[0]) {
      out.push(await sdk.entities.Appointment.update(existing[0].id, def));
    } else {
      out.push(await sdk.entities.Appointment.create(def));
    }
  }
  return out;
}

async function seedCashFlow(sdk, company_id) {
  // 1. Garante apenas UM caixa aberto. Se já existir, reusa.
  let cashRegister;
  const openExisting = await sdk.entities.CashRegister
    .filter({ company_id, status: 'aberto' }, '-created_date', 1).catch(() => []);
  if (openExisting?.[0]) {
    cashRegister = openExisting[0];
  } else {
    cashRegister = await sdk.entities.CashRegister.create({
      company_id,
      opened_at: isoOffsetDays(0, 8),
      initial_amount: 100,
      status: 'aberto',
      opened_by: E2E_TENANT.owner_email,
      notes: '[E2E] Caixa de teste',
    });
  }

  // 2. Entradas + saídas determinísticas. Marcador idempotente em notes.
  const entries = [
    { type: 'entrada', amount: 50,  description: '[E2E:cash-1] Corte balcão',     date: isoOffsetDays(0, 9),  payment_method: 'dinheiro' },
    { type: 'entrada', amount: 75,  description: '[E2E:cash-2] Combo',            date: isoOffsetDays(0, 10), payment_method: 'pix' },
    { type: 'entrada', amount: 35,  description: '[E2E:cash-3] Barba',            date: isoOffsetDays(0, 11), payment_method: 'cartao_credito' },
    { type: 'saida',   amount: 20,  description: '[E2E:cash-4] Produto limpeza',  date: isoOffsetDays(0, 12), payment_method: 'dinheiro' },
  ];

  for (const e of entries) {
    const existing = await sdk.entities.FinancialEntry
      .filter({ company_id, description: e.description }, '-created_date', 1).catch(() => []);
    const data = {
      company_id,
      cash_register_id: cashRegister.id,
      ...e,
    };
    if (existing?.[0]) {
      await sdk.entities.FinancialEntry.update(existing[0].id, data);
    } else {
      await sdk.entities.FinancialEntry.create(data);
    }
  }

  return cashRegister;
}

async function seedSubscriptions(sdk, company_id, plan, customers) {
  // CustomerPlan E2E
  const planName = '[E2E] Plano Mensal Cliente';
  const existingCp = await sdk.entities.CustomerPlan
    .filter({ company_id, name: planName }, '-created_date', 1).catch(() => []);
  const customerPlan = existingCp?.[0]
    ? await sdk.entities.CustomerPlan.update(existingCp[0].id, {
        company_id, name: planName, price_monthly: 89, type: 'limited',
        usage_limit: 4, active: true, visibility: 'public',
      })
    : await sdk.entities.CustomerPlan.create({
        company_id, name: planName, price_monthly: 89, type: 'limited',
        usage_limit: 4, active: true, visibility: 'public',
      });

  // Assinatura ativa (Ana Silva)
  const ana = customers[0];
  const existingActive = await sdk.entities.CustomerSubscription
    .filter({ company_id, customer_id: ana.id, plan_id: customerPlan.id }, '-created_date', 1).catch(() => []);
  const activeSub = existingActive?.[0]
    ? await sdk.entities.CustomerSubscription.update(existingActive[0].id, {
        status: 'active', uses_remaining: 3,
        plan_name_snapshot: customerPlan.name, plan_price_snapshot: customerPlan.price_monthly,
        plan_type_snapshot: customerPlan.type,
        current_cycle_end: isoOffsetDays(20, 23),
      })
    : await sdk.entities.CustomerSubscription.create({
        company_id, customer_id: ana.id, plan_id: customerPlan.id,
        status: 'active', uses_remaining: 3,
        plan_name_snapshot: customerPlan.name, plan_price_snapshot: customerPlan.price_monthly,
        plan_type_snapshot: customerPlan.type,
        current_cycle_end: isoOffsetDays(20, 23),
      });

  return { customerPlan, activeSub };
}

async function seedLGPD(sdk, company_id, customers) {
  // Consentimentos básicos para cada customer
  for (const c of customers) {
    const existing = await sdk.entities.CustomerConsent
      .filter({ company_id, customer_id: c.id, consent_type: 'data_processing_general' }, '-created_date', 1)
      .catch(() => []);
    if (existing?.[0]) continue;
    await sdk.entities.CustomerConsent.create({
      company_id, customer_id: c.id,
      consent_type: 'data_processing_general',
      granted: true,
      granted_at: new Date().toISOString(),
      source: 'booking_flow',
      legal_text_version: 'e2e-v1.0',
      legal_text_snippet: '[E2E] Consentimento determinístico para testes.',
    });
  }
  // Audit log inicial
  await sdk.entities.PrivacyAuditLog.create({
    company_id,
    actor_email: E2E_TENANT.owner_email,
    actor_type: 'system',
    action: 'CONSENT_GRANTED',
    details: { e2e_seed: true, customers_count: customers.length },
    severity: 'info',
  }).catch(() => {});
}

// ──────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ──────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const slug = body.slug || E2E_TENANT.slug;
    const reset = body.reset === true;

    // ── 1. Authorization ─────────────────────────────────────────────────
    const auth = await authorizeCaller(sdk, base44);
    if (!auth.ok) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      await securityEvent(sdk, {
        event_type: 'privilege_escalation_attempt',
        severity: 'critical',
        ip_address: ip,
        route: 'seedTestTenant',
        details: { reason: 'unauthorized_caller', slug },
        blocked: true,
      });
      return Response.json({ ok: false, error: 'Forbidden: only super_admin or ALLOW_E2E_SEED=true' }, { status: 403 });
    }

    // ── 2. Slug guard — NUNCA toca em produção ───────────────────────────
    if (typeof slug !== 'string' || !slug.startsWith('e2e-')) {
      return Response.json({ ok: false, error: 'slug must start with "e2e-"' }, { status: 400 });
    }

    // ── 3. Upsert Company ────────────────────────────────────────────────
    let company = await upsertCompany(sdk, slug);
    const company_id = company.id;

    // ── 4. Optional reset (apaga dados, mantém Company) ──────────────────
    let purgeCounts = null;
    if (reset) {
      purgeCounts = await purgeTenantData(sdk, company_id);
      // Re-upsert Company (caso reset tenha removido algo) — garante baseline.
      company = await upsertCompany(sdk, slug);
    }

    // ── 5. Seed sequence (cada step idempotente) ─────────────────────────
    const plan = await upsertPlan(sdk, company_id);
    await sdk.entities.Company.update(company_id, { plan_id: plan.id, plan_name: plan.name });

    const professional = await upsertProfessional(sdk, company_id);
    const services     = await upsertServices(sdk, company_id);
    const customers    = await upsertCustomers(sdk, company_id);
    const appointments = await seedAppointments(sdk, company_id, customers, professional, services);
    const cashRegister = await seedCashFlow(sdk, company_id);
    const subscriptions = await seedSubscriptions(sdk, company_id, plan, customers);
    await seedLGPD(sdk, company_id, customers);

    // ── 6. Audit ─────────────────────────────────────────────────────────
    await audit(sdk, {
      company_id,
      actor_email: auth.actor,
      actor_type: 'system',
      action: reset ? 'E2E_SEED_RESET' : 'E2E_SEED_CREATED',
      target_type: 'company',
      target_id: company_id,
      severity: 'info',
      metadata: {
        slug, mode: auth.mode,
        elapsed_ms: Date.now() - t0,
        counts: {
          customers: customers.length,
          services: services.length,
          appointments: appointments.length,
          plan_features: plan.features?.length || 0,
        },
        purged: purgeCounts,
      },
    });

    return Response.json({
      ok: true,
      mode: auth.mode,
      reset,
      elapsed_ms: Date.now() - t0,
      company_id,
      owner_email: E2E_TENANT.owner_email,
      slug,
      summary: {
        plan: { id: plan.id, name: plan.name, features: plan.features?.length || 0 },
        professional: { id: professional.id, name: professional.name },
        services: services.map(s => ({ id: s.id, name: s.name })),
        customers: customers.map(c => ({ id: c.id, name: c.name, email: c.email })),
        appointments: appointments.length,
        cash_register_id: cashRegister.id,
        active_subscription_id: subscriptions.activeSub.id,
        purged: purgeCounts,
      },
    });
  } catch (error) {
    console.error('[seedTestTenant] erro:', error.message, error.stack);
    return Response.json({ ok: false, error: error.message, elapsed_ms: Date.now() - t0 }, { status: 500 });
  }
});