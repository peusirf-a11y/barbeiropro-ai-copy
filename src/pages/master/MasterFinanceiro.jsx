// Master Finance — Fase 3.
// MRR/ARR, breakdown por plano, churn, receita histórica 12m,
// top empresas, saúde da base, custo com parceiros.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RefreshCw } from 'lucide-react';
import FinanceKpiRow from '@/components/master/finance/FinanceKpiRow';
import RevenueByPlan from '@/components/master/finance/RevenueByPlan';
import RevenueHistoryChart from '@/components/master/finance/RevenueHistoryChart';
import TopCompaniesByRevenue from '@/components/master/finance/TopCompaniesByRevenue';
import PartnersCostCard from '@/components/master/finance/PartnersCostCard';
import SubscriptionHealthBar from '@/components/master/finance/SubscriptionHealthBar';

export default function MasterFinanceiro() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['master-finance'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMasterFinance', {});
      return res.data;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Carregando financeiro…</div>;
  }

  if (!data?.success) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 text-sm font-semibold">Erro ao carregar financeiro.</div>
        <button onClick={() => refetch()} className="mt-3 text-sm text-[#2563EB] font-semibold hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  const { revenue, breakdown, churn, history, top_companies, partners_cost } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Financeiro Master</h2>
          <p className="text-sm text-muted-foreground mt-1">Receita SaaS, retenção e custos do programa de parceiros.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-card text-foreground hover:bg-muted border border-border inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* KPIs principais */}
      <FinanceKpiRow revenue={revenue} churn={churn} partners={partners_cost} />

      {/* Saúde da base */}
      <SubscriptionHealthBar revenue={revenue} churn={churn} />

      {/* Gráfico histórico */}
      <RevenueHistoryChart history={history} />

      {/* Breakdown + Custo de parceiros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueByPlan breakdown={breakdown} totalMrr={revenue?.mrr} />
        <PartnersCostCard partners={partners_cost} mrr={revenue?.mrr} />
      </div>

      {/* Top empresas */}
      <TopCompaniesByRevenue companies={top_companies} />
    </div>
  );
}