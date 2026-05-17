/**
 * demoData.js — Dataset profissional para o modo demonstração.
 * Dados realistas com agenda lotada, clientes recorrentes, assinaturas ativas,
 * faturamento histórico e métricas de retenção.
 */

export const demoCompany = {
  id: 'demo-company',
  name: 'Barbearia Studio 47',
  slug: 'studio47',
  phone: '(11) 98765-4321',
  whatsapp: '11987654321',
  address: 'Rua das Palmeiras, 47 - Vila Madalena, SP',
  primary_color: '#1B3A4B',
  logo_url: null,
  plan_name: 'Pro',
  status: 'active',
  subscription_status: 'active',
  multi_unit_enabled: false,
  stripe_connect_status: 'enabled',
  stripe_connect_charges_enabled: true,
  onboarding_completed: true,
  business_hours: {
    seg: { open: '09:00', close: '20:00', active: true },
    ter: { open: '09:00', close: '20:00', active: true },
    qua: { open: '09:00', close: '20:00', active: true },
    qui: { open: '09:00', close: '20:00', active: true },
    sex: { open: '09:00', close: '20:00', active: true },
    sab: { open: '09:00', close: '18:00', active: true },
    dom: { open: '10:00', close: '16:00', active: false },
  },
};

export const demoServices = [
  { id: 's1', name: 'Corte Clássico', duration_minutes: 30, price: 45, featured: true, category_id: 'cat1', active: true, description: 'Corte tradicional com acabamento impecável', company_id: 'demo-company' },
  { id: 's2', name: 'Barba Completa', duration_minutes: 30, price: 40, featured: true, category_id: 'cat1', active: true, description: 'Toalha quente, navalha e hidratação', company_id: 'demo-company' },
  { id: 's3', name: 'Corte + Barba', duration_minutes: 60, price: 75, featured: true, category_id: 'cat1', active: true, description: 'O combo mais pedido da casa', company_id: 'demo-company' },
  { id: 's4', name: 'Acabamento', duration_minutes: 15, price: 25, featured: false, category_id: 'cat1', active: true, description: 'Finalização com pente e tesoura', company_id: 'demo-company' },
  { id: 's5', name: 'Sobrancelha', duration_minutes: 15, price: 20, featured: false, category_id: 'cat2', active: true, description: 'Design e acabamento da sobrancelha', company_id: 'demo-company' },
  { id: 's6', name: 'Hidratação', duration_minutes: 20, price: 35, featured: false, category_id: 'cat2', active: true, description: 'Tratamento profundo para cabelo e barba', company_id: 'demo-company' },
];

