// generateDemoData — MASTER_ADMIN only.
// Popula um tenant com dados fake realistas para demo/testes.
// Todos os registros recebem is_demo_data: true para limpeza segura.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Seeder determinístico simples ───────────────────────────────────────────
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function pickN(arr, n, rng) {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}
function randInt(min, max, rng) { return Math.floor(rng() * (max - min + 1)) + min; }
function randFloat(min, max, rng) { return +(min + rng() * (max - min)).toFixed(2); }

// ─── Dados BR fake ────────────────────────────────────────────────────────────
const NOMES = ['Carlos','André','Rafael','Lucas','Pedro','Marcos','João','Thiago','Felipe','Bruno',
  'Rodrigo','Eduardo','Gabriel','Mateus','Diego','Victor','Leonardo','Fabio','Renato','Alexandre',
  'Gustavo','Ricardo','Fernando','Henrique','Daniel','Julio','Sergio','Roberto','Paulo','Luiz'];
const SOBRENOMES = ['Silva','Santos','Oliveira','Souza','Pereira','Costa','Ferreira','Rodrigues',
  'Almeida','Nascimento','Lima','Araújo','Fernandes','Carvalho','Gomes','Martins','Rocha',
  'Ribeiro','Alves','Monteiro','Mendes','Barbosa','Cardoso','Moreira','Cavalcanti'];
const ESPECIALIDADES = ['Barbeiro Especialista','Barba e Cabelo','Colorimetria','Tesoura e Máquina',
  'Degradê Americano','Pompadour Expert','Undercut Specialist','Beard Stylist'];
const TAGS_CLIENTE = ['vip','fiel','indicação','online','walk-in'];
const SERVICOS_BASE = [
  { name: 'Corte Simples', duration_minutes: 30, price: 35 },
  { name: 'Corte + Barba', duration_minutes: 50, price: 65 },
  { name: 'Barba Completa', duration_minutes: 25, price: 35 },
  { name: 'Corte Navalhado', duration_minutes: 40, price: 55 },
  { name: 'Sobrancelha', duration_minutes: 15, price: 20 },
  { name: 'Degradê Americano', duration_minutes: 35, price: 45 },
  { name: 'Pigmentação', duration_minutes: 60, price: 90 },
  { name: 'Corte + Barba + Sobrancelha', duration_minutes: 65, price: 80 },
  { name: 'Platinado', duration_minutes: 90, price: 130 },
  { name: 'Hidratação Capilar', duration_minutes: 45, price: 60 },
];
const COMENTARIOS = [
  'Ótimo atendimento, saí muito satisfeito!',
  'Barbeiro excelente, recomendo a todos.',
  'Melhor barbearia do bairro sem dúvida.',
  'Corte impecável, voltarei com certeza.',
  'Ambiente muito agradável e profissional.',
  'Profissional pontual e muito habilidoso.',
  'Superou minhas expectativas, 10/10.',
  'Bom atendimento, mas demorou um pouco.',
  'Corte bom, porém poderia melhorar na barba.',
  'Atendimento rápido e de qualidade.',
];
const NOTAS = [5,5,5,5,4,4,4,3,2,5];

// DDD de capitais BR + número fake
function fakePhone(rng) {
  const ddds = ['11','21','31','41','51','61','71','81','85','92'];
  const ddd = pick(ddds, rng);
  const n = '9' + String(randInt(10000000, 99999999, rng));
  return ddd + n;
}

function fakeName(rng) {
  return pick(NOMES, rng) + ' ' + pick(SOBRENOMES, rng);
}

function fakeEmail(name, rng) {
  const n = name.toLowerCase().replace(/\s/g, '.').replace(/[^a-z.]/g, '');
  const domains = ['gmail.com','hotmail.com','yahoo.com.br','outlook.com'];
  return `${n}${randInt(1,99,rng)}@${pick(domains, rng)}`;
}

// Data passada aleatória (até `daysBack` dias atrás)
function pastDate(daysBack, rng) {
  const ms = Date.now() - randInt(0, daysBack, rng) * 86400000;
  return new Date(ms);
}

