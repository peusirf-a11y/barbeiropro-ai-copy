// Modal de oferta de plano — Engine v2 com scoring inteligente.
// Mantém visual premium existente; evolui inteligência e UX.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import {
  X, Sparkles, Check, TrendingDown, Calendar, Loader2, AlertCircle,
  Info, ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react';

// ─── Badge colored helper ──────────────────────────────────────────────────────
const BADGE_COLORS = {
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  blue:    'bg-blue-50 text-blue-800 border-blue-200',
  violet:  'bg-violet-50 text-violet-800 border-violet-200',
  amber:   'bg-amber-50 text-amber-800 border-amber-200',
  indigo:  'bg-indigo-50 text-indigo-800 border-indigo-200',
};

function SmartBadge({ label, color = 'blue' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${BADGE_COLORS[color] || BADGE_COLORS.blue}`}>
      <Sparkles className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

// ─── Barra visual de economia ──────────────────────────────────────────────────
function EconomyBar({ level }) {
  const config = {
    baixa: { pct: 30, color: 'bg-gray-300', label: 'Baixa' },
    média: { pct: 60, color: 'bg-blue-400', label: 'Média' },
    alta:  { pct: 92, color: 'bg-emerald-500', label: 'Alta' },
  };
  const c = config[level] || config.baixa;
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${c.color}`} style={{ width: `${c.pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-gray-500 w-10">{c.label}</span>
    </div>
  );
}

// ─── Indicador de conversão ────────────────────────────────────────────────────
function ConversionPill({ conversion }) {
  if (!conversion) return null;
  const config = {
    alta:  { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Alta chance de conversão' },
    média: { bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200',   dot: 'bg-amber-400',   label: 'Média chance de conversão' },
    baixa: { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200',    dot: 'bg-gray-400',    label: 'Baixa chance de conversão' },
  };
  const c = config[conversion.label] || config.baixa;
  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </div>
  );
}

// ─── Tooltip de cálculo ────────────────────────────────────────────────────────
function HowWeCalculate({ r, plan }) {
  const [open, setOpen] = useState(false);
  if (!r || !plan) return null;
  const effectiveUses = plan.type === 'unlimited'
    ? r.visits_per_month
    : Math.min(plan.usage_limit || 1, r.visits_per_month);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Info className="w-3 h-3" />
        Como calculamos isso?
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 bg-gray-50 border border-black/5 rounded-xl p-3 text-[11px] text-gray-600 space-y-1 leading-relaxed">
          <div>📊 <strong>Frequência mensal:</strong> {r.visits_per_month}x/mês (baseado nos últimos 6 meses)</div>
          <div>🎯 <strong>Ticket médio:</strong> R${r.avg_ticket || '–'} por visita</div>
          <div>✅ <strong>Usos cobertos pelo plano:</strong> {effectiveUses}x/mês</div>
          <div>💡 <strong>Valor coberto:</strong> {effectiveUses} × R${r.avg_ticket} = R${Math.round(effectiveUses * (r.avg_ticket || 0))}</div>
          <div>💰 <strong>Economia:</strong> R${Math.round(effectiveUses * (r.avg_ticket || 0))} − R${plan.price_monthly} = R${r.economy?.monthly_savings || r.monthly_savings}</div>
          <div className="text-[10px] text-gray-400 pt-1 border-t border-black/5">
            * Estimativa baseada no comportamento atual do cliente. Valores podem variar.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Benefícios ────────────────────────────────────────────────────────────────
function Benefit({ text }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
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

  const r = recData?.data;
  const plan = r?.recommended_plan;

  // Normaliza economia (retrocompat + novo formato)
  const economy = r?.economy || {
    monthly_savings: r?.monthly_savings || 0,
    annual_savings: r?.annual_savings || 0,
    economy_level: 'baixa',
    effective_uses: r?.visits_per_month || 0,
  };
  const conversion = r?.conversion || null;
  const badges = r?.badges || [];

  const noOffer = !isLoading && (!r || r.no_match || r.no_savings || r.insufficient_data || r.already_subscribed || r.no_plans_available);

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[9999] overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="relative bg-[#2563EB] p-6 text-white">
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-lg">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider opacity-90">Recomendação inteligente</span>
            </div>
            <h3 className="text-2xl font-black">Plano ideal para {customer?.name?.split(' ')[0]}</h3>
            {conversion && (
              <div className="mt-2">
                <ConversionPill conversion={conversion} />
              </div>
            )}
          </div>

          {/* ── Body ── */}
          <div className="p-6">

            {/* Loading */}
            {isLoading && (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Analisando comportamento do cliente…</p>
                <p className="text-xs text-gray-400 mt-1">Calculando frequência, ticket médio e aderência</p>
              </div>
            )}

            {/* Sem oferta */}
            {!isLoading && noOffer && (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="font-semibold text-[#111827] mb-1">Sem recomendação no momento</p>
                <p className="text-xs text-gray-500">
                  {r?.already_subscribed && 'Cliente já tem plano ativo.'}
                  {r?.no_plans_available && 'Crie planos ativos primeiro.'}
                  {r?.insufficient_data && `Histórico insuficiente (${r.visits_in_window || 0} visita${(r.visits_in_window || 0) === 1 ? '' : 's'} em 180 dias).`}
                  {(r?.no_match || r?.no_savings) && 'Nenhum plano vigente gera economia real para este cliente com base no histórico atual.'}
                </p>
                <button onClick={onClose} className="mt-4 px-4 py-2 border border-black/10 rounded-lg text-sm font-semibold hover:bg-gray-50">Fechar</button>
              </div>
            )}

            {/* Oferta principal */}
            {!isLoading && plan && (
              <>
                {/* Selos inteligentes */}
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {badges.map((b, i) => <SmartBadge key={i} label={b.label} color={b.color} />)}
                  </div>
                )}

                {/* Card do plano */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] mb-1">Plano recomendado pelo score</div>
                      <div className="font-black text-xl text-[#111827]">{plan.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {plan.type === 'unlimited' ? 'Cortes ilimitados' : `${plan.usage_limit} ${plan.usage_limit === 1 ? 'corte' : 'cortes'} por mês`}
                      </div>
                      {r?.recommendation_score != null && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <BarChart2 className="w-3 h-3 text-[#2563EB]/60" />
                          <span className="text-[10px] text-[#2563EB]/70 font-semibold">Score: {Math.round(r.recommendation_score)}/100</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-black text-[#2563EB]">R${plan.price_monthly}</div>
                      <div className="text-[10px] text-[#2563EB]/70 uppercase">por mês</div>
                    </div>
                  </div>
                </div>

                {/* Economia */}
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                      <TrendingDown className="w-3 h-3" /> Economia/mês
                    </div>
                    <div className="text-xl font-black text-emerald-700">R${economy.monthly_savings}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                      <TrendingDown className="w-3 h-3" /> Est. por ano
                    </div>
                    <div className="text-xl font-black text-emerald-700">R${economy.annual_savings}</div>
                    <div className="text-[9px] text-emerald-600/70 mt-0.5">baseado no comportamento atual</div>
                  </div>
                </div>

                {/* Barra de nível de economia */}
                <EconomyBar level={economy.economy_level} />

                {/* Tooltip de cálculo */}
                <HowWeCalculate r={r} plan={plan} />

                {/* Padrão de uso */}
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-4 mb-4 text-xs text-blue-900">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>
                    Vem <strong>{r.visits_per_month}x/mês</strong>
                    {r.avg_ticket > 0 && <> · ticket médio <strong>R${r.avg_ticket}</strong></>}
                    {' '}· gasta <strong>R${r.monthly_avulso}/mês</strong> avulso
                  </span>
                </div>

                {/* Benefícios */}
                <div className="mb-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Benefícios para o cliente</div>
                  <ul className="space-y-1.5 text-sm text-[#111827]">
                    <Benefit text={`Economiza R$${economy.monthly_savings} todo mês`} />
                    <Benefit text="Hora marcada garantida — sem filas" />
                    <Benefit text="Sem preocupação com pagamento a cada visita" />
                    {plan.type === 'unlimited' && <Benefit text="Cortes ilimitados — venha quando quiser" />}
                    {(r.regularity_score >= 0.6 || r.retention_months >= 3) && (
                      <Benefit text="Programa de fidelidade exclusivo" />
                    )}
                  </ul>
                </div>

                {subscribeMutation.error && (
                  <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                    {subscribeMutation.error?.message || 'Erro ao ativar assinatura.'}
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2">
                  <button onClick={onClose} className="px-4 py-3 border border-black/10 rounded-xl text-sm font-semibold hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button
                    onClick={() => subscribeMutation.mutate()}
                    disabled={subscribeMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl text-sm font-bold disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition-colors"
                  >
                    {subscribeMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Ativando…</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Ativar assinatura</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}