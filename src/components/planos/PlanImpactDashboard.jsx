import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Users, Calendar, DollarSign } from 'lucide-react';

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
      <div className="bg-white rounded-2xl border border-black/5 p-6 mb-6 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const result = data?.data;
  if (!result || result.error || result.insufficient_data) return null;

  const m = result.metrics || {};
  const proj = result.projections || {};
  const totalAvulsoMonthly = (m.revenue_180d || 0) / 6; // média mensal últimos 180 dias

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-violet-600" />
        <h3 className="text-sm font-bold text-[#111827]">Impacto dos planos no negócio</h3>
        <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Últimos 180 dias</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ImpactCard
          icon={DollarSign}
          label="Receita avulso (mês)"
          value={`R$${Math.round(totalAvulsoMonthly).toLocaleString('pt-BR')}`}
          sublabel="Média histórica"
          color="text-gray-700"
        />
        <ImpactCard
          icon={TrendingUp}
          label="MRR atual"
          value={`R$${currentMRR.toFixed(0)}`}
          sublabel={`${totalSubscribers} ${totalSubscribers === 1 ? 'assinante' : 'assinantes'}`}
          color="text-emerald-600"
        />
        <ImpactCard
          icon={Users}
          label="Potencial de assinatura"
          value={proj.projected_mrr ? `+R$${proj.projected_mrr.toLocaleString('pt-BR')}` : '—'}
          sublabel="MRR adicional projetado"
          color="text-violet-600"
        />
        <ImpactCard
          icon={Calendar}
          label="Ocupação"
          value={`${m.occupancy_pct || 0}%`}
          sublabel={m.occupancy_pct > 85 ? 'Agenda saturando' : m.occupancy_pct < 60 ? 'Agenda ociosa' : 'Equilibrada'}
          color={m.occupancy_pct > 85 ? 'text-emerald-600' : m.occupancy_pct < 60 ? 'text-amber-600' : 'text-blue-600'}
        />
      </div>

      {/* Comparação avulso vs recorrente */}
      {plansCount > 0 && (
        <div className="mt-4 pt-4 border-t border-black/5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-gray-500">Modelo recorrente vs avulso</span>
            <span className="text-gray-400">% da receita total</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
            <div className="bg-violet-500 transition-all" style={{ width: `${Math.min(100, (currentMRR / Math.max(totalAvulsoMonthly + currentMRR, 1)) * 100)}%` }} title="Recorrente" />
          </div>
          <div className="flex justify-between text-[11px] mt-1.5">
            <span className="text-violet-600 font-semibold">Recorrente: R${currentMRR.toFixed(0)}</span>
            <span className="text-gray-500">Avulso: R${Math.round(totalAvulsoMonthly).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactCard({ icon: Icon, label, value, sublabel, color }) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-white border border-black/5 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{sublabel}</div>
    </div>
  );
}