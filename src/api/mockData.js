// Mock Data centralizado do O CORTE
// Fonte de dados inicial completa para desenvolvimento e ambiente autônomo.

export const INITIAL_PLANS = [
  {
    id: 'classico',
    slug: 'classico',
    name: 'Clássico',
    description: 'Ideal para barbearias individuais ou iniciantes.',
    price_monthly: 69,
    price: 69,
    interval: 'MONTHLY',
    sort_order: 1,
    order_index: 1,
    is_public: true,
    company_id: null,
    features: [
      'Agenda online simples',
      'Gestão de clientes',
      'Caixa e controle financeiro',
      'Até 2 profissionais',
      'Notificações de agendamento',
    ],
    limits: {
      professionals: 2,
      units: 1,
      whatsapp_messages: 100,
    },
  },
  {
    id: 'master',
    slug: 'master',
    name: 'Master',
    description: 'Para barbearias em crescimento que buscam automatização e IA.',
    price_monthly: 119,
    price: 119,
    interval: 'MONTHLY',
    sort_order: 2,
    order_index: 2,
    is_public: true,
    is_recommended: true,
    company_id: null,
    features: [
      'Tudo do plano Clássico',
      'IA de Crescimento O CORTE',
      'Planos de assinatura e recorrência',
      'Cálculo e aprovação de comissões',
      'Até 8 profissionais',
      'Disparo de WhatsApp comercial',
    ],
    limits: {
      professionals: 8,
      units: 2,
      whatsapp_messages: 500,
    },
  },
  {
    id: 'exclusivo',
    slug: 'exclusivo',
    name: 'Exclusivo',
    description: 'Para redes de barbearias e grandes operações corporativas.',
    price_monthly: 249,
    price: 249,
    interval: 'MONTHLY',
    sort_order: 3,
    order_index: 3,
    is_public: true,
    company_id: null,
    features: [
      'Tudo do plano Master',
      'Profissionais ilimitados',
      'Múltiplas unidades e relatórios consolidados',
      'Clube de Assinatura VIP e Planos Recorrentes',
      'Suporte prioritário 24/7',
      'Integrações via API e Webhooks Asaas',
    ],
    limits: {
      professionals: 999,
      units: 10,
      whatsapp_messages: 5000,
    },
  },
];

