// Strip de KPIs consolidados do período.
import KpiCard from '@/components/dashboard/KpiCard';
import { Wallet, TrendingUp, TrendingDown, Receipt, AlertTriangle } from 'lucide-react';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function HistoryKpis({ kpis }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <KpiCard label="Faturamento"   value={fmt(kpis.gross_in)}      icon={TrendingUp}   tone="green" />
      <KpiCard label="Líquido"       value={fmt(kpis.net)}           icon={Wallet}       tone={kpis.net >= 0 ? 'green' : 'red'} />
      <KpiCard label="Atendimentos"  value={String(kpis.appointment_count)} icon={Receipt} tone="blue" />
      <KpiCard
        label="Divergência"
        value={fmt(kpis.diff_total)}
        icon={kpis.diff_total === 0 ? Wallet : AlertTriangle}
        tone={kpis.diff_total === 0 ? 'blue' : (kpis.diff_total > 0 ? 'green' : 'red')}
      />
    </div>
  );
}