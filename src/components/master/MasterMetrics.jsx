// Cards de billing/assinaturas para o Master.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, CheckCircle2, Clock, AlertTriangle, Ban } from 'lucide-react';

const cards = [
  { key: 'total_companies', label: 'Total de empresas', icon: Building2, color: 'text-[#2563EB] bg-[#2563EB]/10' },
  { key: 'active_subscriptions', label: 'Assinaturas ativas', icon: CheckCircle2, color: 'text-green-600 bg-green-100' },
  { key: 'trialing', label: 'Em trial', icon: Clock, color: 'text-orange-500 bg-orange-100' },
  { key: 'past_due', label: 'Inadimplentes', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  { key: 'blocked', label: 'Bloqueadas', icon: Ban, color: 'text-gray-700 bg-gray-200' },
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
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
      {cards.map(c => {
        const Icon = c.icon;
        const value = isLoading ? '—' : (data?.[c.key] ?? 0);
        return (
          <div key={c.key} className="bg-white rounded-2xl border border-black/8 p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="text-3xl font-black text-[#1B1C1E]">{value}</div>
            <div className="text-xs text-gray-400 mt-1">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}