// OfferPlanModal — Ferramenta de decisão comercial para o dono da barbearia.
// Foco: recorrência, retenção, lucratividade, previsibilidade.
// NÃO altera fluxo de ativação, billing ou subscriptions.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import {
  X, Sparkles, Loader2, AlertCircle, TrendingUp,
  RefreshCw, Shield, Zap, ChevronDown, ChevronUp, Info,
} from 'lucide-react';

// ─── Score de conversão (grande, colorido, no topo) ────────────────────────────
function ConversionScoreHeader({ conversion, score }) {
  if (!conversion) return null;
  const cfg = {
    alta:  { bg: 'bg-emerald-500', ring: 'ring-emerald-200', label: 'Alta chance de conversão', sub: 'Cliente pronto para fidelização' },
    média: { bg: 'bg-amber-400',   ring: 'ring-amber-200',   label: 'Média chance de conversão', sub: 'Potencial identificado — boa abordagem' },
    baixa: { bg: 'bg-gray-400',    ring: 'ring-gray-200',    label: 'Baixa chance no momento',   sub: 'Histórico insuficiente para conversão forte' },
  };
  const c = cfg[conversion.label] || cfg.baixa;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ring-2 ${c.ring} bg-white mb-4`}>
      <div className={`w-10 h-10 rounded-full ${c.bg} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
        {Math.round(score || 0)}
      </div>
      <div>
        <div className="font-bold text-[13px] text-[#111827]">{c.label}</div>
        <div className="text-[11px] text-gray-500">{c.sub}</div>
      </div>
    </div>
  );
}

// ─── Card de métrica de negócio ────────────────────────────────────────────────
function BizCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:    'bg-blue-50 border-blue-100 text-blue-800',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    violet:  'bg-violet-50 border-violet-100 text-violet-800',
    amber:   'bg-amber-50 border-amber-100 text-amber-800',
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-1.5 mb-1 opacity-70">
        <Icon className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-black text-lg leading-none">{value}</div>
      {sub && <div className="text-[10px] mt-0.5 opacity-70">{sub}</div>}
    </div>
  );
}

