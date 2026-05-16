// Gerador automático de planos de assinatura baseado em comportamento real.
//
// Analisa últimos 180 dias e calcula:
//  - Frequência média de visitas por cliente (FM, visitas/mês)
//  - Ticket médio (ARPU por atendimento)
//  - Capacidade mensal estimada
//  - Ocupação atual (%)
//  - Distribuição de frequência dos clientes (segmenta tiers de plano)
//
// Aplica fator de desconto dinâmico:
//  - >85% ocupação  → 5–10% desconto
//  - 60–85%         → 10–20% desconto
//  - <60%           → 20–35% desconto (incentivo agressivo)
//
// Retorna 3-4 planos sugeridos com nome, preço, formato, margem estimada e
// quantos clientes se encaixariam em cada tier.
//
// Modos de uso:
//  - { action: 'analyze' } → apenas retorna sugestões (preview)
//  - { action: 'create', plans: [...] } → cria como rascunho (active=false)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ANALYSIS_DAYS = 180;
const DAYS_PER_MONTH = 30;
const MONTHS_IN_WINDOW = ANALYSIS_DAYS / DAYS_PER_MONTH;

function getDiscountFactor(occupancyPct) {
  // Retorna { factorMin, factorMax, label } onde factor é multiplicador (ex: 0.85 = 15% desconto)
  if (occupancyPct >= 85) return { min: 0.90, max: 0.95, label: 'Alta demanda — desconto conservador' };
  if (occupancyPct >= 60) return { min: 0.80, max: 0.90, label: 'Demanda moderada — desconto balanceado' };
  return { min: 0.65, max: 0.80, label: 'Baixa ocupação — desconto agressivo para preencher agenda' };
}

function roundPrice(value) {
  // Arredonda para múltiplo de 5 e termina em 9 (psicológico)
  if (value < 30) return Math.max(19, Math.round(value / 5) * 5 - 1);
  return Math.round(value / 10) * 10 - 1; // 89, 99, 119, 149...
}

// REGRA CRÍTICA: nenhum plano pode ter margem negativa.
// Custo assumido por atendimento = 60% do ticket médio (insumos + comissão típica).
// Margem mínima saudável = 25%. Margem aceitável (atenção) = 10%.
const COST_RATIO = 0.60;
const SAFE_MARGIN_PCT = 25;
const WARN_MARGIN_PCT = 10;

// Calcula preço mínimo seguro para garantir margem >= SAFE_MARGIN_PCT
// Fórmula: margin = (price - cost) / price >= 0.25  →  price >= cost / 0.75
function minSafePrice(expectedUses, ticketMedio) {
  const cost = expectedUses * ticketMedio * COST_RATIO;
  return cost / (1 - SAFE_MARGIN_PCT / 100);
}

function classifyMargin(marginPct) {
  if (marginPct >= SAFE_MARGIN_PCT) return 'safe';      // 🟢 saudável
  if (marginPct >= WARN_MARGIN_PCT) return 'warn';      // 🟡 atenção
  return 'risk';                                         // 🔴 prejuízo / risco
}

