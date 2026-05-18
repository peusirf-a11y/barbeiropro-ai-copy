// OfferPlanModal — IA Comercial de Retenção e Recorrência
// Visual: SaaS enterprise / CRM inteligente
// NÃO altera fluxo de ativação, billing ou subscriptions.

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import {
  X, Sparkles, Loader2, AlertCircle, TrendingUp,
  RefreshCw, Shield, Zap, BarChart2, Target,
} from 'lucide-react';

// ─── Helpers sem placeholder ───────────────────────────────────────────────────
function safeNum(v, fallback = 0) {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}
function safeMoney(v, fallback = 'Em análise') {
  const n = Number(v);
  return isFinite(n) && n > 0 ? `R$${n}` : fallback;
}
function safeMonths(v) {
  const n = Math.round(Number(v));
  return isFinite(n) && n > 0 ? `~${n} meses` : 'Estimativa indisponível';
}

// ─── Deriva label de conversão diretamente do score numérico ──────────────────
// 0–39 → baixa | 40–69 → média | 70–100 → alta
function scoreToLabel(score) {
  const s = safeNum(score);
  if (s >= 70) return 'alta';
  if (s >= 40) return 'média';
  return 'baixa';
}

// ─── Lógica de churn mais inteligente ─────────────────────────────────────────
// Não penaliza cliente 1x/mês. Leva em conta regularidade, histórico e cancelamentos.
function deriveChurnRisk(metrics) {
  const { regularity_score = 0, retention_months = 0, visits_per_month = 0 } = metrics || {};
  if (regularity_score >= 0.55 && retention_months >= 3) return 'baixo';
  if (regularity_score >= 0.3 && retention_months >= 1) return 'médio';
  if (visits_per_month >= 1 && retention_months >= 2) return 'médio';
  return 'alto';
}