// ─── Saúde do plano ────────────────────────────────────────────────────────────
function PlanHealthBadge({ health }) {
  if (!health) return null;
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    blue:    'bg-blue-50 text-blue-800 border-blue-200',
    amber:   'bg-amber-50 text-amber-800 border-amber-200',
    red:     'bg-red-50 text-red-800 border-red-200',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${colors[health.color] || colors.blue}`}>
      <Shield className="w-3 h-3" />
      Saúde: {health.label}
    </div>
  );
}

// ─── Alertas inteligentes ──────────────────────────────────────────────────────
function AlertBanner({ alert }) {
  const cfg = {
    success: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: '✅' },
    warning: { bg: 'bg-amber-50 border-amber-200 text-amber-800',       icon: '⚠️' },
    danger:  { bg: 'bg-red-50 border-red-200 text-red-800',             icon: '🚨' },
  };
  const c = cfg[alert.type] || cfg.warning;
  return (
    <div className={`flex items-start gap-2 text-[12px] px-3 py-2 rounded-xl border ${c.bg}`}>
      <span className="flex-shrink-0">{c.icon}</span>
      <span className="font-medium">{alert.message}</span>
    </div>
  );
}

// ─── Justificativas ────────────────────────────────────────────────────────────
function WhyThisPlan({ justifications }) {
  const [open, setOpen] = useState(false);
  if (!justifications?.length) return null;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Info className="w-3 h-3" />
        Por que este plano?
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 bg-gray-50 border border-black/5 rounded-xl p-3">
          {justifications.map((j, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-gray-600">
              <span className="text-[#2563EB] flex-shrink-0 mt-0.5">→</span>
              {j}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Resumo executivo ──────────────────────────────────────────────────────────
function ExecutiveSummary({ r, plan, biz }) {
  if (!r || !plan || !biz) return null;
  const showEconomy = (r.economy?.monthly_savings || r.monthly_savings || 0) > 5;
  return (
    <div className="bg-[#F8F9FF] border border-blue-100 rounded-xl p-4 mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] mb-2">Impacto esperado</div>
      <div className="space-y-1.5">
        <ImpactRow icon="💰" value={`+R$${plan.price_monthly}/mês recorrentes`} sub="receita previsível garantida" />
        <ImpactRow icon="📅" value={`+R$${biz.annual_recurring_revenue}/ano previsíveis`} sub="sem depender de visitas avulsas" />
        <ImpactRow icon="🔄" value={`${biz.expected_frequency}x/mês esperado`} sub="frequência estimada pós-conversão" />
        <ImpactRow icon="🏆" value={`LTV projetado: R$${biz.ltv_estimate}`} sub={`~${biz.retention_months_expected} meses de retenção estimados`} />
        {r.conversion?.label === 'alta' && (
          <ImpactRow icon="🛡️" value="Alta chance de retenção" sub="reduz risco de perda para concorrência" />
        )}
        {showEconomy && (
          <ImpactRow icon="✂️" value={`R$${r.economy?.monthly_savings || r.monthly_savings} economizados pelo cliente`} sub="argumento de venda para o cliente" />
        )}
      </div>
    </div>
  );
}

function ImpactRow({ icon, value, sub }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-base leading-none flex-shrink-0">{icon}</span>
      <div>
        <span className="text-[13px] font-bold text-[#111827]">{value}</span>
        {sub && <span className="text-[11px] text-gray-500 ml-1.5">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Modal principal ───────────────────────────────────────────────────────────
export default function OfferPlanModal({ companyId, customer, onClose, onActivated }) {
  const queryClient = useQueryClient();

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
      // Analytics
      try {
        base44.analytics.track({
          eventName: 'plan_offer_accepted',
          properties: {
            customer_id: customer.id,
            plan_id: planId,
            plan_name: recData?.data?.recommended_plan?.name,
            recommendation_score: recData?.data?.recommendation_score || 0,
            conversion_label: recData?.data?.conversion?.label || 'unknown',
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

  // Track modal aberto
  useState(() => {
    try {
      base44.analytics.track({
        eventName: 'plan_offer_modal_opened',
        properties: { customer_id: customer?.id, company_id: companyId },
      });
    } catch {}
  }, []);

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
  const economy = r?.economy || { monthly_savings: r?.monthly_savings || 0, annual_savings: r?.annual_savings || 0 };
  const conversion = r?.conversion || null;
  const planHealth = r?.plan_health || null;
  const biz = r?.business_metrics || null;
  const justifications = r?.justifications || [];
  const alerts = r?.alerts || [];

  const noOffer = !isLoading && (!r || r.no_match || r.no_savings || r.insufficient_data || r.already_subscribed || r.no_plans_available);

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[9999] overflow-y-auto" onClick={handleCancel}>
      <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header fixo ── */}
          <div className="relative bg-[#111827] px-5 pt-5 pb-4 rounded-t-2xl sm:rounded-t-2xl flex-shrink-0">
            <button onClick={handleCancel} className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Análise comercial</span>
            </div>
            <h3 className="text-xl font-black text-white leading-tight">
              Converter {customer?.name?.split(' ')[0]} para assinante
            </h3>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {plan?.name} · R${plan?.price_monthly}/mês
            </p>
          </div>

          {/* ── Body scrollável ── */}
          <div className="flex-1 overflow-y-auto modal-scroll p-5 space-y-4">

            {/* Loading */}
            {isLoading && (
              <div className="text-center py-10">
                <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">Analisando perfil comercial…</p>
                <p className="text-xs text-gray-400 mt-1">Frequência · ticket · recorrência · margem</p>
              </div>
            )}

            {/* Sem oferta */}
            {!isLoading && noOffer && (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="font-semibold text-[#111827] mb-1">Sem recomendação no momento</p>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  {r?.already_subscribed && 'Cliente já tem plano ativo.'}
                  {r?.no_plans_available && 'Crie planos ativos em Planos primeiro.'}
                  {r?.insufficient_data && `Histórico insuficiente (${r.visits_in_window || 0} visita${(r.visits_in_window || 0) === 1 ? '' : 's'} nos últimos 6 meses).`}
                  {(r?.no_match || r?.no_savings) && 'Nenhum plano vigente é viável para o perfil atual deste cliente.'}
                </p>
                <button onClick={handleCancel} className="mt-4 px-4 py-2 border border-black/10 rounded-lg text-sm font-semibold hover:bg-gray-50">Fechar</button>
              </div>
            )}

            {/* Oferta */}
            {!isLoading && plan && (<>

              {/* Score de conversão */}
              <ConversionScoreHeader conversion={conversion} score={r?.recommendation_score} />

              {/* Alertas */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.map((a, i) => <AlertBanner key={i} alert={a} />)}
                </div>
              )}

              {/* Resumo executivo */}
              <ExecutiveSummary r={r} plan={plan} biz={biz} />

              {/* Cards de impacto 2×2 */}
              <div className="grid grid-cols-2 gap-2">
                <BizCard
                  icon={TrendingUp}
                  label="Receita recorrente"
                  value={`R$${plan.price_monthly}/mês`}
                  sub={`R$${biz?.annual_recurring_revenue || plan.price_monthly * 12}/ano`}
                  color="blue"
                />
                <BizCard
                  icon={RefreshCw}
                  label="Frequência prevista"
                  value={`${biz?.expected_frequency || r.visits_per_month}x/mês`}
                  sub="pós-conversão"
                  color="violet"
                />
                <BizCard
                  icon={Shield}
                  label="LTV estimado"
                  value={`R$${biz?.ltv_estimate || '--'}`}
                  sub={`~${biz?.retention_months_expected || '?'} meses`}
                  color="emerald"
                />
                <BizCard
                  icon={Sparkles}
                  label="Churn estimado"
                  value={biz?.churn_risk === 'baixo' ? 'Baixo' : biz?.churn_risk === 'médio' ? 'Médio' : 'Alto'}
                  sub="risco de cancelamento"
                  color={biz?.churn_risk === 'baixo' ? 'emerald' : biz?.churn_risk === 'médio' ? 'amber' : 'amber'}
                />
              </div>

              {/* Plano + saúde */}
              <div className="bg-gray-50 border border-black/8 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Plano recomendado</div>
                  <div className="font-black text-base text-[#111827]">{plan.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {plan.type === 'unlimited' ? 'Ilimitado' : `${plan.usage_limit} ${plan.usage_limit === 1 ? 'uso' : 'usos'}/mês`}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-black text-[#2563EB]">R${plan.price_monthly}</div>
                  <PlanHealthBadge health={planHealth} />
                </div>
              </div>

              {/* Por que este plano */}
              <WhyThisPlan justifications={justifications} />

              {/* Perfil do cliente (discreto) */}
              <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                Visitas: <strong className="text-gray-600">{r.visits_per_month}x/mês</strong>
                {r.avg_ticket > 0 && <> · Ticket: <strong className="text-gray-600">R${r.avg_ticket}</strong></>}
                · Retenção: <strong className="text-gray-600">{Math.round(r.retention_months || 0)} meses</strong>
              </div>

              {/* Erro de ativação */}
              {subscribeMutation.error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  {subscribeMutation.error?.message || 'Erro ao ativar assinatura.'}
                </div>
              )}

            </>)}
          </div>

          {/* ── CTA sticky no rodapé ── */}
          {!isLoading && plan && (
            <div className="flex-shrink-0 px-5 py-4 bg-white border-t border-black/5 flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-3 border border-black/10 rounded-xl text-sm font-semibold text-[#111827] hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl text-sm font-bold disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition-colors"
              >
                {subscribeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Ativando…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Ativar assinatura</>
                )}
              </button>
            </div>
          )}

          {!isLoading && noOffer && (
            <div className="flex-shrink-0 px-5 pb-5">
              <button onClick={handleCancel} className="w-full py-3 border border-black/10 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Fechar
              </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}