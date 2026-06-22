import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { getPartnerToken } from '@/hooks/usePartnerAuth';
import { partnerKeys } from '@/lib/partnerKeys';
import { Copy, Users, DollarSign, TrendingUp, Clock, CheckCircle2, Wallet, Target, Percent, Coins, UserCheck } from 'lucide-react';
import { useState } from 'react';
import PartnerKpiCard from '@/components/partner/PartnerKpiCard';
import PartnerGoalCard from '@/components/partner/PartnerGoalCard';
import PartnerEvolutionChart from '@/components/partner/PartnerEvolutionChart';
import PartnerRecentLists from '@/components/partner/PartnerRecentLists';
import PartnerRankCard from '@/components/partner/PartnerRankCard';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

export default function PartnerDashboard() {
  const token = getPartnerToken();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: partnerKeys.me(),
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerData', { action: 'dashboard', token });
      return res?.data;
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const partner = data?.partner;
  const kpis = data?.kpis || {};
  const evolution = data?.monthly_evolution || [];
  const recentRefs = data?.recent_referrals || [];
  const recentComms = data?.recent_commissions || [];
  const referralLink = partner ? `${window.location.origin}/landing?ref=${partner.referral_code}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no-op */ }
  };

  return (
    <PartnerLayout>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
          Olá, {partner?.name?.split(' ')[0] || 'parceiro'} 👋
        </h1>
        <p className="text-white/50 text-sm mt-1">Acompanhe sua performance e ganhos em tempo real.</p>
      </div>

      {/* Link de indicação */}
      <div className="rounded-2xl border border-[#60A5FA]/25 bg-gradient-to-br from-[#2563EB]/10 via-white/[0.03] to-[#60A5FA]/10 backdrop-blur-xl p-5 mb-6">
        <div className="text-xs font-bold text-[#93C5FD] uppercase tracking-wider mb-2">Seu link de indicação</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg font-mono text-sm break-all">
            {referralLink || '—'}
          </div>
          <button onClick={copyLink} disabled={!partner}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50">
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <p className="text-[11px] text-white/45 mt-2">
          Código: <span className="font-mono font-bold text-[#93C5FD]">{partner?.referral_code || '...'}</span> · Comissão: <strong className="text-white">{partner?.commission_percentage || 20}%</strong> recorrente · Atribuição: 90 dias
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0,1,2,3].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0,1,2,3].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
          </div>
          <div className="h-64 skeleton rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Bloco 1: Comissões (4 cards) */}
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/45 mb-2.5">💰 Suas comissões</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <PartnerKpiCard label="Pendente (hold)" value={brl(kpis.balance_pending)} sub="Liberação automática" icon={Clock} tone="amber" />
              <PartnerKpiCard label="Aprovado · a pagar" value={brl(kpis.balance_approved)} sub="PIX em até 7 dias" icon={CheckCircle2} tone="emerald" highlight={kpis.balance_approved > 0} />
              <PartnerKpiCard label="Total recebido" value={brl(kpis.balance_paid)} sub="Já pago via PIX" icon={Wallet} tone="blue" />
              <PartnerKpiCard label="Total gerado" value={brl(kpis.total_generated)} sub="Desde o início" icon={Coins} tone="violet" />
            </div>
          </div>

          {/* Bloco 2: Funil de indicações (4 cards) */}
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/45 mb-2.5">📈 Funil de indicações</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <PartnerKpiCard label="Leads indicados" value={kpis.total_referrals || 0} sub={`${kpis.cancelled || 0} cancelados`} icon={Users} tone="blue" />
              <PartnerKpiCard label="Convertidos" value={kpis.converted || 0} sub={`${kpis.active || 0} pagando hoje`} icon={UserCheck} tone="emerald" />
              <PartnerKpiCard label="Taxa de conversão" value={`${kpis.conversion_rate || 0}%`} sub="lead → cliente" icon={Percent} tone="amber" />
              <PartnerKpiCard label="Receita p/ O CORTE" value={brl(kpis.revenue_for_ocorte)} sub="que você gerou" icon={TrendingUp} tone="violet" />
            </div>
          </div>

          {/* Bloco 3: Meta + Ranking + MRR */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
            <div className="lg:col-span-2">
              <PartnerGoalCard goal={kpis.monthly_goal} generated={kpis.month_generated} progress={kpis.goal_progress} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <PartnerRankCard rank={kpis.my_rank} total={kpis.total_partners} />
              <PartnerKpiCard label="MRR estimado" value={brl(kpis.mrr_estimated)} sub="Recorrência ativa" icon={DollarSign} tone="emerald" />
            </div>
          </div>

          {/* Bloco 4: Evolução mensal */}
          <PartnerEvolutionChart data={evolution} />

          {/* Bloco 5: Últimas indicações + Últimas comissões */}
          <PartnerRecentLists referrals={recentRefs} commissions={recentComms} />
        </div>
      )}
    </PartnerLayout>
  );
}