// Master Finance — Fase 3.
// MRR/ARR, breakdown por plano, churn, receita histórica 12m,
// top empresas, saúde da base, custo com parceiros + Exportação Analítica.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RefreshCw, FileDown } from 'lucide-react';
import FinanceKpiRow from '@/components/master/finance/FinanceKpiRow';
import RevenueByPlan from '@/components/master/finance/RevenueByPlan';
import RevenueHistoryChart from '@/components/master/finance/RevenueHistoryChart';
import TopCompaniesByRevenue from '@/components/master/finance/TopCompaniesByRevenue';
import PartnersCostCard from '@/components/master/finance/PartnersCostCard';
import SubscriptionHealthBar from '@/components/master/finance/SubscriptionHealthBar';
import { csvCell } from '@/lib/csvSafe';

export default function MasterFinanceiro() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['master-finance'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getMasterFinance', {});
        return res?.data || { success: false };
      } catch (err) {
        console.error('[MasterFinanceiro] Erro ao carregar métricas financeiras:', err);
        return { success: false };
      }
    },
    refetchInterval: 60_000,
  });

  const handleExportAnalyticalReport = () => {
    try {
      const sep = ';';
      const escape = (v) => csvCell(v, sep);
      const rev = data?.revenue || {};
      const ch = data?.churn || {};
      const top = Array.isArray(data?.top_companies) ? data.top_companies : [];
      const brk = Array.isArray(data?.breakdown) ? data.breakdown : [];

      const lines = [
        'RELATÓRIO ANALÍTICO FINANCEIRO MASTER - O CORTE',
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        '',
        'INDICADORES PRINCIPAIS (KPIs)',
        ['Métrica', 'Valor'].join(sep),
        [escape('MRR (Receita Recorrente Mensal)'), Number(rev.mrr || 0).toFixed(2).replace('.', ',')].join(sep),
        [escape('ARR (Receita Recorrente Anual)'), Number(rev.arr || 0).toFixed(2).replace('.', ',')].join(sep),
        [escape('Empresas Pagantes'), Number(rev.paying_companies || 0)].join(sep),
        [escape('Empresas em Trial'), Number(rev.trial_companies || 0)].join(sep),
        [escape('Taxa de Churn (%)'), Number(ch.churn_rate || 0).toFixed(2).replace('.', ',')].join(sep),
        '',
        'RECEITA POR PLANO',
        ['Plano', 'Empresas', 'MRR (R$)'].join(sep),
        ...brk.map((b) =>
          [
            escape(b?.plan_name || b?.name || 'Plano'),
            Number(b?.count || b?.companies || 0),
            Number(b?.mrr || 0).toFixed(2).replace('.', ','),
          ].join(sep)
        ),
        '',
        'TOP BARBEARIAS POR RECEITA',
        ['Empresa', 'Plano', 'MRR Assinatura (R$)', 'Receita Gerada (R$)'].join(sep),
        ...top.map((c) =>
          [
            escape(c?.name || 'Barbearia'),
            escape(c?.plan_name || 'Starter'),
            Number(c?.mrr || 0).toFixed(2).replace('.', ','),
            Number(c?.generated_revenue || c?.total_revenue || 0).toFixed(2).replace('.', ','),
          ].join(sep)
        ),
      ];

      const csv = '\uFEFF' + lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-analitico-master-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      console.error('[MasterFinanceiro] Falha ao exportar relatório analítico:', err);
    }
  };

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-action="export-report"
            onClick={handleExportAnalyticalReport}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-[#2563EB] text-white hover:bg-[#1D4ED8] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5" />
            Exportar Relatório Analítico
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-card text-foreground hover:bg-muted border border-border inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
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