export const INITIAL_COMPANIES = [
  {
    id: 'comp_demo_01',
    name: 'Barbearia Navalha de Ouro',
    razao_social: 'Navalha de Ouro Barbearia LTDA',
    cnpj: '12.345.678/0001-90',
    slug: 'navalha-ouro',
    owner_email: 'dono@navalhaouro.com.br',
    owner_name: 'Carlos Oliveira',
    phone_whatsapp: '51999887766',
    status: 'active',
    plan_id: 'pro',
    billing_provider: 'asaas',
    billing_status: 'ACTIVE',
    onboarding_completed: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

export const INITIAL_BARBER_CREDENTIALS = [
  {
    id: 'cred_admin_pedro',
    email: 'pedrojesantos@hotmail.com',
    full_name: 'Pedro Santos (Administrador Master)',
    role: 'admin',
    is_super_admin: true,
    is_active: true,
  },
  {
    id: 'cred_dono_01',
    email: 'dono@navalhaouro.com.br',
    full_name: 'Carlos Oliveira',
    role: 'owner',
    company_id: 'comp_demo_01',
    is_active: true,
  },
];

// 1. PROFISSIONAIS (2 Profissionais)
export const INITIAL_PROFESSIONALS = [
  {
    id: 'pro_01',
    company_id: 'comp_demo_01',
    name: 'Lucas Barbeiro',
    role: 'barbeiro',
    specialty: 'Corte Degradê & Barba',
    email: 'lucas@navalhaouro.com.br',
    phone: '51988776611',
    active: true,
    is_active: true,
    commission_type: 'percent',
    commission_value: 50,
  },
  {
    id: 'pro_02',
    company_id: 'comp_demo_01',
    name: 'Rafael Mestre',
    role: 'barbeiro',
    specialty: 'Especialista em Barba com Toalha Quente',
    email: 'rafael@navalhaouro.com.br',
    phone: '51988776622',
    active: true,
    is_active: true,
    commission_type: 'percent',
    commission_value: 50,
  },
];

// 2. SERVIÇOS (6 Serviços)
export const INITIAL_SERVICES = [
  { id: 'serv_01', company_id: 'comp_demo_01', name: 'Corte Degradê Navalhado', price: 45, duration_minutes: 45, active: true, is_active: true },
  { id: 'serv_02', company_id: 'comp_demo_01', name: 'Barba Completa com Toalha Quente', price: 35, duration_minutes: 30, active: true, is_active: true },
  { id: 'serv_03', company_id: 'comp_demo_01', name: 'Combo Corte + Barba', price: 70, duration_minutes: 60, active: true, is_active: true },
  { id: 'serv_04', company_id: 'comp_demo_01', name: 'Acabamento e Pezinho', price: 20, duration_minutes: 20, active: true, is_active: true },
  { id: 'serv_05', company_id: 'comp_demo_01', name: 'Coloração Beard Premium', price: 60, duration_minutes: 40, active: true, is_active: true },
  { id: 'serv_06', company_id: 'comp_demo_01', name: 'Hidratação Capilar Profunda', price: 40, duration_minutes: 30, active: true, is_active: true },
];

// 3. CLIENTES (40 Clientes)
const firstNames = ['Carlos', 'Eduardo', 'Fernanda', 'Lucas', 'Matheus', 'Gabriel', 'Rafael', 'Felipe', 'Bruno', 'Rodrigo', 'Thiago', 'André', 'Juliana', 'Patrícia', 'Marcelo', 'Gustavo', 'Diego', 'Vinícius', 'Leonardo', 'Guilherme'];
const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Ferreira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Barbosa', 'Ribeiro', 'Carvalho', 'Araújo', 'Melo'];

export const INITIAL_CUSTOMERS = Array.from({ length: 40 }, (_, i) => {
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i * 3) % lastNames.length];
  return {
    id: `cust_${String(i + 1).padStart(2, '0')}`,
    company_id: 'comp_demo_01',
    name: `${fn} ${ln}`,
    cpf: `${100 + i}.456.${789 - i}-0${i % 9}`,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i + 1}@exemplo.com.br`,
    phone: `5199${Math.floor(1000000 + (i * 123456) % 8999999)}`,
    status: i % 5 === 0 ? 'vip' : 'active',
    lifecycle_stage: i % 5 === 0 ? 'vip' : 'active',
    total_appointments: 1 + (i % 12),
    created_at: new Date(Date.now() - (60 - i) * 86400000).toISOString(),
    last_appointment_at: new Date(Date.now() - (i % 15) * 86400000).toISOString(),
  };
});

// 4. AGENDAMENTOS (60 Agendamentos)
const timesList = ['08:30', '09:15', '10:00', '10:45', '11:30', '13:30', '14:15', '15:00', '15:45', '16:30', '17:15', '18:00'];
export const INITIAL_APPOINTMENTS = Array.from({ length: 60 }, (_, i) => {
  const dayOffset = (i % 30) - 20; // past and future
  const apptDate = new Date();
  apptDate.setDate(apptDate.getDate() + dayOffset);
  const dateStr = apptDate.toISOString().split('T')[0];
  const serv = INITIAL_SERVICES[i % INITIAL_SERVICES.length];
  const pro = INITIAL_PROFESSIONALS[i % INITIAL_PROFESSIONALS.length];
  const cust = INITIAL_CUSTOMERS[i % INITIAL_CUSTOMERS.length];
  const time = timesList[i % timesList.length];

  return {
    id: `appt_${String(i + 1).padStart(2, '0')}`,
    company_id: 'comp_demo_01',
    customer_id: cust.id,
    customer_name: cust.name,
    customer_phone: cust.phone,
    service_id: serv.id,
    service_name: serv.name,
    professional_id: pro.id,
    professional_name: pro.name,
    date: dateStr,
    scheduled_at: `${dateStr}T${time}:00.000Z`,
    start_time: time,
    price: serv.price,
    status: dayOffset > 0 ? 'agendado' : (i % 8 === 0 ? 'cancelado' : 'concluido'),
    is_demo_data: true,
    created_at: new Date(Date.now() - (30 - dayOffset) * 86400000).toISOString(),
  };
});

// 5. LANÇAMENTOS FINANCEIROS (100 Lançamentos)
export const INITIAL_FINANCIAL = Array.from({ length: 100 }, (_, i) => {
  const entryDate = new Date();
  entryDate.setDate(entryDate.getDate() - (i % 45));
  const dateStr = entryDate.toISOString().split('T')[0];
  const isSaida = i % 10 === 0;

  return {
    id: `fin_${String(i + 1).padStart(3, '0')}`,
    company_id: 'comp_demo_01',
    description: isSaida
      ? (i % 20 === 0 ? 'Compra de Insumos & Pomadas' : 'Manutenção de Cadeiras & Toalhas')
      : `Atendimento Confirmado #${i + 1}`,
    type: isSaida ? 'saida' : 'entrada',
    amount: isSaida ? 120 + (i % 5) * 40 : 35 + (i % 4) * 25,
    date: dateStr,
    payment_method: i % 3 === 0 ? 'PIX' : i % 3 === 1 ? 'CREDIT_CARD' : 'CASH',
    status: 'paid',
    is_demo_data: true,
    created_at: entryDate.toISOString(),
  };
});