// Horário comercial com picos realistas (sex/sab cheios, ter vazio)
function realisticScheduledAt(baseDate, rng) {
  const d = new Date(baseDate);
  const dow = d.getDay(); // 0=dom
  // Horários disponíveis por dia da semana
  const hours = (dow === 6 || dow === 5)
    ? [9,9,10,10,10,11,11,14,14,15,15,16,16,17,17,18]  // pico
    : (dow === 0)
      ? [10,11,14,15,16]  // domingo reduzido
      : [9,10,11,14,15,16,17];  // normal
  const h = pick(hours, rng);
  const m = pick([0,15,30,45], rng);
  d.setHours(h, m, 0, 0);
  return d;
}

// ─── Criação em lote (chunks) ─────────────────────────────────────────────────
async function batchCreate(sdk, entity, items, chunkSize = 20) {
  const results = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const created = await Promise.all(chunk.map(item => sdk.entities[entity].create(item)));
    results.push(...created);
  }
  return results;
}

// ─── Gerador de serviços ──────────────────────────────────────────────────────
async function generateServices(sdk, company_id, unit_id, rng, count = 8) {
  const existing = await sdk.entities.Service.filter({ company_id }, '-created_date', 5);
  if (existing.length > 0) return existing; // reutiliza serviços já existentes

  const items = SERVICOS_BASE.slice(0, count).map(s => ({
    company_id,
    name: s.name,
    duration_minutes: s.duration_minutes,
    price: s.price,
    active: true,
    featured: rng() > 0.7,
    is_demo_data: true,
  }));
  return batchCreate(sdk, 'Service', items);
}

// ─── Gerador de profissionais ─────────────────────────────────────────────────
async function generateProfessionals(sdk, company_id, unit_id, rng, count = 4) {
  const existing = await sdk.entities.Professional.filter({ company_id, active: true }, '-created_date', 3);
  if (existing.length >= count) return existing.slice(0, count);

  const needed = count - existing.length;
  const usedNames = new Set(existing.map(p => p.name));
  const items = [];
  for (let i = 0; i < needed; i++) {
    let name;
    let attempts = 0;
    do { name = fakeName(rng); attempts++; } while (usedNames.has(name) && attempts < 20);
    usedNames.add(name);
    items.push({
      company_id,
      unit_ids: unit_id ? [unit_id] : [],
      name,
      specialty: pick(ESPECIALIDADES, rng),
      active: true,
      commission_type: pick(['percent','percent','percent','fixed'], rng),
      commission_value: pick([30,35,40,45,50], rng),
      is_demo_data: true,
    });
  }
  const created = await batchCreate(sdk, 'Professional', items);
  return [...existing, ...created];
}

// ─── Gerador de clientes ──────────────────────────────────────────────────────
async function generateCustomers(sdk, company_id, unit_id, rng, count = 100) {
  const items = [];
  const usedPhones = new Set();
  for (let i = 0; i < count; i++) {
    let phone;
    let attempts = 0;
    do { phone = fakePhone(rng); attempts++; } while (usedPhones.has(phone) && attempts < 30);
    usedPhones.add(phone);
    const name = fakeName(rng);
    const totalAppts = randInt(1, 25, rng);
    const lastApptDays = randInt(1, 180, rng);
    const lastApptAt = new Date(Date.now() - lastApptDays * 86400000).toISOString();
    items.push({
      company_id,
      unit_id: unit_id || undefined,
      name,
      phone,
      email: rng() > 0.4 ? fakeEmail(name, rng) : undefined,
      total_appointments: totalAppts,
      last_appointment_at: lastApptAt,
      last_completed_at: lastApptAt,
      status: pick(['active','active','active','active','vip'], rng),
      tags: rng() > 0.6 ? [pick(TAGS_CLIENTE, rng)] : [],
      is_demo_data: true,
    });
  }
  return batchCreate(sdk, 'Customer', items, 25);
}

