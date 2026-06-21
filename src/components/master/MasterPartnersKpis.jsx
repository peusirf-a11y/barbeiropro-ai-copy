// KPIs do programa de parceiros — usado em /master/partners no topo da página.
import { Users, Clock, DollarSign, CheckCircle2, TrendingUp } from 'lucide-react';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

export default function MasterPartnersKpis({ kpis, isLoading }) {
  const cards = [
    {
      label: 'Parceiros ativos',
      value: kpis?.partners_active ?? 0,
      sub: `${kpis?.partners_pending ?? 0} pendente(s)`,
      icon: Users,
      color: 'emerald',
    },
    {
      label: 'A pagar (aprovadas)',
      value: brl(kpis?.commissions_to_pay_amount),
      sub: `${kpis?.commissions_to_pay_count ?? 0} comiss${kpis?.commissions_to_pay_count === 1 ? 'ão' : 'ões'}`,
      icon: DollarSign,
      color: 'blue',
      highlight: (kpis?.commissions_to_pay_count ?? 0) > 0,
    },
    {
      label: 'Em hold (anti-fraude)',
      value: brl(kpis?.commissions_hold_amount),
      sub: `${kpis?.commissions_hold_count ?? 0} aguardando`,
      icon: Clock,
      color: 'amber',
    },
    {
      label: 'Pago no mês',
      value: brl(kpis?.commissions_paid_month_amount),
      sub: `${kpis?.commissions_paid_month_count ?? 0} pagamento(s)`,
      icon: CheckCircle2,
      color: 'violet',
    },
    {
      label: 'Convers. no mês',
      value: kpis?.referrals_converted_month ?? 0,
      sub: 'indicações convertidas',
      icon: TrendingUp,
      color: 'rose',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} isLoading={isLoading} />
      ))}
    </div>
  );
}

const COLORS = {
  emerald: { bg: 'bg-emerald-400/12', ring: 'ring-emerald-400/25', text: 'text-emerald-200' },
  blue: { bg: 'bg-blue-400/12', ring: 'ring-blue-400/25', text: 'text-blue-200' },
  amber: { bg: 'bg-amber-400/12', ring: 'ring-amber-400/25', text: 'text-amber-200' },
  violet: { bg: 'bg-violet-400/12', ring: 'ring-violet-400/25', text: 'text-violet-200' },
  rose: { bg: 'bg-rose-400/12', ring: 'ring-rose-400/25', text: 'text-rose-200' },
};

function KpiCard({ label, value, sub, icon: Icon, color, highlight, isLoading }) {
  const c = COLORS[color] || COLORS.blue;
  return (
    <div className={`rounded-2xl border ${highlight ? 'border-blue-400/35 bg-blue-500/[0.06]' : 'border-white/8 bg-white/[0.025]'} backdrop-blur-md p-4 transition-all hover:border-white/15`}>
      <div className="flex items-start justify-between mb-2.5">
        <div className={`w-9 h-9 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
      </div>
      {isLoading ? (
        <div className="h-7 w-20 rounded skeleton mb-1.5" />
      ) : (
        <div className="text-xl lg:text-2xl font-black text-white tracking-tight">{value}</div>
      )}
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mt-0.5">{label}</div>
      <div className="text-[11px] text-white/45 mt-0.5 truncate">{sub}</div>
    </div>
  );
}