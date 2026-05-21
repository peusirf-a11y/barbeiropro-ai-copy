import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { getPartnerToken } from '@/hooks/usePartnerAuth';
import { partnerKeys, commissionKeys } from '@/lib/partnerKeys';
import { Copy, Users, DollarSign, TrendingUp, Clock, CheckCircle2, Wallet } from 'lucide-react';
import { useState } from 'react';
import KpiCard from '@/components/dashboard/KpiCard';

function formatBRL(n) { return 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ','); }

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
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Dashboard</h1>
        <p className="text-white/50 text-sm mt-1">Acompanhe suas indicações e comissões em tempo real.</p>
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

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0,1,2,3].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4">
            <KpiCard label="Total de indicações" value={kpis.total_referrals || 0} sub={`${kpis.converted || 0} convertidas`} icon={Users} tone="blue" />
            <KpiCard label="Barbearias ativas" value={kpis.active || 0} sub={`${kpis.cancelled || 0} canceladas`} icon={TrendingUp} tone="green" />
            <KpiCard label="MRR estimado" value={formatBRL(kpis.mrr_estimated)} sub="Receita recorrente projetada" icon={DollarSign} tone="amber" />
            <KpiCard label="Total recebido" value={formatBRL(kpis.balance_paid)} sub="Comissões já pagas" icon={Wallet} tone="green" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] backdrop-blur-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-300" />
                <div className="text-xs font-bold uppercase tracking-wider text-amber-200">Em hold (15 dias)</div>
              </div>
              <div className="text-2xl font-black">{formatBRL(kpis.balance_pending)}</div>
              <p className="text-xs text-white/55 mt-1">Liberado automaticamente após o período anti-fraude.</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.08] backdrop-blur-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-200">Aprovado · aguardando PIX</div>
              </div>
              <div className="text-2xl font-black">{formatBRL(kpis.balance_approved)}</div>
              <p className="text-xs text-white/55 mt-1">Pago manualmente pelo time O CORTE em até 7 dias úteis.</p>
            </div>
          </div>
        </>
      )}
    </PartnerLayout>
  );
}