// ─── Score header com lógica corrigida ────────────────────────────────────────
function ScoreHeader({ score, metrics }) {
  const label = scoreToLabel(score);
  const s = safeNum(score);
  const cfg = {
    alta:  {
      ring: 'ring-emerald-400/30', dot: 'bg-emerald-500', textColor: 'text-emerald-300',
      title: 'Alta probabilidade de conversão',
      sub: 'Cliente com perfil recorrente e boa chance de fidelização.',
    },
    média: {
      ring: 'ring-amber-400/30', dot: 'bg-amber-400', textColor: 'text-amber-300',
      title: 'Potencial de conversão moderado',
      sub: 'Potencial identificado — abordagem certa aumenta adesão.',
    },
    baixa: {
      ring: 'ring-white/15', dot: 'bg-slate-400', textColor: 'text-white/65',
      title: 'Conversão incerta no momento',
      sub: 'Histórico ainda em formação — oferta pode acelerar fidelização.',
    },
  };
  const c = cfg[label];

  // Barra de score
  const barColor = label === 'alta' ? 'bg-emerald-500' : label === 'média' ? 'bg-amber-400' : 'bg-slate-400';

  return (
    <div className={`bg-white/[0.04] border border-white/10 rounded-xl p-3.5 ring-2 ${c.ring} backdrop-blur-sm`}>
      <div className="flex items-center gap-3">
        {/* Score circular */}
        <div className="flex-shrink-0 text-center">
          <div className={`w-12 h-12 rounded-full ${c.dot} flex items-center justify-center shadow-lg`}>
            <span className="text-white font-black text-base">{Math.round(s)}</span>
          </div>
          <div className={`text-[9px] font-bold mt-0.5 ${c.textColor}`}>/ 100</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[13px] text-white leading-tight">{c.title}</div>
          <div className="text-[11px] text-white/55 mt-0.5 leading-snug">{c.sub}</div>
          {/* Barra de progresso do score */}
          <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.min(100, s)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Insight humanizado (IA comercial) ────────────────────────────────────────
function AiInsight({ score, planHealth, metrics }) {
  const label = scoreToLabel(safeNum(score));
  const healthColor = planHealth?.color || 'blue';

  let type = 'neutral';
  let msg = 'Análise de perfil em andamento.';

  if (label === 'alta' && (healthColor === 'emerald' || healthColor === 'blue')) {
    type = 'success';
    msg = 'Cliente possui perfil recorrente e boa chance de aderir ao plano. Recomendação forte para conversão.';
  } else if (healthColor === 'red') {
    type = 'danger';
    msg = 'Plano pode gerar baixa margem com o comportamento atual. Considere ajustar o preço ou oferecer plano menor.';
  } else if (healthColor === 'amber') {
    type = 'warning';
    msg = 'Margem apertada para este perfil. Monitorar frequência de uso após conversão.';
  } else if (label === 'média') {
    type = 'info';
    msg = 'Potencial de recorrência identificado. Abordagem personalizada pode aumentar a taxa de adesão.';
  } else if (label === 'baixa') {
    type = 'warning';
    msg = 'Cliente ainda possui pouco histórico para previsão confiável. Plano pode acelerar fidelização.';
  }

  const cfg = {
    success: { bg: 'bg-emerald-500/10 border-emerald-400/30', icon: '🟢', text: 'text-emerald-100' },
    info:    { bg: 'bg-blue-500/10 border-blue-400/30',       icon: '🔵', text: 'text-blue-100' },
    warning: { bg: 'bg-amber-500/10 border-amber-400/30',     icon: '🟡', text: 'text-amber-100' },
    danger:  { bg: 'bg-rose-500/10 border-rose-400/30',       icon: '🔴', text: 'text-rose-100' },
    neutral: { bg: 'bg-white/[0.04] border-white/10',         icon: '⚪', text: 'text-white/80' },
  };
  const c = cfg[type];

  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border ${c.bg}`}>
      <span className="text-sm flex-shrink-0 mt-0.5">{c.icon}</span>
      <p className={`text-[12px] font-medium leading-relaxed ${c.text}`}>{msg}</p>
    </div>
  );
}

// ─── Card de margem estimada ───────────────────────────────────────────────────
function MarginCard({ health, profit }) {
  if (!health) return null;
  const cfg = {
    emerald: { bar: 'bg-emerald-500', pct: 85, bg: 'bg-emerald-500/10 border-emerald-400/30', text: 'text-emerald-100' },
    blue:    { bar: 'bg-blue-400',    pct: 65, bg: 'bg-blue-500/10 border-blue-400/30',       text: 'text-blue-100' },
    amber:   { bar: 'bg-amber-400',   pct: 35, bg: 'bg-amber-500/10 border-amber-400/30',     text: 'text-amber-100' },
    red:     { bar: 'bg-rose-400',    pct: 12, bg: 'bg-rose-500/10 border-rose-400/30',       text: 'text-rose-100' },
  };
  const c = cfg[health.color] || cfg.blue;
  return (
    <div className={`rounded-xl border p-3 backdrop-blur-sm ${c.bg}`}>
      <div className={`flex items-center gap-1.5 mb-1.5 ${c.text} opacity-75`}>
        <BarChart2 className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Margem estimada</span>
      </div>
      <div className={`font-black text-base ${c.text}`}>{health.label}</div>
      <div className={`text-[10px] mt-0.5 leading-snug ${c.text} opacity-70`}>{health.description}</div>
      <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${c.pct}%` }} />
      </div>
    </div>
  );
}

