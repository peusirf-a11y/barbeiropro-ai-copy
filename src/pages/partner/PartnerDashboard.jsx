import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Copy,
  CheckCircle2,
  Clock,
  Wallet,
  Store,
  Info,
  Share2,
  ArrowRight,
  Users,
  DollarSign,
  FileText,
  X,
  ShieldCheck,
  Sparkles,
  Tag,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { getPartnerToken } from '@/hooks/usePartnerAuth';
import { partnerKeys } from '@/lib/partnerKeys';

const OFFICIAL_DOMAIN = 'https://ocorte.app';

const brl = (n) =>
  'R$ ' +
  (Number(n) || 0)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const safeFmt = (dStr) => {
  if (!dStr) return '—';
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return format(d, 'dd MMM yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
};

const REF_STATUS = {
  pending: { label: 'Em avaliação', cls: 'bg-white/8 text-white/70 border-white/15' },
  converted: { label: 'Trial (7 dias)', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  active: { label: 'Ativa (30%)', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  completed: { label: 'Ciclo 12/12', cls: 'bg-blue-500/15 text-blue-200 border-blue-400/30' },
  cancelled: { label: 'Cancelada', cls: 'bg-rose-500/10 text-rose-200 border-rose-400/25' },
  fraud: { label: 'Irregular', cls: 'bg-rose-500/25 text-rose-200 border-rose-400/45' },
};

const COMM_STATUS = {
  pending: { label: 'Em Retenção (Hold)', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  approved: { label: 'A Receber (Aprovada)', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  paid: { label: 'Pago via Pix', cls: 'bg-blue-500/15 text-blue-200 border-blue-400/30' },
  cancelled: { label: 'Cancelada', cls: 'bg-rose-500/10 text-rose-200 border-rose-400/25' },
};

export default function PartnerDashboard() {
  const token = getPartnerToken();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showHoldTooltip, setShowHoldTooltip] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

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
  const recentRefs = data?.recent_referrals || [];
  const recentComms = data?.recent_commissions || [];

  const partnerCode = partner?.referral_code || '';
  const referralLink = partnerCode
    ? `${OFFICIAL_DOMAIN}/landing?ref=${partnerCode}`
    : `${OFFICIAL_DOMAIN}/landing`;

  const commRate = partner?.commission_percentage || partner?.commission_rate || 30;
  const activeCount = Number(kpis.active ?? kpis.converted ?? 0);

  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      /* fallback silencioso */
    }
  };

  const handleCopyCode = async () => {
    if (!partnerCode) return;
    try {
      await navigator.clipboard.writeText(partnerCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      /* fallback silencioso */
    }
  };

  const handleShareWhatsApp = () => {
    const msg =
      `Fala! Tudo bem? 💈\n\n` +
      `Estou indicando o sistema *O CORTE* para gestão completa de barbearia (agenda online, financeiro, comissões e planos de assinatura).\n\n` +
      `Cadastrando pelo meu link oficial você libera *7 dias grátis* e condição especial de lançamento:\n` +
      `👉 ${referralLink}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <PartnerLayout>
      {/* Header enxuto */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            Olá, {partner?.name?.split(' ')[0] || 'Parceiro'} 👋
          </h1>
          <p className="text-white/55 text-xs sm:text-sm mt-0.5">
            Compartilhe seu link oficial e acompanhe seus repasses via Pix.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-[#93C5FD]" />
          Regras e Termos do Programa
        </button>
      </div>

      {/* 1. Card de Destaque: Link de Indicação Oficial */}
      <div className="rounded-2xl border border-[#60A5FA]/30 bg-gradient-to-br from-[#2563EB]/15 via-white/[0.03] to-[#60A5FA]/10 backdrop-blur-xl p-4 sm:p-5 mb-6 shadow-[0_12px_40px_rgba(37,99,235,0.12)]">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#93C5FD] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Seu Link de Indicação Oficial
          </span>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
            {commRate}% recorrente por barbearia ativa (12 meses)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center px-3.5 py-2.5 bg-white/[0.05] border border-white/12 rounded-xl font-mono text-xs sm:text-sm text-white select-all break-all">
            {partnerCode ? referralLink : 'Carregando link...'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!partnerCode}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer shadow-brand"
            >
              {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Copiado!' : 'Copiar link'}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={!partnerCode}
              title="Compartilhar no WhatsApp"
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 font-semibold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden md:inline">WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Cupom / Código do Parceiro */}
        <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-white/65">
            <Tag className="w-3.5 h-3.5 text-[#93C5FD]" />
            <span>Cupom / Código do parceiro:</span>
            <span className="font-mono font-bold text-white px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10">
              {partnerCode || '—'}
            </span>
          </div>

          {partnerCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-[11px] font-semibold text-[#93C5FD] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                  <span className="text-emerald-300">Código copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copiar código
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 skeleton rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-64 skeleton rounded-2xl" />
            <div className="h-64 skeleton rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 2. Grade Enxuta de 4 Indicadores Essenciais (2x2 no mobile, 4 colunas no desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* KPI 1: A Receber (Próximo Pix) */}
            <div
              className={`rounded-2xl border p-4 backdrop-blur-md transition-all ${
                Number(kpis.balance_approved) > 0
                  ? 'border-emerald-400/35 bg-emerald-500/[0.07]'
                  : 'border-white/8 bg-white/[0.025]'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-400/12 ring-1 ring-emerald-400/25 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                  Dias 05 a 10
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-black text-white tracking-tight">
                {brl(kpis.balance_approved)}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/65 mt-0.5">
                A Receber (Próximo Pix)
              </div>
              <div className="text-[11px] text-white/45 mt-0.5 truncate">
                Saldo aprovado para repasse
              </div>
            </div>

            {/* KPI 2: Em Retenção (Hold) com Tooltip explicativo */}
            <div className="relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4 transition-all">
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/12 ring-1 ring-amber-400/25 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-300" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowHoldTooltip((v) => !v)}
                  onMouseEnter={() => setShowHoldTooltip(true)}
                  onMouseLeave={() => setShowHoldTooltip(false)}
                  aria-label="Entenda o período de retenção"
                  className="w-6 h-6 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-white/55 hover:text-white transition-colors cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-xl lg:text-2xl font-black text-white tracking-tight">
                {brl(kpis.balance_pending)}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/65 mt-0.5">
                Em Retenção (Hold)
              </div>
              <div className="text-[11px] text-white/45 mt-0.5 truncate">
                Carência anti-fraude (14–30d)
              </div>

              {showHoldTooltip && (
                <div className="absolute z-30 left-2 right-2 -bottom-2 translate-y-full rounded-xl bg-[#0B1226] border border-amber-400/30 p-3 shadow-xl text-[11px] text-white/85 leading-relaxed">
                  <strong className="text-amber-300 block mb-0.5">Retenção Anti-fraude (14 a 30 dias)</strong>
                  Após a barbearia pagar a mensalidade, a comissão aguarda a confirmação definitiva para proteger contra estornos antes de ir para &ldquo;A Receber&rdquo;.
                </div>
              )}
            </div>

            {/* KPI 3: Total Já Recebido */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4 transition-all">
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-400/12 ring-1 ring-blue-400/25 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-blue-300" />
                </div>
              </div>
              <div className="text-xl lg:text-2xl font-black text-white tracking-tight">
                {brl(kpis.balance_paid)}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/65 mt-0.5">
                Total Já Recebido
              </div>
              <div className="text-[11px] text-white/45 mt-0.5 truncate">
                Histórico vitalício via Pix
              </div>
            </div>

            {/* KPI 4: Barbearias Ativas */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4 transition-all">
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-400/12 ring-1 ring-violet-400/25 flex items-center justify-center">
                  <Store className="w-4 h-4 text-violet-300" />
                </div>
                {Number(kpis.total_referrals) > 0 && (
                  <span className="text-[10px] font-semibold text-white/50">
                    {kpis.total_referrals} indicações
                  </span>
                )}
              </div>
              <div className="text-xl lg:text-2xl font-black text-white tracking-tight">
                {activeCount}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/65 mt-0.5">
                Barbearias Ativas
              </div>
              <div className="text-[11px] text-white/45 mt-0.5 truncate">
                Assinaturas gerando comissão
              </div>
            </div>
          </div>

          {/* 3. Área Operacional / Histórico: Últimas Indicações & Histórico de Comissões */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Últimas Indicações */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#93C5FD]" />
                    <h2 className="text-sm font-bold text-white">Últimas Indicações</h2>
                  </div>
                  <Link
                    to="/parceiro/indicacoes"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#93C5FD] hover:underline"
                  >
                    Ver todas <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {recentRefs.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-xl border border-dashed border-white/10 bg-white/[0.015]">
                    <div className="w-11 h-11 rounded-2xl bg-[#2563EB]/15 border border-[#60A5FA]/30 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-5 h-5 text-[#93C5FD]" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">
                      Sua primeira indicação começa aqui
                    </h3>
                    <p className="text-xs text-white/55 max-w-xs mx-auto mb-4 leading-relaxed">
                      Envie seu link para barbeiros e donos de barbearia da sua região e ganhe 30% recorrente por 12 meses.
                    </p>
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Compartilhar Link no WhatsApp
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentRefs.map((r) => {
                      const s = REF_STATUS[r.status] || REF_STATUS.pending;
                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/8"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-white truncate">
                              {r.referred_company_name || r.company_name || (
                                <span className="text-white/40 italic">Barbearia em cadastro</span>
                              )}
                            </div>
                            <div className="text-[10px] text-white/45 mt-0.5">
                              {safeFmt(r.created_at || r.created_date)}
                            </div>
                          </div>
                          <span className={`ds-badge ${s.cls}`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Histórico de Comissões */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-300" />
                    <h2 className="text-sm font-bold text-white">Histórico de Comissões</h2>
                  </div>
                  <Link
                    to="/parceiro/comissoes"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#93C5FD] hover:underline"
                  >
                    Ver extrato <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {recentComms.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-xl border border-dashed border-white/10 bg-white/[0.015]">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto mb-3">
                      <DollarSign className="w-5 h-5 text-emerald-300" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">
                      Nenhuma comissão lançada ainda
                    </h3>
                    <p className="text-xs text-white/55 max-w-xs mx-auto mb-4 leading-relaxed">
                      Assim que suas barbearias indicadas ativarem a assinatura após os 7 dias grátis, seus repasses aparecerão aqui.
                    </p>
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Compartilhar Link no WhatsApp
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentComms.map((c) => {
                      const s = COMM_STATUS[c.status] || COMM_STATUS.pending;
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/8"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white">
                              {brl(c.amount)}{' '}
                              <span className="text-white/45 font-normal">
                                · Parcela #{c.billing_cycle || 1}/12
                              </span>
                            </div>
                            <div className="text-[10px] text-white/45 mt-0.5">
                              {safeFmt(c.created_at || c.created_date)}
                            </div>
                          </div>
                          <span className={`ds-badge ${s.cls}`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Rodapé Discreto: Regras e Termos do Programa de Parceiros */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/45 border-t border-white/8">
            <span>
              Repasses via Pix consolidados todo dia 01 e pagos entre os dias 05 e 10.
            </span>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#93C5FD] hover:underline cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Regras e Termos do Programa de Parceiros
            </button>
          </div>
        </div>
      )}

      {/* Modal informativo de Regras e Termos do Programa de Parceiros */}
      {showRulesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowRulesModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-white/12 bg-[#0A1124] p-6 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                <h3 className="text-base font-bold text-white">
                  Regras e Termos do Programa de Parceiros
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-white/75 leading-relaxed">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8">
                <strong className="text-white block mb-0.5">1. Comissão Recorrente de 30% (12 meses)</strong>
                Você recebe 30% sobre cada mensalidade paga pela barbearia indicada durante até 12 faturas consecutivas (R$ 23,97/mês nos meses 1 a 3 promocionais e R$ 35,70/mês do 4º ao 12º mês).
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8">
                <strong className="text-white block mb-0.5">2. Período de Teste Gratuito (7 dias)</strong>
                Toda barbearia indicada inicia com 7 dias grátis. O saldo de comissão é gerado a partir do pagamento efetivo da mensalidade.
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8">
                <strong className="text-amber-300 block mb-0.5">3. Retenção Anti-fraude (14 a 30 dias)</strong>
                Após o pagamento da fatura pela barbearia, o valor permanece em retenção de segurança antes de ser liberado como &ldquo;A Receber&rdquo;.
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8">
                <strong className="text-emerald-300 block mb-0.5">4. Calendário de Pagamento Pix</strong>
                As comissões aprovadas são fechadas no dia 01 de cada mês e transferidas via Pix entre os dias 05 e 10 (valor mínimo de repasse: R$ 50,00).
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
              <Link
                to="/termos"
                className="text-xs font-semibold text-[#93C5FD] hover:underline"
              >
                Ver Termos de Uso completos →
              </Link>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </PartnerLayout>
  );
}