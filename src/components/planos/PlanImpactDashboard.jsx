import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Users, Calendar, DollarSign, Target, Zap, Flame } from 'lucide-react';

// Dashboard de impacto: avulso vs recorrente, ocupação, MRR projetado.
// Reaproveita o backend generatePlanSuggestions (modo analyze) que já calcula tudo.
export default function PlanImpactDashboard({ companyId, currentMRR, totalSubscribers, plansCount }) {
  const { data, isLoading } = useQuery({
    queryKey: ['plan-impact', companyId],
    queryFn: () => base44.functions.invoke('generatePlanSuggestions', {
      company_id: companyId, action: 'analyze',
    }),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5min cache
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-6 mb-6 animate-pulse">
        <div className="h-4 bg-white/[0.06] rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-white/[0.04] rounded-xl" />)}
        </div>
      </div>
    );
  }

  const result = data?.data;
  if (!result || result.error || result.insufficient_data) return null;

  const m = result.metrics || {};
  const proj = result.projections || {};
  const conv = result.conversion || {};
  const totalAvulsoMonthly = (m.revenue_180d || 0) / 6; // média mensal últimos 180 dias

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-[#93C5FD]" />
        <h3 className="text-sm font-bold text-white">Impacto dos planos no negócio</h3>
        <span className="text-[10px] font-semibold bg-blue-400/15 text-[#93C5FD] border border-blue-400/25 px-2 py-0.5 rounded-full uppercase tracking-wide">Últimos 180 dias</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ImpactCard
          icon={DollarSign}
          label="Receita avulso (mês)"
          value={`R$${Math.round(totalAvulsoMonthly).toLocaleString('pt-BR')}`}
          sublabel="Média histórica"
          color="text-white"
        />
        <ImpactCard
          icon={TrendingUp}
          label="MRR atual"
          value={`R$${currentMRR.toFixed(0)}`}
          sublabel={`${totalSubscribers} ${totalSubscribers === 1 ? 'assinante' : 'assinantes'}`}
          color="text-emerald-300"
        />
        <ImpactCard
          icon={Users}
          label="Potencial de assinatura"
          value={proj.projected_mrr ? `+R$${proj.projected_mrr.toLocaleString('pt-BR')}` : '—'}
          sublabel="MRR adicional projetado"
          color="text-[#93C5FD]"
        />
        <ImpactCard
          icon={Calendar}
          label="Ocupação"
          value={`${m.occupancy_pct || 0}%`}
          sublabel={m.occupancy_pct > 85 ? 'Agenda saturando' : m.occupancy_pct < 60 ? 'Agenda ociosa' : 'Equilibrada'}
          color={m.occupancy_pct > 85 ? 'text-emerald-300' : m.occupancy_pct < 60 ? 'text-amber-300' : 'text-[#93C5FD]'}
        />
      </div>

      {/* 🔥 MÉTRICAS CRÍTICAS DE CONVERSÃO — regra de ouro: plano não vendido = feature morta */}
      {plansCount > 0 && (
        <div className="mt-4 pt-4 border-t border-white/8">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-orange-300" />
            <h4 className="text-xs font-bold uppercase tracking-wide text-white">Conversão de planos</h4>
            <span className="text-[10px] text-white/40">últimos 30 dias</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <ConversionCard
              icon={Target}
              label="Clientes elegíveis"
              value={`${conv.eligible_pct || 0}%`}
              sublabel={`${conv.eligible_count || 0} de ${conv.active_customers_30d || 0} clientes ativos`}
              color="text-[#93C5FD]"
              bg="bg-blue-400/[0.08] border-blue-400/25"
            />
            <ConversionCard
              icon={Zap}
              label="Convertidos em plano"
              value={`${conv.converted_pct || 0}%`}
              sublabel={`${conv.converted_count || 0} ${(conv.converted_count || 0) === 1 ? 'assinante' : 'assinantes'}`}
              color="text-emerald-300"
              bg="bg-emerald-400/[0.08] border-emerald-400/25"
            />
            <ConversionCard
              icon={DollarSign}
              label="Receita potencial vs atual"
              value={conv.current_mrr != null ? `R$${conv.current_mrr} → R$${(conv.current_mrr || 0) + (conv.potential_mrr || 0)}` : '—'}
              sublabel={conv.potential_mrr > 0 ? `+R$${conv.potential_mrr} se converter os elegíveis` : 'Sem oportunidades agora'}
              color="text-orange-300"
              bg="bg-orange-400/[0.08] border-orange-400/25"
            />
          </div>
          {conv.eligible_count > 0 && conv.converted_pct < 30 && (
            <div className="mt-3 px-3 py-2 bg-amber-400/[0.08] border border-amber-400/25 rounded-lg text-xs text-amber-100">
              🔥 <strong>{conv.eligible_count} {conv.eligible_count === 1 ? 'cliente está' : 'clientes estão'} pronto{conv.eligible_count === 1 ? '' : 's'} para virar assinante.</strong> Use o botão "Oferecer plano" na tela de Clientes ou aproveite o gatilho na Agenda.
            </div>
          )}
        </div>
      )}

      {/* Comparação avulso vs recorrente */}
      {plansCount > 0 && (
        <div className="mt-4 pt-4 border-t border-white/8">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-white/55">Modelo recorrente vs avulso</span>
            <span className="text-white/40">% da receita total</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.06]">
            <div className="bg-gradient-to-r from-[#2563EB] to-[#60A5FA] transition-all" style={{ width: `${Math.min(100, (currentMRR / Math.max(totalAvulsoMonthly + currentMRR, 1)) * 100)}%` }} title="Recorrente" />
          </div>
          <div className="flex justify-between text-[11px] mt-1.5">
            <span className="text-[#93C5FD] font-semibold">Recorrente: R${currentMRR.toFixed(0)}</span>
            <span className="text-white/55">Avulso: R${Math.round(totalAvulsoMonthly).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactCard({ icon: Icon, label, value, sublabel, color }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/55 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[11px] text-white/40 mt-0.5">{sublabel}</div>
    </div>
  );
}

function ConversionCard({ icon: Icon, label, value, sublabel, color, bg }) {
  return (
    <div className={`${bg} border rounded-xl p-3`}>
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${color} mb-1`}>
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[11px] text-white/60 mt-0.5">{sublabel}</div>
    </div>
  );
}