export const demoProfessionals = [
  { id: 'p1', name: 'Carlos Henrique', specialty: 'Corte & Degradê', active: true, company_id: 'demo-company', commission_type: 'percent', commission_value: 40, photo_url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=150&h=150&fit=crop&auto=format', service_ids: ['s1','s2','s3','s4'] },
  { id: 'p2', name: 'Rafael Torres', specialty: 'Barba & Navalha', active: true, company_id: 'demo-company', commission_type: 'percent', commission_value: 40, photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&auto=format', service_ids: ['s1','s2','s3','s5'] },
  { id: 'p3', name: 'Lucas Mendes', specialty: 'Coloração & Tratamento', active: true, company_id: 'demo-company', commission_type: 'percent', commission_value: 35, photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&auto=format', service_ids: ['s1','s3','s6'] },
];

export const demoCustomers = [
  { id: 'c1', name: 'André Souza', phone: '(11) 99001-1111', email: 'andre@email.com', total_appointments: 14, last_appointment_at: '2026-04-28T10:00:00Z', last_completed_at: '2026-04-28T10:00:00Z', favorite_service: 'Corte + Barba', tags: ['recorrente'], status: 'vip', lifecycle_status: 'fiel', company_id: 'demo-company' },
  { id: 'c2', name: 'Bruno Lima', phone: '(11) 99002-2222', email: 'bruno@email.com', total_appointments: 8, last_appointment_at: '2026-04-15T11:00:00Z', last_completed_at: '2026-04-15T11:00:00Z', favorite_service: 'Corte Clássico', tags: ['recorrente'], status: 'active', lifecycle_status: 'fiel', company_id: 'demo-company' },
  { id: 'c3', name: 'Caio Martins', phone: '(11) 99003-3333', email: 'caio@email.com', total_appointments: 3, last_appointment_at: '2026-03-10T14:00:00Z', last_completed_at: '2026-03-10T14:00:00Z', favorite_service: 'Barba Completa', tags: [], status: 'inactive', lifecycle_status: 'em_risco', company_id: 'demo-company' },
  { id: 'c4', name: 'Diego Fernandes', phone: '(11) 99004-4444', email: 'diego@email.com', total_appointments: 22, last_appointment_at: '2026-05-01T09:00:00Z', last_completed_at: '2026-05-01T09:00:00Z', favorite_service: 'Corte + Barba', tags: ['recorrente'], status: 'vip', lifecycle_status: 'fiel', company_id: 'demo-company' },
  { id: 'c5', name: 'Eduardo Costa', phone: '(11) 99005-5555', email: 'edu@email.com', total_appointments: 5, last_appointment_at: '2026-02-20T10:00:00Z', last_completed_at: '2026-02-20T10:00:00Z', favorite_service: 'Corte Clássico', tags: [], status: 'inactive', lifecycle_status: 'inativo', company_id: 'demo-company' },
  { id: 'c6', name: 'Fábio Rocha', phone: '(11) 99006-6666', email: 'fabio@email.com', total_appointments: 11, last_appointment_at: '2026-04-30T15:00:00Z', last_completed_at: '2026-04-30T15:00:00Z', favorite_service: 'Corte Clássico', tags: ['recorrente'], status: 'active', lifecycle_status: 'fiel', company_id: 'demo-company' },
  { id: 'c7', name: 'Gabriel Nunes', phone: '(11) 99007-7777', email: 'gabriel@email.com', total_appointments: 2, last_appointment_at: '2026-01-15T10:00:00Z', last_completed_at: '2026-01-15T10:00:00Z', favorite_service: 'Sobrancelha', tags: [], status: 'inactive', lifecycle_status: 'perdido', company_id: 'demo-company' },
  { id: 'c8', name: 'Henrique Dias', phone: '(11) 99008-8888', email: 'henrique@email.com', total_appointments: 18, last_appointment_at: '2026-05-05T11:00:00Z', last_completed_at: '2026-05-05T11:00:00Z', favorite_service: 'Corte + Barba', tags: ['recorrente'], status: 'vip', lifecycle_status: 'fiel', company_id: 'demo-company' },
  { id: 'c9', name: 'Igor Santos', phone: '(11) 99009-9999', email: 'igor@email.com', total_appointments: 6, last_appointment_at: '2026-04-20T14:00:00Z', last_completed_at: '2026-04-20T14:00:00Z', favorite_service: 'Corte Clássico', tags: [], status: 'active', lifecycle_status: 'fiel', company_id: 'demo-company' },
  { id: 'c10', name: 'João Pedro', phone: '(11) 99010-0000', email: 'joao@email.com', total_appointments: 4, last_appointment_at: '2026-04-10T09:00:00Z', last_completed_at: '2026-04-10T09:00:00Z', favorite_service: 'Barba Completa', tags: [], status: 'active', lifecycle_status: 'em_risco', company_id: 'demo-company' },
  { id: 'c11', name: 'Kleber Mota', phone: '(11) 99011-1111', email: 'kleber@email.com', total_appointments: 9, last_appointment_at: '2026-03-25T10:00:00Z', last_completed_at: '2026-03-25T10:00:00Z', favorite_service: 'Corte + Barba', tags: [], status: 'active', lifecycle_status: 'em_risco', company_id: 'demo-company' },
  { id: 'c12', name: 'Leonardo Alves', phone: '(11) 99012-2222', email: 'leo@email.com', total_appointments: 1, last_appointment_at: '2026-05-14T10:00:00Z', last_completed_at: '2026-05-14T10:00:00Z', favorite_service: 'Corte Clássico', tags: [], status: 'active', lifecycle_status: 'primeira_visita', company_id: 'demo-company' },
];

// ─── Helper para gerar datas relativas ───────────────────────────────────────
const now = new Date();
const t = (daysOffset, hour, min = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

export const demoAppointments = [
  // ── Hoje ──
  { id: 'a1',  customer_id: 'c1',  professional_id: 'p1', service_id: 's3', customer_name: 'André Souza',     professional_name: 'Carlos Henrique', service_name: 'Corte + Barba',  scheduled_at: t(0,9),   status: 'confirmado',    price: 75, source: 'online',   company_id: 'demo-company' },
  { id: 'a2',  customer_id: 'c4',  professional_id: 'p2', service_id: 's2', customer_name: 'Diego Fernandes', professional_name: 'Rafael Torres',   service_name: 'Barba Completa', scheduled_at: t(0,10),  status: 'em_atendimento',price: 40, source: 'online',   company_id: 'demo-company' },
  { id: 'a3',  customer_id: 'c8',  professional_id: 'p3', service_id: 's1', customer_name: 'Henrique Dias',   professional_name: 'Lucas Mendes',    service_name: 'Corte Clássico', scheduled_at: t(0,11),  status: 'agendado',      price: 45, source: 'interno',  company_id: 'demo-company' },
  { id: 'a4',  customer_id: 'c2',  professional_id: 'p1', service_id: 's1', customer_name: 'Bruno Lima',      professional_name: 'Carlos Henrique', service_name: 'Corte Clássico', scheduled_at: t(0,14),  status: 'agendado',      price: 45, source: 'online',   company_id: 'demo-company' },
  { id: 'a5',  customer_id: 'c6',  professional_id: 'p2', service_id: 's3', customer_name: 'Fábio Rocha',     professional_name: 'Rafael Torres',   service_name: 'Corte + Barba',  scheduled_at: t(0,15),  status: 'agendado',      price: 75, source: 'online',   company_id: 'demo-company' },
  { id: 'a5b', customer_id: 'c9',  professional_id: 'p3', service_id: 's3', customer_name: 'Igor Santos',     professional_name: 'Lucas Mendes',    service_name: 'Corte + Barba',  scheduled_at: t(0,16),  status: 'agendado',      price: 75, source: 'online',   company_id: 'demo-company' },
  // ── Ontem ──
  { id: 'a6',  customer_id: 'c1',  professional_id: 'p1', service_id: 's3', customer_name: 'André Souza',     professional_name: 'Carlos Henrique', service_name: 'Corte + Barba',  scheduled_at: t(-1,9),  status: 'concluido',     price: 75, source: 'online',   company_id: 'demo-company' },
  { id: 'a7',  customer_id: 'c2',  professional_id: 'p2', service_id: 's2', customer_name: 'Bruno Lima',      professional_name: 'Rafael Torres',   service_name: 'Barba Completa', scheduled_at: t(-1,11), status: 'concluido',     price: 40, source: 'interno',  company_id: 'demo-company' },
  { id: 'a8',  customer_id: 'c3',  professional_id: 'p3', service_id: 's1', customer_name: 'Caio Martins',    professional_name: 'Lucas Mendes',    service_name: 'Corte Clássico', scheduled_at: t(-1,14), status: 'faltou',        price: 45, source: 'online',   company_id: 'demo-company' },
  { id: 'a8b', customer_id: 'c10', professional_id: 'p1', service_id: 's2', customer_name: 'João Pedro',      professional_name: 'Carlos Henrique', service_name: 'Barba Completa', scheduled_at: t(-1,15), status: 'concluido',     price: 40, source: 'interno',  company_id: 'demo-company' },
  // ── Amanhã ──
  { id: 'a9',  customer_id: 'c4',  professional_id: 'p1', service_id: 's3', customer_name: 'Diego Fernandes', professional_name: 'Carlos Henrique', service_name: 'Corte + Barba',  scheduled_at: t(1,10),  status: 'agendado',      price: 75, source: 'online',   company_id: 'demo-company' },
  { id: 'a10', customer_id: 'c8',  professional_id: 'p2', service_id: 's2', customer_name: 'Henrique Dias',   professional_name: 'Rafael Torres',   service_name: 'Barba Completa', scheduled_at: t(1,14),  status: 'agendado',      price: 40, source: 'online',   company_id: 'demo-company' },
  { id: 'a11', customer_id: 'c11', professional_id: 'p3', service_id: 's1', customer_name: 'Kleber Mota',     professional_name: 'Lucas Mendes',    service_name: 'Corte Clássico', scheduled_at: t(1,11),  status: 'agendado',      price: 45, source: 'interno',  company_id: 'demo-company' },
  // ── Semana passada (histórico) ──
  { id: 'a12', customer_id: 'c6',  professional_id: 'p1', service_id: 's3', customer_name: 'Fábio Rocha',     professional_name: 'Carlos Henrique', service_name: 'Corte + Barba',  scheduled_at: t(-7,9),  status: 'concluido',     price: 75, source: 'online',   company_id: 'demo-company' },
  { id: 'a13', customer_id: 'c9',  professional_id: 'p2', service_id: 's1', customer_name: 'Igor Santos',     professional_name: 'Rafael Torres',   service_name: 'Corte Clássico', scheduled_at: t(-7,11), status: 'concluido',     price: 45, source: 'interno',  company_id: 'demo-company' },
  { id: 'a14', customer_id: 'c4',  professional_id: 'p1', service_id: 's3', customer_name: 'Diego Fernandes', professional_name: 'Carlos Henrique', service_name: 'Corte + Barba',  scheduled_at: t(-5,10), status: 'concluido',     price: 75, source: 'online',   company_id: 'demo-company' },
  { id: 'a15', customer_id: 'c8',  professional_id: 'p3', service_id: 's6', customer_name: 'Henrique Dias',   professional_name: 'Lucas Mendes',    service_name: 'Hidratação',     scheduled_at: t(-5,14), status: 'concluido',     price: 35, source: 'interno',  company_id: 'demo-company' },
  { id: 'a16', customer_id: 'c12', professional_id: 'p2', service_id: 's1', customer_name: 'Leonardo Alves',  professional_name: 'Rafael Torres',   service_name: 'Corte Clássico', scheduled_at: t(-2,10), status: 'concluido',     price: 45, source: 'online',   company_id: 'demo-company' },
];

// Datas relativas para financeiro (mantém offset dos últimos 30 dias)
const d = (daysBack) => {
  const date = new Date(now);
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().slice(0, 10);
};

export const demoFinancial = [
  { id: 'f1',  type: 'entrada', description: 'Corte + Barba - André Souza',      amount: 75,   date: d(0),  category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'pix',            company_id: 'demo-company' },
  { id: 'f2',  type: 'entrada', description: 'Barba Completa - Bruno Lima',       amount: 40,   date: d(0),  category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'dinheiro',        company_id: 'demo-company' },
  { id: 'f3',  type: 'entrada', description: 'Corte Clássico - Diego Fernandes',  amount: 45,   date: d(1),  category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'cartao_debito',   company_id: 'demo-company' },
  { id: 'f4',  type: 'saida',   description: 'Produtos de barba',                  amount: 120,  date: d(2),  category: 'Suprimentos', status: 'confirmado', origin: 'manual',      payment_method: 'dinheiro',        company_id: 'demo-company' },
  { id: 'f5',  type: 'entrada', description: 'Corte + Barba - Fábio Rocha',       amount: 75,   date: d(2),  category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'pix',            company_id: 'demo-company' },
  { id: 'f6',  type: 'entrada', description: 'Corte Clássico - Caio Martins',     amount: 45,   date: d(3),  category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'dinheiro',        company_id: 'demo-company' },
  { id: 'f7',  type: 'saida',   description: 'Aluguel',                            amount: 2500, date: d(5),  category: 'Fixo',        status: 'confirmado', origin: 'manual',      payment_method: 'pix',            company_id: 'demo-company' },
  { id: 'f8',  type: 'entrada', description: 'Corte + Barba - Henrique Dias',     amount: 75,   date: d(4),  category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'cartao_credito',  company_id: 'demo-company' },
  { id: 'f9',  type: 'entrada', description: 'Assinatura — André Souza',           amount: 149,  date: d(6),  category: 'Assinatura',  status: 'confirmado', origin: 'assinatura',  payment_method: 'link_pagamento',  company_id: 'demo-company' },
  { id: 'f10', type: 'entrada', description: 'Assinatura — Diego Fernandes',       amount: 149,  date: d(6),  category: 'Assinatura',  status: 'confirmado', origin: 'assinatura',  payment_method: 'link_pagamento',  company_id: 'demo-company' },
  { id: 'f11', type: 'entrada', description: 'Corte Clássico - Igor Santos',       amount: 45,   date: d(7),  category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'dinheiro',        company_id: 'demo-company' },
  { id: 'f12', type: 'saida',   description: 'Água mineral e café',                amount: 80,   date: d(8),  category: 'Suprimentos', status: 'confirmado', origin: 'manual',      payment_method: 'dinheiro',        company_id: 'demo-company' },
  { id: 'f13', type: 'entrada', description: 'Corte + Barba - Fábio Rocha',       amount: 75,   date: d(9),  category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'pix',            company_id: 'demo-company' },
  { id: 'f14', type: 'entrada', description: 'Barba Completa - João Pedro',        amount: 40,   date: d(10), category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'dinheiro',        company_id: 'demo-company' },
  { id: 'f15', type: 'entrada', description: 'Hidratação - Henrique Dias',         amount: 35,   date: d(12), category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'cartao_credito',  company_id: 'demo-company' },
  { id: 'f16', type: 'saida',   description: 'Material de limpeza',                amount: 60,   date: d(14), category: 'Suprimentos', status: 'confirmado', origin: 'manual',      payment_method: 'dinheiro',        company_id: 'demo-company' },
  { id: 'f17', type: 'entrada', description: 'Corte + Barba - Diego Fernandes',   amount: 75,   date: d(15), category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'pix',            company_id: 'demo-company' },
  { id: 'f18', type: 'entrada', description: 'Corte Clássico - Bruno Lima',        amount: 45,   date: d(18), category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'dinheiro',        company_id: 'demo-company' },
  { id: 'f19', type: 'saida',   description: 'Marketing redes sociais',            amount: 200,  date: d(20), category: 'Marketing',   status: 'confirmado', origin: 'manual',      payment_method: 'pix',            company_id: 'demo-company' },
  { id: 'f20', type: 'entrada', description: 'Corte + Barba - Kleber Mota',       amount: 75,   date: d(22), category: 'Atendimento', status: 'confirmado', origin: 'agendamento', payment_method: 'dinheiro',        company_id: 'demo-company' },
];

export const demoAIInsights = [
  { id: 'ai1', type: 'reativacao',     title: '12 clientes inativos detectados',        description: 'Esses clientes não aparecem há mais de 30 dias. Frequência histórica era de 15 dias.',                    priority: 'alta',  count: 12, message: 'Ei, [Nome]! Faz tempo que não te vemos por aqui no Studio 47 😎 Que tal garantir seu horário essa semana? Está sobrando espaço!' },
  { id: 'ai2', type: 'horario_fraco',  title: 'Segunda-feira 13h–15h sem agendamentos', description: 'Nas últimas 4 semanas, esse horário ficou vazio. Considere uma promoção pontual.',                       priority: 'media', count: 4,  message: 'Lançamento especial Studio 47: segunda-feira das 13h às 15h com 20% de desconto. Vagas limitadas! Agende agora.' },
  { id: 'ai3', type: 'vip_ausente',    title: '3 clientes VIP sem retorno em 21 dias',  description: 'Clientes que historicamente gastam mais de R$200/mês estão com retorno atrasado.',                       priority: 'alta',  count: 3,  message: 'Olá, [Nome]! Seu lugar preferido no Studio 47 está esperando por você. Agendamento disponível esta semana, é só confirmar!' },
  { id: 'ai4', type: 'servico_baixo',  title: 'Hidratação vendida apenas 2x este mês',  description: 'Serviço tem boa margem mas baixa demanda. Experimente oferecer como combo.',                             priority: 'baixa', count: 2,  message: 'Dica Studio 47: que tal incluir nossa hidratação no seu próximo corte? 20 min extras que fazem toda a diferença!' },
];

export const demoReviews = [
  { id: 'r1', customer_name: 'André Souza',     rating: 5, comment: 'Atendimento impecável! Carlos manda muito bem no degradê.',         professional_name: 'Carlos Henrique', service_name: 'Corte + Barba',  published: true, submitted_at: t(-3, 18), company_id: 'demo-company' },
  { id: 'r2', customer_name: 'Diego Fernandes', rating: 5, comment: 'Melhor barbearia da vila! Rafael tem mão de ouro na barba.',          professional_name: 'Rafael Torres',   service_name: 'Barba Completa', published: true, submitted_at: t(-8, 14), company_id: 'demo-company' },
  { id: 'r3', customer_name: 'Henrique Dias',   rating: 4, comment: 'Ótimo atendimento, ambiente agradável. Voltarei sempre.',             professional_name: 'Lucas Mendes',    service_name: 'Corte Clássico', published: true, submitted_at: t(-12,11), company_id: 'demo-company' },
  { id: 'r4', customer_name: 'Fábio Rocha',     rating: 5, comment: 'Studio 47 é referência! Sempre saio satisfeito.',                     professional_name: 'Carlos Henrique', service_name: 'Corte + Barba',  published: true, submitted_at: t(-15,16), company_id: 'demo-company' },
  { id: 'r5', customer_name: 'Bruno Lima',      rating: 4, comment: 'Equipe simpática, ambiente limpo. Recomendo muito.',                  professional_name: 'Rafael Torres',   service_name: 'Corte Clássico', published: true, submitted_at: t(-20,10), company_id: 'demo-company' },
];

export const demoSubscriptions = [
  { id: 'sub1', customer_id: 'c1', customer_name: 'André Souza',     plan_id: 'plan1', plan_name: 'Plano Mensal',  plan_price_snapshot: 149, status: 'active', uses_remaining: 2, plan_type_snapshot: 'limited', current_cycle_end: t(15, 23), company_id: 'demo-company' },
  { id: 'sub2', customer_id: 'c4', customer_name: 'Diego Fernandes', plan_id: 'plan1', plan_name: 'Plano Mensal',  plan_price_snapshot: 149, status: 'active', uses_remaining: 3, plan_type_snapshot: 'limited', current_cycle_end: t(20, 23), company_id: 'demo-company' },
  { id: 'sub3', customer_id: 'c8', customer_name: 'Henrique Dias',   plan_id: 'plan2', plan_name: 'Plano Premium', plan_price_snapshot: 249, status: 'active', uses_remaining: null, plan_type_snapshot: 'unlimited', current_cycle_end: t(12, 23), company_id: 'demo-company' },
];

export const demoTeamMembers = [
  { id: 'tm1', name: 'Carlos Henrique', email: 'carlos@studio47.com', role: 'barbeiro', active: true, professional_id: 'p1', company_id: 'demo-company' },
  { id: 'tm2', name: 'Rafael Torres',   email: 'rafael@studio47.com', role: 'barbeiro', active: true, professional_id: 'p2', company_id: 'demo-company' },
  { id: 'tm3', name: 'Lucas Mendes',    email: 'lucas@studio47.com',  role: 'barbeiro', active: true, professional_id: 'p3', company_id: 'demo-company' },
  { id: 'tm4', name: 'Mariana Costa',   email: 'mariana@studio47.com', role: 'recepcao', active: true, professional_id: null, company_id: 'demo-company' },
];

export const demoCommissions = [
  { id: 'com1', professional_id: 'p1', professional_name: 'Carlos Henrique', appointment_id: 'a6',  service_name: 'Corte + Barba',  amount: 30,   date: d(1), status: 'pendente', company_id: 'demo-company' },
  { id: 'com2', professional_id: 'p2', professional_name: 'Rafael Torres',   appointment_id: 'a7',  service_name: 'Barba Completa', amount: 16,   date: d(1), status: 'pendente', company_id: 'demo-company' },
  { id: 'com3', professional_id: 'p1', professional_name: 'Carlos Henrique', appointment_id: 'a14', service_name: 'Corte + Barba',  amount: 30,   date: d(5), status: 'pago',     company_id: 'demo-company' },
  { id: 'com4', professional_id: 'p3', professional_name: 'Lucas Mendes',    appointment_id: 'a15', service_name: 'Hidratação',     amount: 12.25,date: d(5), status: 'pago',     company_id: 'demo-company' },
];