// ─── Card de risco × retorno ───────────────────────────────────────────────────
function RiskReturnCard({ health, churnRisk }) {
  // Quadrante simples: risco (eixo Y) × retorno/margem (eixo X)
  const riskLevel = health?.color === 'red' ? 3 : health?.color === 'amber' ? 2 : 1;
  const churnLevel = churnRisk === 'alto' ? 3 : churnRisk === 'médio' ? 2 : 1;
  const combined = (riskLevel + churnLevel) / 2;

  let label, color, bg, desc;
  if (combined <= 1.5) {
    label = 'Baixo risco'; color = 'text-emerald-200'; bg = 'bg-emerald-500/10 border-emerald-400/30';
    desc = 'Boa margem e retenção esperada.';
  } else if (combined <= 2.5) {
    label = 'Risco moderado'; color = 'text-amber-200'; bg = 'bg-amber-500/10 border-amber-400/30';
    desc = 'Margem aceitável, monitorar frequência.';
  } else {
    label = 'Risco elevado'; color = 'text-rose-200'; bg = 'bg-rose-500/10 border-rose-400/30';
    desc = 'Avaliar sustentabilidade do plano.';
  }

  return (
    <div className={`rounded-xl border p-3 backdrop-blur-sm ${bg}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${color} opacity-70`}>
        <Target className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Risco × Retorno</span>
      </div>
      <div className={`font-black text-base ${color}`}>{label}</div>
      <div className={`text-[10px] mt-0.5 ${color} opacity-70`}>{desc}</div>
    </div>
  );
}

