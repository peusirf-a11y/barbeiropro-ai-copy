import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { getPartnerToken } from '@/hooks/usePartnerAuth';
import { partnerKeys } from '@/lib/partnerKeys';
import {
  Copy,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Wallet,
  Percent,
  Coins,
  UserCheck,
  Shield,
  Calendar,
  Award,
  Headphones,
} from 'lucide-react';
import { useState } from 'react';
import PartnerKpiCard from '@/components/partner/PartnerKpiCard';
import PartnerGoalCard from '@/components/partner/PartnerGoalCard';
import PartnerEvolutionChart from '@/components/partner/PartnerEvolutionChart';
import PartnerRecentLists from '@/components/partner/PartnerRecentLists';
import PartnerRankCard from '@/components/partner/PartnerRankCard';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

const EARNINGS_PROJECTION = [
  { count: '3 barbearias', monthly: 'R$ 107,10 / mês', yearly: '~R$ 1.179,63' },
  { count: '5 barbearias', monthly: 'R$ 178,50 / mês', yearly: '~R$ 1.966,05' },
  { count: '10 barbearias', monthly: 'R$ 357,00 / mês', yearly: '~R$ 3.932,10' },
  { count: '20 barbearias', monthly: 'R$ 714,00 / mês', yearly: '~R$ 7.864,20' },
];

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
  const BASE_DOMAIN = import.meta.env.VITE_APP_URL || 'https://ocorte.vercel.app';
  const referralLink = partner?.referral_code
    ? `${BASE_DOMAIN}/landing?ref=${partner.referral_code}`
    : '';

  const copyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no-op */ }
  };

  const commRate = partner?.commission_percentage || partner?.commission_rate || 30;

  return (
    <PartnerLayout>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
          Olá, {partner?.name?.split(' ')[0] || 'parceiro'} 👋
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Programa de Parceiros Oficial — O CORTE · Acompanhe suas indicações e comissões recorrentes.
        </p>
      </div>

      {/* Link de indicação */}
      <div className="rounded-2xl border border-[#60A5FA]/25 bg-gradient-to-br from-[#2563EB]/10 via-white/[0.03] to-[#60A5FA]/10 backdrop-blur-xl p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="text-xs font-bold text-[#93C5FD] uppercase tracking-wider">Seu link de indicação oficial</div>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
            {commRate}% recorrente · 12 meses por cliente (~R$ 393,21/ano)
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg font-mono text-sm break-all">
            {referralLink || '—'}
          </div>
          <button
            onClick={copyLink}
            disabled={!partner}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <p className="text-[11px] text-white/55 mt-2 leading-relaxed">
          Código: <span className="font-mono font-bold text-[#93C5FD]">{partner?.referral_code || '...'}</span> · Meses 1 a 3 (R$ 79,90): <strong className="text-white">R$ 23,97/mês</strong> · Mês 4 ao 12 (R$ 119,00): <strong className="text-emerald-300">R$ 35,70/mês</strong> · Teto: 12 mensalidades por barbearia
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 skeleton rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 skeleton rounded-2xl" />)}
          </div>
          <div className="h-64 skeleton rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bloco 1: Comissões (4 cards) */}
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/45 mb-2.5">💰 Suas comissões</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <PartnerKpiCard
                label="Em Hold (Anti-fraude)"
                value={brl(kpis.balance_pending)}
                sub="Retenção de 14 a 30 dias"
                icon={Clock}
                tone="amber"
              />
              <PartnerKpiCard
                label="A Pagar (Aprovadas)"
                value={brl(kpis.balance_approved)}
                sub="Fecho dia 01 · Pix dias 05 a 10"
                icon={CheckCircle2}
                tone="emerald"
                highlight={kpis.balance_approved > 0}
              />
              <PartnerKpiCard
                label="Total recebido"
                value={brl(kpis.balance_paid)}
                sub="Já transferido via PIX"
                icon={Wallet}
                tone="blue"
              />
              <PartnerKpiCard
                label="Total gerado"
                value={brl(kpis.total_generated)}
                sub="Acumulado no programa"
                icon={Coins}
                tone="violet"
              />
            </div>
          </div>

          {/* Bloco 2: Funil de indicações (4 cards) */}
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/45 mb-2.5">📈 Funil de indicações</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <PartnerKpiCard label="Indicações totais" value={kpis.total_referrals || 0} sub={`${kpis.cancelled || 0} canceladas`} icon={Users} tone="blue" />
              <PartnerKpiCard label="Em Trial / Ativas" value={kpis.converted || 0} sub={`${kpis.active || 0} pagando mensalidade`} icon={UserCheck} tone="emerald" />
              <PartnerKpiCard label="Taxa de conversão" value={`${kpis.conversion_rate || 0}%`} sub="trial → assinatura ativa" icon={Percent} tone="amber" />
              <PartnerKpiCard label="Receita gerada" value={brl(kpis.revenue_for_ocorte)} sub="faturamento originado" icon={TrendingUp} tone="violet" />
            </div>
          </div>

          {/* Bloco 3: Meta + Ranking + MRR */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
            <div className="lg:col-span-2">
              <PartnerGoalCard goal={kpis.monthly_goal} generated={kpis.month_generated} progress={kpis.goal_progress} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <PartnerRankCard rank={kpis.my_rank} total={kpis.total_partners} />
              <PartnerKpiCard label="Comissão mensal est." value={brl(kpis.mrr_estimated)} sub="30% sobre ativas" icon={DollarSign} tone="emerald" />
            </div>
          </div>

          {/* Bloco 4: Projeção de Ganhos em Escala & Ciclo Operacional */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tabela de Projeção */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-md p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#93C5FD]" />
                  Projeção de Ganhos em Escala (30%)
                </h3>
                <span className="text-[11px] text-emerald-300 font-semibold">~R$ 393,21 / cliente (12m)</span>
              </div>
              <p className="text-xs text-white/55 mb-3">
                Meses 1 a 3 (R$ 79,90): <strong className="text-white">R$ 23,97/mês</strong> · Mês 4 ao 12 (R$ 119,00): <strong className="text-[#93C5FD]">R$ 35,70/mês</strong>.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/45 text-[10px] uppercase tracking-wider">
                      <th className="py-2 pr-2">Barbearias Ativas</th>
                      <th className="py-2 px-2">Comissão Mensal (Mês 4+)</th>
                      <th className="py-2 pl-2 text-right">Acumulado 12 Meses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {EARNINGS_PROJECTION.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 pr-2 font-bold text-white">{row.count}</td>
                        <td className="py-2.5 px-2 font-semibold text-[#93C5FD]">{row.monthly}</td>
                        <td className="py-2.5 pl-2 text-right font-black text-emerald-300">{row.yearly}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Regras Operacionais & Repasse Pix */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-md p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                Ciclo de Vida e Regras Operacionais
              </h3>
              <div className="space-y-2 text-xs text-white/65">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/6">
                  <strong className="text-white">1. Trial (7 dias grátis):</strong> Indicação fica em avaliação durante o período de testes, sem gerar saldo financeiro.
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/6">
                  <strong className="text-amber-300">2. Em Hold Antifraude (14 a 30 dias):</strong> Após o pagamento da mensalidade, os 30% ficam retidos contra estornos ou cancelamentos imediatos.
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/6">
                  <strong className="text-emerald-300">3. Aprovação & Repasse Pix:</strong> Consolidado no <strong>dia 01</strong> de cada mês e pago entre os <strong>dias 05 e 10</strong> na sua chave Pix (valor mínimo de transferência: <strong>R$ 50,00</strong>).
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/6 flex items-start gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#93C5FD] mt-0.5 flex-shrink-0" />
                  <span>
                    <strong className="text-white">Teto de 12 Mensalidades & Isenção Técnica:</strong> Cada barbearia gera até 12 repasses mensais. Todo suporte técnico, setup e hospedagem ficam sob responsabilidade de O CORTE.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bloco 5: Evolução mensal */}
          <PartnerEvolutionChart data={evolution} />

          {/* Bloco 6: Últimas indicações + Últimas comissões */}
          <PartnerRecentLists referrals={recentRefs} commissions={recentComms} />
        </div>
      )}
    </PartnerLayout>
  );
}