// Aplica preço mínimo seguro e recalcula margem.
// Retorna { price, marginPct, adjusted }
function ensureSafePrice(rawPrice, expectedUses, ticketMedio) {
  const minPrice = minSafePrice(expectedUses, ticketMedio);
  let finalPrice = rawPrice;
  let adjusted = false;
  if (finalPrice < minPrice) {
    finalPrice = roundPrice(minPrice);
    adjusted = true;
  }
  const cost = expectedUses * ticketMedio * COST_RATIO;
  const marginPct = finalPrice > 0 ? Math.round(((finalPrice - cost) / finalPrice) * 100) : 0;
  return { price: finalPrice, marginPct, adjusted, health: classifyMargin(marginPct) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { company_id, action = 'analyze', plans: plansToCreate = [] } = body;
    if (!company_id) return Response.json({ error: 'company_id obrigatório' }, { status: 400 });

    // Verifica acesso à empresa (resiliente: filtra em vez de get-by-id)
    const [teamMembers, companies] = await Promise.all([
      base44.asServiceRole.entities.TeamMember.filter({ company_id, email: user.email }),
      base44.asServiceRole.entities.Company.filter({ id: company_id }).catch(() => []),
    ]);
    if (companies.length === 0) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
    const company = companies[0];
    const userEmailLc = (user.email || '').toLowerCase();
    const ownerEmailLc = (company?.owner_email || '').toLowerCase();
    const isOwner = !!ownerEmailLc && ownerEmailLc === userEmailLc;
    const isMember = teamMembers.length > 0 && ['admin', 'recepcao', 'financeiro'].includes(teamMembers[0]?.role);
    const isSuperAdmin = user.role === 'admin'; // super admin Base44
    if (!isOwner && !isMember && !isSuperAdmin) {
      console.warn('[generatePlanSuggestions] sem permissão:', {
        user_email: userEmailLc, owner_email: ownerEmailLc, team_role: teamMembers[0]?.role, base44_role: user.role,
      });
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // ─── MODO CREATE: cria os planos como rascunho ─────────────────────────
    if (action === 'create') {
      if (!Array.isArray(plansToCreate) || plansToCreate.length === 0) {
        return Response.json({ error: 'Lista de planos vazia' }, { status: 400 });
      }
      const created = [];
      for (const p of plansToCreate) {
        const newPlan = await base44.asServiceRole.entities.CustomerPlan.create({
          company_id,
          name: p.name,
          description: p.description || '',
          price_monthly: p.price_monthly,
          type: p.type,
          usage_limit: p.usage_limit || undefined,
          rollover: false,
          active: false, // SEMPRE como rascunho
        });
        created.push(newPlan);
      }
      return Response.json({ success: true, created_count: created.length, created });
    }

    // ─── MODO ANALYZE: análise + sugestões ─────────────────────────────────
    const since = new Date();
    since.setDate(since.getDate() - ANALYSIS_DAYS);
    const sinceISO = since.toISOString();

    // Carrega dados (limites altos para clientes com volume)
    const [appointments, customers, services, professionals, activeSubs, activePlans] = await Promise.all([
      base44.asServiceRole.entities.Appointment.filter({ company_id }, '-scheduled_at', 5000),
      base44.asServiceRole.entities.Customer.filter({ company_id }, '-created_date', 5000),
      base44.asServiceRole.entities.Service.filter({ company_id, active: true }),
      base44.asServiceRole.entities.Professional.filter({ company_id, active: true }),
      base44.asServiceRole.entities.CustomerSubscription.filter({ company_id, status: 'active' }),
      base44.asServiceRole.entities.CustomerPlan.filter({ company_id, active: true }),
    ]);

    // Filtra agendamentos da janela e somente concluídos (efetivos)
    const concluded = appointments.filter(a =>
      a.status === 'concluido' && a.scheduled_at >= sinceISO,
    );

    if (concluded.length < 10) {
      return Response.json({
        success: true,
        insufficient_data: true,
        message: 'Histórico insuficiente. São necessários ao menos 10 atendimentos concluídos nos últimos 180 dias para gerar sugestões confiáveis.',
        metrics: { total_concluded: concluded.length },
      });
    }

    // ─── MÉTRICAS BASE ─────────────────────────────────────────────────────
    const totalRevenue = concluded.reduce((sum, a) => sum + (a.price || 0), 0);
    const ticketMedio = totalRevenue / concluded.length;

    // Frequência por cliente (visitas por mês)
    const visitsByCustomer = {};
    concluded.forEach(a => {
      if (!a.customer_id) return;
      visitsByCustomer[a.customer_id] = (visitsByCustomer[a.customer_id] || 0) + 1;
    });
    const customerIdsWithVisits = Object.keys(visitsByCustomer);
    const totalCustomers = customerIdsWithVisits.length || 1;

    // FM = média de visitas/mês entre clientes ativos
    const totalVisits = concluded.length;
    const fm = (totalVisits / totalCustomers) / MONTHS_IN_WINDOW;

    // Distribuição de clientes por faixa de frequência mensal
    const segments = { low: 0, mid: 0, high: 0 }; // <1.2, 1.2-2.5, >2.5
    customerIdsWithVisits.forEach(id => {
      const visitsPerMonth = visitsByCustomer[id] / MONTHS_IN_WINDOW;
      if (visitsPerMonth < 1.2) segments.low++;
      else if (visitsPerMonth < 2.5) segments.mid++;
      else segments.high++;
    });

    // Capacidade mensal estimada
    // Assumimos 8h/dia × 26 dias úteis × N profissionais ÷ tempo médio de serviço
    const avgServiceDuration = services.length > 0
      ? services.reduce((s, sv) => s + (sv.duration_minutes || 30), 0) / services.length
      : 30;
    const proCount = Math.max(1, professionals.length);
    const capacityMonthly = Math.floor((8 * 60 * 26 * proCount) / avgServiceDuration);

    // Ocupação atual: visitas/mês média ÷ capacidade
    const visitsPerMonth = totalVisits / MONTHS_IN_WINDOW;
    const occupancyPct = Math.min(100, (visitsPerMonth / capacityMonthly) * 100);

    const discount = getDiscountFactor(occupancyPct);

    // ─── GERAÇÃO DE PLANOS ─────────────────────────────────────────────────
    const suggestions = [];

    // Plano 1: Básico (1 corte/mês) — alvo: clientes esporádicos (segments.low)
    {
      const expectedUses = 1;
      const baseValue = ticketMedio * expectedUses;
      const factor = (discount.min + discount.max) / 2;
      const rawPrice = roundPrice(baseValue * factor);
      const safe = ensureSafePrice(rawPrice, expectedUses, ticketMedio);
      suggestions.push({
        name: 'Plano Essencial',
        description: '1 corte por mês — ideal para quem mantém o visual em dia.',
        price_monthly: safe.price,
        type: 'limited',
        usage_limit: 1,
        target_segment: 'Clientes que vêm 1x/mês',
        target_count: segments.low,
        avulso_equivalent: Math.round(baseValue),
        savings: Math.max(0, Math.round(baseValue - safe.price)),
        margin_pct: safe.marginPct,
        margin_health: safe.health,
        price_adjusted: safe.adjusted,
        discount_pct: Math.round((1 - factor) * 100),
      });
    }

    // Plano 2: Intermediário (2 cortes/mês) — alvo: clientes regulares
    {
      const expectedUses = 2;
      const baseValue = ticketMedio * expectedUses;
      const factor = discount.min; // desconto maior em volume
      const rawPrice = roundPrice(baseValue * factor);
      const safe = ensureSafePrice(rawPrice, expectedUses, ticketMedio);
      suggestions.push({
        name: 'Plano Regular',
        description: '2 cortes por mês — para quem se cuida com frequência.',
        price_monthly: safe.price,
        type: 'limited',
        usage_limit: 2,
        target_segment: 'Clientes que vêm 2x/mês',
        target_count: segments.mid,
        avulso_equivalent: Math.round(baseValue),
        savings: Math.max(0, Math.round(baseValue - safe.price)),
        margin_pct: safe.marginPct,
        margin_health: safe.health,
        price_adjusted: safe.adjusted,
        discount_pct: Math.round((1 - factor) * 100),
        recommended: segments.mid >= segments.low && segments.mid >= segments.high,
      });
    }

    // Plano 3: Premium — 4 cortes ou ilimitado (decisão depende da ocupação)
    {
      const useUnlimited = occupancyPct < 70 && segments.high > 0;
      const expectedUses = useUnlimited ? 4.5 : 4;
      const baseValue = ticketMedio * expectedUses;
      const factor = discount.min - 0.05;
      const rawPrice = roundPrice(baseValue * Math.max(0.55, factor));
      const safe = ensureSafePrice(rawPrice, expectedUses, ticketMedio);
      suggestions.push({
        name: useUnlimited ? 'Plano VIP Ilimitado' : 'Plano Premium',
        description: useUnlimited
          ? 'Cortes ilimitados durante o mês. Para os mais exigentes.'
          : '4 cortes por mês — barba e cabelo sempre no ponto.',
        price_monthly: safe.price,
        type: useUnlimited ? 'unlimited' : 'limited',
        usage_limit: useUnlimited ? undefined : 4,
        target_segment: useUnlimited ? 'Clientes alto volume' : 'Clientes 3-4x/mês',
        target_count: segments.high,
        avulso_equivalent: Math.round(baseValue),
        savings: Math.max(0, Math.round(baseValue - safe.price)),
        margin_pct: safe.marginPct,
        margin_health: safe.health,
        price_adjusted: safe.adjusted,
        discount_pct: Math.round((1 - Math.max(0.55, factor)) * 100),
      });
    }

    // Plano 4: Off-peak — só quando ocupação <70% (ociosidade real)
    if (occupancyPct < 70) {
      const expectedUses = 2;
      const baseValue = ticketMedio * expectedUses;
      const factor = 0.55; // desconto bem agressivo
      const rawPrice = roundPrice(baseValue * factor);
      const safe = ensureSafePrice(rawPrice, expectedUses, ticketMedio);
      suggestions.push({
        name: 'Plano Off-Peak',
        description: '2 cortes/mês em horários de menor movimento (manhãs/cedo).',
        price_monthly: safe.price,
        type: 'limited',
        usage_limit: 2,
        target_segment: 'Clientes flexíveis',
        target_count: Math.round(totalCustomers * 0.2),
        avulso_equivalent: Math.round(baseValue),
        savings: Math.max(0, Math.round(baseValue - safe.price)),
        margin_pct: safe.marginPct,
        margin_health: safe.health,
        price_adjusted: safe.adjusted,
        discount_pct: Math.round((1 - factor) * 100),
        off_peak: true,
      });
    }

    // ─── PROJEÇÕES DE IMPACTO ──────────────────────────────────────────────
    // Estimativa conservadora: 30% dos clientes do tier convertem para assinatura
    const conversionRate = 0.30;
    const projectedMRR = suggestions.reduce((sum, s) => {
      return sum + (s.price_monthly * (s.target_count || 0) * conversionRate);
    }, 0);

    // ─── MÉTRICAS DE CONVERSÃO ────────────────────────────────────────────────
    // Critério de elegibilidade alinhado com lib/subscriptionEligibility.js:
    // cliente elegível = frequência >= 0.8x/mês (nos últimos 180 dias) E sem assinatura ativa.
    // Antes: usava "2+ visitas nos últimos 30 dias" — critério muito volátil.
    // Agora: usa janela de 180 dias / 6 meses para estabilidade e coerência com a tela de Clientes.
    const ELIG_MIN_VISITS_PER_MONTH = 0.8;
    const subscriberIds = new Set(activeSubs.map(s => s.customer_id));

    // Agrupa visitas por cliente na janela de 180 dias (já filtrado em concluded)
    const visits180ByCustomer = {};
    concluded.forEach(a => {
      if (!a.customer_id) return;
      visits180ByCustomer[a.customer_id] = (visits180ByCustomer[a.customer_id] || 0) + 1;
    });

    // Calcula frequência mensal e aplica critério central
    const eligibleIds = Object.keys(visits180ByCustomer).filter(cid => {
      if (subscriberIds.has(cid)) return false;
      const visitsPerMonth = visits180ByCustomer[cid] / MONTHS_IN_WINDOW;
      return visitsPerMonth >= ELIG_MIN_VISITS_PER_MONTH;
    });

    // Clientes ativos = qualquer cliente com visita nos últimos 180 dias
    const totalActiveCustomers = Object.keys(visits180ByCustomer).length;

    // Manter compatibilidade com visits30ByCustomer (usado só para activeCustomers)
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);
    const last30ISO = last30.toISOString();
    const visits30ByCustomer = {};
    concluded.forEach(a => {
      if (!a.customer_id || a.scheduled_at < last30ISO) return;
      visits30ByCustomer[a.customer_id] = (visits30ByCustomer[a.customer_id] || 0) + 1;
    });
    const eligiblePct = totalActiveCustomers > 0
      ? Math.round((eligibleIds.length / totalActiveCustomers) * 100) : 0;
    const convertedPct = totalActiveCustomers > 0
      ? Math.round((subscriberIds.size / totalActiveCustomers) * 100) : 0;

    // Receita potencial = soma do plano mais barato que cobre cada elegível
    const cheapestEligiblePlan = activePlans.length > 0
      ? activePlans.reduce((min, p) => (p.price_monthly < min.price_monthly ? p : min), activePlans[0])
      : null;
    const potentialMRR = cheapestEligiblePlan
      ? eligibleIds.length * cheapestEligiblePlan.price_monthly : 0;
    const currentMRR = activeSubs.reduce((s, sub) => s + (sub.plan_price_snapshot || 0), 0);

    // Detecta base de dados frágil — sugestões serão "chutes". Mostra aviso na UI.
    const lowData = totalCustomers < 10 || concluded.length < 30 || occupancyPct < 5;

    return Response.json({
      success: true,
      low_data: lowData,
      metrics: {
        analysis_window_days: ANALYSIS_DAYS,
        total_concluded: concluded.length,
        total_customers: totalCustomers,
        ticket_medio: Math.round(ticketMedio * 100) / 100,
        frequencia_media_mes: Math.round(fm * 100) / 100,
        capacity_monthly: capacityMonthly,
        occupancy_pct: Math.round(occupancyPct),
        avg_service_duration_min: Math.round(avgServiceDuration),
        professional_count: proCount,
        segments,
        revenue_180d: Math.round(totalRevenue),
        avg_revenue_per_customer: Math.round(totalRevenue / totalCustomers),
      },
      conversion: {
        eligible_count: eligibleIds.length,
        eligible_pct: eligiblePct,
        converted_count: subscriberIds.size,
        converted_pct: convertedPct,
        active_customers_30d: totalActiveCustomers,
        current_mrr: Math.round(currentMRR),
        potential_mrr: Math.round(potentialMRR),
      },
      discount_strategy: discount,
      suggestions,
      projections: {
        conversion_rate_assumed: conversionRate,
        projected_mrr: Math.round(projectedMRR),
        projected_arr: Math.round(projectedMRR * 12),
      },
    });
  } catch (error) {
    console.error('[generatePlanSuggestions] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});