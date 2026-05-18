// Financeiro — receita do SaaS, MRR, cancelamentos e histórico de pagamentos.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DollarSign, TrendingUp, Users, XCircle } from 'lucide-react';
import KpiCard from '@/components/dashboard/KpiCard';

export default function MasterFinanceiro() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['master-metrics'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMasterMetrics', {});
      return res.data;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['master-companies-financial'],
    queryFn: async () => {
      // pega até 200 empresas para snapshot financeiro
      const res = await base44.functions.invoke('listCompanies', { page: 1, page_size: 200, search: '' });
      return res.data?.items || [];
    },
  });

  const mrr = metrics?.mrr || 0;
  const arr = mrr * 12;
  const activeSubs = metrics?.active_subscriptions || 0;
  const canceled = companies.filter(c => c.subscription_status === 'canceled').length;
  const pastDue = companies.filter(c => ['past_due', 'unpaid'].includes(c.subscription_status)).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Financeiro</h2>
        <p className="text-sm text-muted-foreground mt-1">Receita, MRR e saúde da assinatura.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={`R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} tone="emerald" sub="Receita recorrente mensal" />
        <KpiCard label="ARR projetado" value={`R$ ${arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} tone="blue" sub="MRR × 12" />
        <KpiCard label="Assinaturas ativas" value={activeSubs} icon={Users} tone="violet" />
        <KpiCard label="Cancelamentos" value={canceled} icon={XCircle} tone="rose" sub={`${pastDue} em atraso`} />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
        <div className="p-4 sm:p-5 border-b border-border">
          <h3 className="font-bold text-foreground tracking-tight">Status das assinaturas</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Visão consolidada por empresa</p>
        </div>

        {/* Mobile: cards. Desktop: tabela. */}
        <div className="md:hidden divide-y divide-border">
          {isLoading && (
            <div className="px-4 py-12 text-center text-muted-foreground text-sm">Carregando…</div>
          )}
          {!isLoading && companies.length === 0 && (
            <div className="px-4 py-12 text-center text-muted-foreground text-sm">Nenhuma empresa encontrada</div>
          )}
          {companies.map(c => (
            <div key={c.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{c.name}</div>
                  {c.owner_email && <div className="text-xs text-muted-foreground truncate">{c.owner_email}</div>}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-500/15 text-blue-500 rounded-full border border-blue-500/30 flex-shrink-0">{c.plan_name || 'Starter'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-muted/40 rounded-lg px-2.5 py-1.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</div>
                  <div className="font-semibold text-foreground mt-0.5">{c.subscription_status || '–'}</div>
                </div>
                <div className="bg-muted/40 rounded-lg px-2.5 py-1.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Próx. venc.</div>
                  <div className="font-semibold text-foreground mt-0.5">
                    {c.current_period_end ? new Date(c.current_period_end).toLocaleDateString('pt-BR') : '–'}
                  </div>
                </div>
              </div>
              {c.trial_ends_at && (
                <div className="text-[11px] text-muted-foreground">
                  Trial até {new Date(c.trial_ends_at).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {['Empresa', 'Plano', 'Status Stripe', 'Próximo vencimento', 'Trial até'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm text-foreground">{c.name}</div>
                    {c.owner_email && <div className="text-xs text-muted-foreground">{c.owner_email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-blue-500/15 text-blue-500 rounded-full border border-blue-500/30">{c.plan_name || 'Starter'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground font-medium">{c.subscription_status || '–'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.current_period_end ? new Date(c.current_period_end).toLocaleDateString('pt-BR') : '–'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.trial_ends_at ? new Date(c.trial_ends_at).toLocaleDateString('pt-BR') : '–'}
                  </td>
                </tr>
              ))}
              {!isLoading && companies.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">Nenhuma empresa encontrada</td></tr>
              )}
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">Carregando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}