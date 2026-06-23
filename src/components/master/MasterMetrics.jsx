// MasterMetrics — Centro de Comando.
// 3 seções: Receita · Empresas · Crescimento & Parceiros.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  DollarSign, TrendingUp, AlertTriangle, Building2, CheckCircle2, Clock, Ban,
  Sparkles, UserMinus, Target, Gift, HandCoins, Wallet,
} from 'lucide-react';
import MetricCard from './MetricCard';
import MetricSection from './MetricSection';

export default function MasterMetrics() {
  const { data, isLoading } = useQuery({
    queryKey: ['master-metrics'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMasterMetrics', {});
      return res.data;
    },
    refetchInterval: 60_000,
  });

  // Delta de novos clientes (30d vs 30d anteriores)
  const newDelta = (() => {
    const cur = data?.new_companies_30d ?? 0;
    const prev = data?.new_companies_prev_30d ?? 0;
    if (!prev) return cur > 0 ? 100 : null;
    return Math.round(((cur - prev) / prev) * 1000) / 10;
  })();

  return (
    <div className="space-y-6">
      {/* RECEITA */}
      <MetricSection
        title="Receita"
        subtitle="MRR, ARR e receita em risco em tempo real"
        icon={DollarSign}
        accent="emerald"
      >
        <MetricCard label="MRR · Receita mensal" value={data?.mrr} icon={DollarSign} color="emerald" money loading={isLoading} />
        <MetricCard label="ARR · Receita anual" value={data?.arr} icon={TrendingUp} color="emerald" money loading={isLoading} />
        <MetricCard label="Receita em risco" value={data?.past_due_revenue} icon={AlertTriangle} color="red" money loading={isLoading} hint={`${data?.past_due ?? 0} inadimplentes`} />
        <MetricCard label="Comissões a pagar" value={data?.pending_commissions_amount} icon={HandCoins} color="amber" money loading={isLoading} hint={`${data?.pending_commissions_count ?? 0} pendentes`} />
      </MetricSection>

      {/* EMPRESAS */}
      <MetricSection
        title="Empresas"
        subtitle="Status do parque de barbearias"
        icon={Building2}
        accent="blue"
      >
        <MetricCard label="Total cadastradas" value={data?.total_companies} icon={Building2} color="blue" loading={isLoading} />
        <MetricCard label="Pagantes ativas" value={data?.active_subscriptions} icon={CheckCircle2} color="emerald" loading={isLoading} />
        <MetricCard label="Em trial" value={data?.trialing} icon={Clock} color="amber" loading={isLoading} hint={data?.trial_ending_soon > 0 ? `${data.trial_ending_soon} expiram em 3d` : null} />
        <MetricCard label="Inadimplentes" value={data?.past_due} icon={AlertTriangle} color="red" loading={isLoading} />
        <MetricCard label="Canceladas" value={data?.canceled} icon={UserMinus} color="gray" loading={isLoading} />
        <MetricCard label="Bloqueadas" value={data?.blocked} icon={Ban} color="gray" loading={isLoading} />
        <MetricCard label="Subcontas pendentes" value={data?.pending_subaccounts} icon={Wallet} color="amber" loading={isLoading} hint={data?.rejected_subaccounts > 0 ? `${data.rejected_subaccounts} rejeitadas` : null} />
        <MetricCard label="Conversão trial→pago" value={data?.trial_to_paid_rate} icon={Target} color="violet" suffix="%" loading={isLoading} />
      </MetricSection>

      {/* CRESCIMENTO & PARCEIROS */}
      <MetricSection
        title="Crescimento & Parceiros"
        subtitle="Aquisição, churn e programa de indicação"
        icon={Sparkles}
        accent="violet"
      >
        <MetricCard label="Novos clientes (30d)" value={data?.new_companies_30d} icon={Sparkles} color="violet" loading={isLoading} delta={newDelta} deltaLabel="vs 30d anteriores" />
        <MetricCard label="Cancelamentos (30d)" value={data?.canceled_30d} icon={UserMinus} color="red" loading={isLoading} />
        <MetricCard label="Parceiros ativos" value={data?.active_partners} icon={Gift} color="violet" loading={isLoading} hint={data?.pending_partners > 0 ? `${data.pending_partners} aguardando aprovação` : `${data?.total_partners ?? 0} no total`} />
        <MetricCard label="Comissões em hold" value={data?.hold_commissions_count} icon={Clock} color="amber" loading={isLoading} hint="No prazo anti-fraude" />
      </MetricSection>
    </div>
  );
}