// ─── Gerador de agendamentos ──────────────────────────────────────────────────
async function generateAppointments(sdk, company_id, unit_id, rng, customers, professionals, services, count = 200) {
  if (!customers.length || !professionals.length || !services.length) return [];

  const STATUS_WEIGHTS = ['concluido','concluido','concluido','concluido','concluido',
    'agendado','agendado','confirmado','confirmado','cancelado','faltou','em_atendimento'];
  const SOURCE_WEIGHTS = ['interno','interno','interno','online','online'];

  const items = [];
  for (let i = 0; i < count; i++) {
    const customer = pick(customers, rng);
    const pro = pick(professionals, rng);
    const svc = pick(services, rng);
    const base = pastDate(120, rng);
    const scheduledAt = realisticScheduledAt(base, rng);
    const status = pick(STATUS_WEIGHTS, rng);
    const source = pick(SOURCE_WEIGHTS, rng);
    const isConcluded = status === 'concluido';

    items.push({
      company_id,
      unit_id: unit_id || undefined,
      customer_id: customer.id,
      professional_id: pro.id,
      service_id: svc.id,
      service_name: svc.name,
      professional_name: pro.name,
      customer_name: customer.name,
      customer_phone: customer.phone,
      scheduled_at: scheduledAt.toISOString(),
      status,
      source,
      price: svc.price,
      paid: isConcluded && rng() > 0.1,
      completed_at: isConcluded ? scheduledAt.toISOString() : undefined,
      is_demo_data: true,
    });
  }
  return batchCreate(sdk, 'Appointment', items, 20);
}

// ─── Gerador financeiro ────────────────────────────────────────────────────────
async function generateFinancial(sdk, company_id, unit_id, rng, professionals, appointments, count = 150) {
  const PAYMENT_METHODS = ['dinheiro','dinheiro','pix','pix','cartao_credito','cartao_debito'];
  const CATEGORIES_OUT = ['aluguel','produtos','manutenção','marketing','utilities','limpeza'];
  const items = [];

  // Entradas baseadas em agendamentos concluídos
  const concluded = appointments.filter(a => a.status === 'concluido').slice(0, Math.floor(count * 0.7));
  for (const appt of concluded) {
    items.push({
      company_id,
      unit_id: unit_id || undefined,
      type: 'entrada',
      entry_kind: 'entrada',
      origin: 'agendamento',
      amount: appt.price || randFloat(30, 90, rng),
      date: appt.scheduled_at?.slice(0, 10),
      payment_method: pick(PAYMENT_METHODS, rng),
      description: `${appt.service_name} — ${appt.customer_name}`,
      professional_id: appt.professional_id,
      customer_id: appt.customer_id,
      reference_appointment_id: appt.id,
      status: 'confirmado',
      is_locked: true,
      is_demo_data: true,
    });
  }

  // Saídas (despesas operacionais)
  const outCount = Math.floor(count * 0.3);
  for (let i = 0; i < outCount; i++) {
    const d = pastDate(90, rng);
    items.push({
      company_id,
      unit_id: unit_id || undefined,
      type: 'saida',
      entry_kind: 'saida',
      origin: 'manual',
      amount: randFloat(50, 800, rng),
      date: d.toISOString().slice(0, 10),
      payment_method: pick(['dinheiro','pix'], rng),
      category: pick(CATEGORIES_OUT, rng),
      description: `Despesa: ${pick(CATEGORIES_OUT, rng)}`,
      status: 'confirmado',
      is_demo_data: true,
    });
  }

  return batchCreate(sdk, 'FinancialEntry', items, 25);
}

// ─── Gerador de comissões ─────────────────────────────────────────────────────
async function generateCommissions(sdk, company_id, rng, professionals, appointments) {
  const concluded = appointments.filter(a => a.status === 'concluido').slice(0, 100);
  const items = concluded.map(appt => {
    const pro = professionals.find(p => p.id === appt.professional_id);
    const commValue = pro?.commission_value || 40;
    const commType = pro?.commission_type || 'percent';
    const amount = commType === 'percent'
      ? +((appt.price || 50) * commValue / 100).toFixed(2)
      : commValue;
    return {
      company_id,
      professional_id: appt.professional_id,
      professional_name: appt.professional_name,
      appointment_id: appt.id,
      service_name: appt.service_name,
      service_price: appt.price || 50,
      commission_type: commType,
      commission_value: commValue,
      amount,
      earned_at: appt.scheduled_at,
      status: pick(['pendente','pendente','pago'], rng),
      is_demo_data: true,
    };
  });
  return batchCreate(sdk, 'Commission', items, 20);
}

