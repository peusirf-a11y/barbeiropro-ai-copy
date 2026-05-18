// Cards de billing/assinaturas para o Master (com MRR real).
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, CheckCircle2, Clock, AlertTriangle, Ban, DollarSign, TrendingUp } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const cards = [
  { key: 'mrr', label: 'MRR (Receita mensal)', icon: DollarSign, money: true, color: 'text-emerald-700 bg-emerald-50 ring-emerald-100' },
  { key: 'arr', label: 'ARR (Receita anual)', icon: TrendingUp, money: true, color: 'text-emerald-700 bg-emerald-50 ring-emerald-100' },
  { key: 'past_due_revenue', label: 'Receita em risco', icon: AlertTriangle, money: true, color: 'text-red-600 bg-red-50 ring-red-100' },
  { key: 'total_companies', label: 'Total de empresas', icon: Building2, color: 'text-[#2563EB] bg-[#EFF6FF] ring-[#DBEAFE]' },
  { key: 'active_subscriptions', label: 'Assinaturas ativas', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 ring-emerald-100' },
  { key: 'trialing', label: 'Em trial', icon: Clock, color: 'text-amber-600 bg-amber-50 ring-amber-100' },
  { key: 'past_due', label: 'Inadimplentes', icon: AlertTriangle, color: 'text-red-600 bg-red-50 ring-red-100' },
  { key: 'blocked', label: 'Bloqueadas', icon: Ban, color: 'text-gray-700 bg-gray-100 ring-gray-200' },
];

export default function MasterMetrics() {
  const { data, isLoading } = useQuery({
    queryKey: ['master-metrics'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMasterMetrics', {});
      return res.data;
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {cards.map(c => {
        const Icon = c.icon;
        const raw = data?.[c.key];
        const value = isLoading ? '—' : (c.money ? fmtMoney(raw) : (raw ?? 0));
        return (
          <div key={c.key} className="bg-card rounded-2xl border border-border p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ring-1 ${c.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className={`font-black text-foreground tracking-tight leading-none ${c.money ? 'text-2xl' : 'text-[28px]'}`}>{value}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}