// ─── Card genérico ─────────────────────────────────────────────────────────────
function BizCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:    'bg-blue-500/10 border-blue-400/30 text-blue-100',
    emerald: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-100',
    violet:  'bg-violet-500/10 border-violet-400/30 text-violet-100',
    amber:   'bg-amber-500/10 border-amber-400/30 text-amber-100',
  };
  return (
    <div className={`rounded-xl border p-3 backdrop-blur-sm ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-1.5 mb-1 opacity-70">
        <Icon className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-black text-base leading-none">{value}</div>
      {sub && <div className="text-[10px] mt-0.5 opacity-70">{sub}</div>}
    </div>
  );
}

// ─── Card do plano com badges ──────────────────────────────────────────────────
function PlanCard({ plan, health, badges, score }) {
  if (!plan) return null;
  const scoreLabel = scoreToLabel(safeNum(score));
  const autoBadges = [];
  if (scoreLabel === 'alta') autoBadges.push({ label: 'Recomendado', color: 'emerald' });
  if (health?.color === 'emerald') autoBadges.push({ label: 'Melhor margem', color: 'blue' });
  if (plan.type === 'unlimited') autoBadges.push({ label: 'Ideal para recorrência', color: 'violet' });
  const allBadges = [...(badges || []).slice(0, 1), ...autoBadges].slice(0, 2);

  const badgeColors = {
    emerald: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30',
    blue:    'bg-blue-500/20 text-blue-200 border border-blue-400/30',
    violet:  'bg-violet-500/20 text-violet-200 border border-violet-400/30',
    amber:   'bg-amber-500/20 text-amber-200 border border-amber-400/30',
  };

  return (
    <div className="relative rounded-xl p-4 overflow-hidden border border-blue-400/30 bg-gradient-to-br from-[#0B1E3D] via-[#0A1124] to-[#0B1E3D] shadow-[0_12px_36px_rgba(37,99,235,0.25)]">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold uppercase tracking-widest text-blue-300 mb-1">Plano recomendado</div>
          <div className="font-black text-lg text-white leading-tight">{plan.name}</div>
          <div className="text-[11px] text-white/60 mt-0.5">
            {plan.type === 'unlimited' ? 'Ilimitado — todos os atendimentos' : `${plan.usage_limit} ${plan.usage_limit === 1 ? 'uso' : 'usos'} por mês`}
          </div>
          {allBadges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {allBadges.map((b, i) => (
                <span key={i} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badgeColors[b.color] || badgeColors.blue}`}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-black bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">R${plan.price_monthly}</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wide">por mês</div>
          {health && (
            <div className={`mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
              health.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30' :
              health.color === 'amber' ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30' :
              health.color === 'red' ? 'bg-rose-500/20 text-rose-200 border border-rose-400/30' :
              'bg-blue-500/20 text-blue-200 border border-blue-400/30'
            }`}>
              <Shield className="w-2.5 h-2.5 inline mr-0.5" />{health.label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Motivos da recomendação (sempre visível, não colapsável) ──────────────────
function ReasonsList({ justifications }) {
  if (!justifications?.length) return null;
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3.5 backdrop-blur-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-2.5 flex items-center gap-1.5">
        <Zap className="w-3 h-3" /> Motivos da recomendação
      </div>
      <ul className="space-y-1.5">
        {justifications.map((j, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-white/80">
            <span className="text-[#93C5FD] font-bold flex-shrink-0 mt-0.5">·</span>
            {j}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Alertas operacionais ──────────────────────────────────────────────────────
function AlertBanner({ alert }) {
  const cfg = {
    success: { bg: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-100', icon: '✅' },
    warning: { bg: 'bg-amber-500/10 border-amber-400/30 text-amber-100',       icon: '⚠️' },
    danger:  { bg: 'bg-rose-500/10 border-rose-400/30 text-rose-100',          icon: '🚨' },
  };
  const c = cfg[alert.type] || cfg.warning;
  return (
    <div className={`flex items-start gap-2 text-[12px] px-3 py-2.5 rounded-xl border backdrop-blur-sm ${c.bg}`}>
      <span className="flex-shrink-0">{c.icon}</span>
      <span className="font-medium leading-snug">{alert.message}</span>
    </div>
  );
}

// ─── Modal principal ───────────────────────────────────────────────────────────
export default function OfferPlanModal({ companyId, customer, onClose, onActivated }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    try {
      base44.analytics.track({
        eventName: 'plan_offer_modal_opened',
        properties: { customer_id: customer?.id, company_id: companyId },
      });
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: recData, isLoading } = useQuery({
    queryKey: ['plan-rec', companyId, customer?.id],
    queryFn: () => base44.functions.invoke('recommendPlanForCustomer', {
      company_id: companyId, customer_id: customer.id,
    }),
    enabled: !!companyId && !!customer?.id,
    staleTime: 5 * 60 * 1000,
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const planId = recData?.data?.recommended_plan?.id;
      if (!planId) throw new Error('Plano não encontrado');
      const res = await base44.functions.invoke('mutateSubscription', {
        action: 'subscribe',
        customer_id: customer.id,
        plan_id: planId,
      });
      const data = res?.data;
      if (data?.error) {
        const map = {
          ALREADY_SUBSCRIBED: 'Cliente já tem uma assinatura ativa.',
          PLAN_INACTIVE: 'Esse plano está inativo.',
          NOT_FOUND: 'Plano ou cliente não encontrado.',
          FORBIDDEN_ROLE: 'Seu perfil não tem permissão.',
        };
        throw new Error(map[data.error] || data.error);
      }
      try {
        base44.analytics.track({
          eventName: 'plan_offer_accepted',
          properties: {
            customer_id: customer.id,
            plan_id: planId,
            plan_name: recData?.data?.recommended_plan?.name,
            recommendation_score: recData?.data?.recommendation_score || 0,
            conversion_label: scoreToLabel(recData?.data?.recommendation_score || 0),
            projected_arr: recData?.data?.business_metrics?.annual_recurring_revenue || 0,
          },
        });
      } catch {}
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-active', companyId] });
      queryClient.invalidateQueries({ queryKey: ['plan-rec', companyId, customer.id] });
      onActivated?.();
      onClose();
    },
  });

  const handleCancel = () => {
    try {
      base44.analytics.track({
        eventName: 'plan_offer_declined',
        properties: {
          customer_id: customer?.id,
          plan_id: recData?.data?.recommended_plan?.id,
          recommendation_score: recData?.data?.recommendation_score || 0,
        },
      });
    } catch {}
    onClose();
  };

  const r = recData?.data;
  const plan = r?.recommended_plan;
  const planHealth = r?.plan_health || null;
  const biz = r?.business_metrics || null;
  const justifications = r?.justifications || [];
  const alerts = r?.alerts || [];
  const badges = r?.badges || [];
  const score = safeNum(r?.recommendation_score);
  const metrics = r?.metrics || {};

  // Churn derivado de forma inteligente
  const churnRisk = biz?.churn_risk || deriveChurnRisk(metrics);

  // LTV com fallback elegante
  const ltvValue = biz?.ltv_estimate && biz.ltv_estimate > 0 ? `R$${biz.ltv_estimate}` : 'Em análise';
  const ltvSub = biz?.retention_months_expected && biz.retention_months_expected > 0
    ? `~${biz.retention_months_expected} meses estimados`
    : 'Estimativa indisponível';

  // Receita líquida estimada (não apenas bruta)
  const netMonthly = plan?.price_monthly
    ? (r?.profit != null && r.profit > 0 ? `~R$${Math.round(r.profit)} líq./mês` : `R$${plan.price_monthly}/mês`)
    : 'Em análise';

  // Frequência com texto natural
  const freqValue = biz?.expected_frequency
    ? `${biz.expected_frequency}x/mês`
    : (r?.visits_per_month ? `${r.visits_per_month}x/mês` : 'Em análise');

  const noOffer = !isLoading && (!r || r.no_match || r.no_savings || r.insufficient_data || r.already_subscribed || r.no_plans_available);

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-[3px] z-[9999] overflow-y-auto" onClick={handleCancel}>
      <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
        <div
          className="bg-[#0A1124] border border-white/8 text-white rounded-t-2xl sm:rounded-2xl w-full max-w-[440px] shadow-[0_30px_80px_rgba(0,0,0,0.7)] flex flex-col max-h-[92vh] sm:max-h-[88vh]"
          onClick={e => e.stopPropagation()}
        >

          {/* ── Header compacto ── */}
          <div className="relative px-4 pt-4 pb-3 bg-[#0B1226] border-b border-white/8 rounded-t-2xl flex-shrink-0">
            <button onClick={handleCancel} className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-4 h-4 text-white/55" />
            </button>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="relative w-5 h-5 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] rounded flex items-center justify-center ring-1 ring-white/15">
                <span className="absolute inset-0 rounded bg-[#60A5FA]/40 blur-sm opacity-70" aria-hidden="true" />
                <Zap className="relative w-3 h-3 text-white" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#93C5FD]">IA Comercial</span>
            </div>
            <h3 className="text-base font-black bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent leading-tight pr-8">
              Análise de retenção — {customer?.name?.split(' ')[0]}
            </h3>
          </div>

          {/* ── Body scrollável ── */}
          <div className="flex-1 overflow-y-auto modal-scroll p-4 space-y-3 bg-[#050816]">

            {/* Loading */}
            {isLoading && (
              <div className="text-center py-12">
                <div className="w-10 h-10 bg-blue-500/15 rounded-full flex items-center justify-center mx-auto mb-3 ring-1 ring-blue-400/25">
                  <Loader2 className="w-5 h-5 text-[#93C5FD] animate-spin" />
                </div>
                <p className="text-sm font-semibold text-white">Processando análise comercial…</p>
                <p className="text-xs text-white/45 mt-1">Frequência · ticket · recorrência · margem · LTV</p>
              </div>
            )}

            {/* Sem oferta */}
            {!isLoading && noOffer && (
              <div className="text-center py-10">
                <div className="w-10 h-10 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-3 ring-1 ring-amber-400/30">
                  <AlertCircle className="w-5 h-5 text-amber-300" />
                </div>
                <p className="font-bold text-white mb-1.5">Análise não disponível</p>
                <p className="text-xs text-white/55 max-w-[260px] mx-auto leading-relaxed">
                  {r?.already_subscribed && 'Este cliente já possui uma assinatura ativa.'}
                  {r?.no_plans_available && 'Nenhum plano ativo encontrado. Configure planos em Planos.'}
                  {r?.insufficient_data && `Histórico insuficiente — ${r.visits_in_window || 0} visita${(r.visits_in_window || 0) === 1 ? '' : 's'} nos últimos 6 meses.`}
                  {(r?.no_match || r?.no_savings) && 'Nenhum plano vigente é viável para o perfil comercial atual deste cliente.'}
                </p>
              </div>
            )}

            {/* ── Conteúdo principal ── */}
            {!isLoading && plan && (<>

              {/* Score de conversão */}
              <ScoreHeader score={score} metrics={metrics} />

              {/* Insight humanizado (IA) */}
              <AiInsight score={score} planHealth={planHealth} metrics={metrics} />

              {/* Alertas operacionais */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.map((a, i) => <AlertBanner key={i} alert={a} />)}
                </div>
              )}

              {/* Card do plano */}
              <PlanCard plan={plan} health={planHealth} badges={badges} score={score} />

              {/* Cards 2×2: métricas financeiras */}
              <div className="grid grid-cols-2 gap-2">
                <BizCard
                  icon={TrendingUp}
                  label="Receita previsível"
                  value={netMonthly}
                  sub={`R$${biz?.annual_recurring_revenue || safeNum(plan.price_monthly) * 12}/ano`}
                  color="blue"
                />
                <BizCard
                  icon={RefreshCw}
                  label="Recorrência prevista"
                  value={freqValue}
                  sub="frequência estimada"
                  color="violet"
                />
                <BizCard
                  icon={Sparkles}
                  label="LTV estimado"
                  value={ltvValue}
                  sub={ltvSub}
                  color="emerald"
                />
                <BizCard
                  icon={Shield}
                  label="Risco de churn"
                  value={churnRisk === 'baixo' ? 'Baixo' : churnRisk === 'médio' ? 'Moderado' : 'Elevado'}
                  sub="risco de abandono do plano"
                  color={churnRisk === 'baixo' ? 'emerald' : churnRisk === 'médio' ? 'amber' : 'amber'}
                />
              </div>

              {/* Margem estimada + Risco × Retorno */}
              <div className="grid grid-cols-2 gap-2">
                <MarginCard health={planHealth} profit={r?.profit} />
                <RiskReturnCard health={planHealth} churnRisk={churnRisk} />
              </div>

              {/* Motivos da recomendação */}
              <ReasonsList justifications={justifications} />

              {/* Dados do cliente (compacto) */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 bg-white/[0.03] border border-white/8 rounded-lg">
                {r.visits_per_month > 0 && (
                  <span className="text-[11px] text-white/55">Visitas: <strong className="text-white">{r.visits_per_month}x/mês</strong></span>
                )}
                {(r.avg_ticket || metrics.avg_ticket) > 0 && (
                  <span className="text-[11px] text-white/55">Ticket: <strong className="text-white">R${r.avg_ticket || metrics.avg_ticket}</strong></span>
                )}
                {(r.retention_months || metrics.retention_months) > 0 && (
                  <span className="text-[11px] text-white/55">Histórico: <strong className="text-white">{Math.round(r.retention_months || metrics.retention_months || 0)} meses</strong></span>
                )}
              </div>

              {subscribeMutation.error && (
                <div className="text-xs text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-lg p-2.5">
                  {subscribeMutation.error?.message || 'Erro ao ativar assinatura.'}
                </div>
              )}

            </>)}
          </div>

          {/* ── CTA sticky — sempre visível ── */}
          {!isLoading && plan && (
            <div className="flex-shrink-0 bg-[#0B1226] border-t border-white/8 px-4 py-3 flex gap-2.5">
              <button
                onClick={handleCancel}
                className="px-4 py-3 border border-white/10 rounded-xl text-sm font-semibold text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors flex-shrink-0"
              >
                Agora não
              </button>
              <button
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
                className="flex-1 flex flex-col items-center justify-center gap-0 py-2.5 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 text-white rounded-xl disabled:opacity-50 shadow-[0_12px_36px_rgba(37,99,235,0.45)] ring-1 ring-white/15 transition-all"
              >
                {subscribeMutation.isPending ? (
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <Loader2 className="w-4 h-4 animate-spin" /> Ativando…
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-sm font-black">
                      <Sparkles className="w-3.5 h-3.5" /> Ativar assinatura
                    </span>
                    <span className="text-[10px] text-blue-200/90 font-medium">Iniciar relacionamento recorrente</span>
                  </>
                )}
              </button>
            </div>
          )}

          {!isLoading && noOffer && (
            <div className="flex-shrink-0 px-4 pb-4">
              <button onClick={handleCancel} className="w-full py-3 border border-white/10 rounded-xl text-sm font-semibold text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                Fechar análise
              </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}