// ─── Gerador de avaliações ────────────────────────────────────────────────────
async function generateReviews(sdk, company_id, rng, customers, professionals, appointments) {
  const concluded = appointments.filter(a => a.status === 'concluido').slice(0, 60);
  const eligible = concluded.filter(() => rng() > 0.4); // ~60% deixam avaliação
  const items = eligible.map(appt => {
    const rating = pick(NOTAS, rng);
    return {
      company_id,
      appointment_id: appt.id,
      customer_id: appt.customer_id,
      customer_name: appt.customer_name,
      professional_id: appt.professional_id,
      professional_name: appt.professional_name,
      service_name: appt.service_name,
      rating,
      nps_score: rating >= 5 ? pick([9,10], rng) : rating === 4 ? pick([7,8], rng) : pick([4,5,6], rng),
      comment: rating >= 4 ? pick(COMENTARIOS.slice(0, 7), rng) : pick(COMENTARIOS.slice(7), rng),
      published: rng() > 0.2,
      source: pick(['whatsapp','online','manual'], rng),
      submitted_at: appt.scheduled_at,
      status: 'submitted',
      is_demo_data: true,
    };
  });
  return batchCreate(sdk, 'Review', items, 20);
}

// ─── Configurações de cenário ─────────────────────────────────────────────────
const SCENARIOS = {
  pequena: { pros: 2, customers: 40, appointments: 60, financial: 80 },
  media:   { pros: 5, customers: 300, appointments: 800, financial: 400 },
  premium: { pros: 8, customers: 500, appointments: 1000, financial: 600 },
  lotada:  { pros: 4, customers: 150, appointments: 400, financial: 200 },
  financeiro: { pros: 3, customers: 80, appointments: 150, financial: 800 },
};

