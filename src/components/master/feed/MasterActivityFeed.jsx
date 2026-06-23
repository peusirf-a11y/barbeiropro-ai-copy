// MasterActivityFeed — feed operacional unificado em tempo real.
// Mostra novas empresas, churns, pagamentos, parceiros e alertas críticos.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Activity, TrendingUp, Ban, CreditCard, Gift, ShieldAlert, RefreshCw, Inbox,
} from 'lucide-react';
import ActivityFeedItem from './ActivityFeedItem';

const CATEGORIES = [
  { key: 'all',      label: 'Tudo',         icon: Activity },
  { key: 'growth',   label: 'Crescimento',  icon: TrendingUp },
  { key: 'churn',    label: 'Churn',        icon: Ban },
  { key: 'billing',  label: 'Cobrança',     icon: CreditCard },
  { key: 'partners', label: 'Parceiros',    icon: Gift },
  { key: 'security', label: 'Segurança',    icon: ShieldAlert },
];

export default function MasterActivityFeed() {
  const [category, setCategory] = useState('all');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['master-activity-feed', category],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMasterActivityFeed', {
        category: category === 'all' ? null : category,
      });
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const events = data?.events || [];
  const counts = data?.counts || {};

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-border">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 ring-1 ring-blue-100 text-blue-700 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg tracking-tight">Atividade ao vivo</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Últimos 7 dias · atualiza a cada 30s
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs font-semibold p-2 rounded-lg bg-card text-foreground hover:bg-muted border border-border disabled:opacity-50 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs de categoria */}
        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const active = category === cat.key;
            const count = counts[cat.key] ?? 0;
            return (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`text-[11px] font-bold inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-3 h-3" />
                {cat.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
        {isLoading && (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando atividade…</div>
        )}
        {!isLoading && events.length === 0 && (
          <div className="p-12 text-center">
            <Inbox className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm font-semibold text-foreground">Sem eventos no período</div>
            <div className="text-xs text-muted-foreground mt-1">
              {category !== 'all' ? 'Tente outra categoria.' : 'Tudo tranquilo nos últimos 7 dias.'}
            </div>
          </div>
        )}
        {events.map(ev => (
          <ActivityFeedItem key={ev.id} event={ev} />
        ))}
      </div>
    </div>
  );
}