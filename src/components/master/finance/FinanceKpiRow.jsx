// FinanceKpiRow — KPIs financeiros premium da Fase 3.
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Users, Gift } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const COLORS = {
  emerald: 'bg-emerald-50 ring-emerald-100 text-emerald-700',
  blue:    'bg-blue-50 ring-blue-100 text-blue-700',
  violet:  'bg-violet-50 ring-violet-100 text-violet-700',
  rose:    'bg-red-50 ring-red-100 text-red-700',
  amber:   'bg-amber-50 ring-amber-100 text-amber-700',
};

function KpiCard({ label, value, sub, icon: Icon, color = 'blue', delta }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3">
        <div className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center ${COLORS[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {delta !== undefined && delta !== null && (
          <span className={`text-[11px] font-bold inline-flex items-center gap-0.5 ${
            delta >= 0 ? 'text-emerald-700' : 'text-red-700'
          }`}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-foreground tracking-tight mt-3 leading-none">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function FinanceKpiRow({ revenue, churn, partners }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <KpiCard
        label="MRR"
        value={fmtMoney(revenue?.mrr)}
        sub="Receita recorrente mensal"
        icon={DollarSign}
        color="emerald"
      />
      <KpiCard
        label="ARR projetado"
        value={fmtMoney(revenue?.arr)}
        sub="MRR × 12"
        icon={TrendingUp}
        color="blue"
      />
      <KpiCard
        label="Churn 30d"
        value={`${churn?.churn_rate_30d?.toFixed(1) || '0.0'}%`}
        sub={`${churn?.canceled_30d || 0} cancelaram · ${fmtMoney(churn?.lost_mrr_30d)} perdidos`}
        icon={AlertTriangle}
        color={churn?.churn_rate_30d > 5 ? 'rose' : 'amber'}
      />
      <KpiCard
        label="Comissão parceiros"
        value={fmtMoney(partners?.paid_30d)}
        sub={`30d · ${fmtMoney(partners?.pending)} a pagar`}
        icon={Gift}
        color="violet"
        delta={partners?.delta_30d}
      />
    </div>
  );
}