// ─── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Master Admin required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, company_id, unit_id, scenario = 'media', modules = 'all', seed } = body;

    if (!company_id) return Response.json({ error: 'company_id required' }, { status: 400 });

    // Valida empresa
    let company;
    try { company = await sdk.entities.Company.get(company_id); } catch { company = null; }
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

    const rngSeed = seed
      ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      : Math.floor(Date.now() / 1000);
    const rng = seededRandom(rngSeed);

    const cfg = SCENARIOS[scenario] || SCENARIOS.media;
    const t0 = Date.now();
    const results = {};

    if (action === 'generate') {
      const genAll = modules === 'all';

      // 1. Serviços
      let services = [];
      if (genAll || modules === 'services') {
        services = await generateServices(sdk, company_id, unit_id, rng);
        results.services = services.length;
      } else {
        services = await sdk.entities.Service.filter({ company_id }, '-created_date', 20);
      }

      // 2. Profissionais
      let professionals = [];
      if (genAll || modules === 'professionals') {
        professionals = await generateProfessionals(sdk, company_id, unit_id, rng, cfg.pros);
        results.professionals = professionals.length;
      } else {
        professionals = await sdk.entities.Professional.filter({ company_id, active: true }, '-created_date', 20);
      }

      // 3. Clientes
      let customers = [];
      if (genAll || modules === 'customers') {
        customers = await generateCustomers(sdk, company_id, unit_id, rng, cfg.customers);
        results.customers = customers.length;
      } else {
        customers = await sdk.entities.Customer.filter({ company_id }, '-created_date', 200);
      }

      // 4. Agendamentos
      let appointments = [];
      if (genAll || modules === 'appointments') {
        if (!professionals.length) professionals = await sdk.entities.Professional.filter({ company_id, active: true }, '-created_date', 20);
        if (!customers.length) customers = await sdk.entities.Customer.filter({ company_id }, '-created_date', 300);
        if (!services.length) services = await sdk.entities.Service.filter({ company_id }, '-created_date', 20);
        appointments = await generateAppointments(sdk, company_id, unit_id, rng, customers, professionals, services, cfg.appointments);
        results.appointments = appointments.length;
      } else {
        appointments = await sdk.entities.Appointment.filter({ company_id }, '-created_date', 500);
      }

      // 5. Financeiro
      if (genAll || modules === 'financial') {
        if (!appointments.length) appointments = await sdk.entities.Appointment.filter({ company_id, is_demo_data: true }, '-created_date', 500);
        const entries = await generateFinancial(sdk, company_id, unit_id, rng, professionals, appointments, cfg.financial);
        results.financial = entries.length;
      }

      // 6. Comissões
      if (genAll || modules === 'commissions') {
        const entries = await generateCommissions(sdk, company_id, rng, professionals, appointments);
        results.commissions = entries.length;
      }

      // 7. Avaliações
      if (genAll || modules === 'reviews') {
        const reviews = await generateReviews(sdk, company_id, rng, customers, professionals, appointments);
        results.reviews = reviews.length;
      }

      // Audit log
      try {
        await sdk.entities.AuditLog.create({
          company_id,
          actor_email: user.email,
          actor_type: 'user',
          actor_id: user.id,
          actor_name: user.full_name,
          actor_is_super_admin: true,
          action: 'DEMO_DATA_GENERATED',
          severity: 'warning',
          target_type: 'company',
          target_id: company_id,
          metadata: { scenario, modules, seed: rngSeed, results, duration_ms: Date.now() - t0 },
        });
      } catch {}

      return Response.json({
        success: true,
        action: 'generate',
        scenario,
        company_id,
        duration_ms: Date.now() - t0,
        results,
      });
    }

    if (action === 'clear') {
      // Remove SOMENTE registros com is_demo_data: true
      const cleared = {};
      const entities = ['Appointment','Customer','FinancialEntry','Commission','Review'];
      for (const entity of entities) {
        try {
          const items = await sdk.entities[entity].filter({ company_id, is_demo_data: true }, '-created_date', 500);
          await Promise.all(items.map(i => sdk.entities[entity].delete(i.id)));
          cleared[entity.toLowerCase()] = items.length;
        } catch (err) {
          console.warn(`[generateDemoData] clear ${entity} error:`, err.message);
          cleared[entity.toLowerCase()] = 0;
        }
      }
      // Serviços e profissionais demo
      for (const entity of ['Service','Professional']) {
        try {
          const items = await sdk.entities[entity].filter({ company_id, is_demo_data: true }, '-created_date', 100);
          await Promise.all(items.map(i => sdk.entities[entity].delete(i.id)));
          cleared[entity.toLowerCase()] = items.length;
        } catch (err) {
          cleared[entity.toLowerCase()] = 0;
        }
      }

      try {
        await sdk.entities.AuditLog.create({
          company_id,
          actor_email: user.email,
          actor_type: 'user',
          actor_id: user.id,
          actor_name: user.full_name,
          actor_is_super_admin: true,
          action: 'DEMO_DATA_CLEARED',
          severity: 'warning',
          target_type: 'company',
          target_id: company_id,
          metadata: { cleared, duration_ms: Date.now() - t0 },
        });
      } catch {}

      return Response.json({ success: true, action: 'clear', cleared, duration_ms: Date.now() - t0 });
    }

    if (action === 'count') {
      // Conta registros demo existentes
      const counts = {};
      const entities = ['Appointment','Customer','FinancialEntry','Commission','Review','Service','Professional'];
      await Promise.all(entities.map(async (entity) => {
        try {
          const items = await sdk.entities[entity].filter({ company_id, is_demo_data: true }, '-created_date', 1000);
          counts[entity.toLowerCase()] = items.length;
        } catch {
          counts[entity.toLowerCase()] = 0;
        }
      }));
      return Response.json({ success: true, counts });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[generateDemoData] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});