// 6. COMISSÕES (15 Comissões)
export const INITIAL_COMMISSIONS = Array.from({ length: 15 }, (_, i) => {
  const commDate = new Date();
  commDate.setDate(commDate.getDate() - (i % 15));
  const dateStr = commDate.toISOString().split('T')[0];
  const pro = INITIAL_PROFESSIONALS[i % INITIAL_PROFESSIONALS.length];
  const serv = INITIAL_SERVICES[i % INITIAL_SERVICES.length];

  return {
    id: `comm_${String(i + 1).padStart(2, '0')}`,
    company_id: 'comp_demo_01',
    professional_id: pro.id,
    professional_name: pro.name,
    service_id: serv.id,
    service_name: serv.name,
    amount: Math.round(serv.price * 0.5),
    status: i % 3 === 0 ? 'pending' : 'paid',
    date: dateStr,
    is_demo_data: true,
    created_at: commDate.toISOString(),
  };
});

// 7. AVALIAÇÕES (12 Avaliações)
const reviewComments = [
  'Atendimento impecável! Recomendo muito a Barbearia Navalha de Ouro.',
  'Corte perfeito, ambiente super agradável e café cortesia excelente.',
  'Barba muito bem desenhada com toalha quente. Profissionais nota 10!',
  'Profissionais extremamente qualificados e pontuais.',
  'Melhor barbearia da cidade! Ambiente limpo e climatizado.',
  'Serviço rápido e com padrão altíssimo de acabamento.',
];

export const INITIAL_REVIEWS = Array.from({ length: 12 }, (_, i) => {
  const revDate = new Date();
  revDate.setDate(revDate.getDate() - (i % 20));
  const cust = INITIAL_CUSTOMERS[i % INITIAL_CUSTOMERS.length];

  return {
    id: `rev_${String(i + 1).padStart(2, '0')}`,
    company_id: 'comp_demo_01',
    customer_id: cust.id,
    customer_name: cust.name,
    rating: i % 6 === 0 ? 4 : 5,
    comment: reviewComments[i % reviewComments.length],
    status: 'approved',
    created_at: revDate.toISOString(),
    is_demo_data: true,
  };
});
