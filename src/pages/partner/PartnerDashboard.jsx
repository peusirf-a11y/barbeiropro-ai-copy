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
import { useToast } from '@/components/ui/use-toast';

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
  const { toast } = useToast();
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

  const partnerCode = partner?.referral_code || 'PARCEIROVIP';
  const referralLink = partnerCode
    ? `${OFFICIAL_DOMAIN}/landing?ref=${partnerCode}`
    : `${OFFICIAL_DOMAIN}/landing`;

  const commRate = partner?.commission_percentage || partner?.commission_rate || 30;
  const activeCount = Number(kpis.active ?? kpis.converted ?? 0);

  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        throw new Error('Clipboard indisponível');
      }
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = referralLink;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) {}
    }
    setCopiedLink(true);
    toast({
      title: 'Link copiado!',
      description: 'Seu link de indicação foi copiado para a área de transferência.',
    });
    setTimeout(() => setCopiedLink(false), 5000);
  };

  const handleCopyCode = async () => {
    if (!partnerCode) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(partnerCode);
      } else {
        throw new Error('Clipboard indisponível');
      }
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = partnerCode;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) {}
    }
    setCopiedCode(true);
    toast({
      title: 'Código copiado!',
      description: `Código ${partnerCode} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedCode(false), 5000);
  };

  const handleShareWhatsApp = () => {
    const msg =
      `Fala! Tudo bem? 💈\n\n` +
      `Estou indicando o sistema *O CORTE* para gestão completa de barbearia (agenda online, financeiro, comissões e planos de assinatura).\n\n` +
      `Cadastrando pelo meu link oficial você libera *7 dias grátis* e condição especial de lançamento:\n` +
      `👉 ${referralLink}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.location.href = waUrl;
  };

  return (
    <PartnerLayout>
      {/* Header enxuto */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-[#171827] dark:text-white">
            Olá, {partner?.name?.split(' ')[0] || 'Parceiro'} 👋
          </h1>
          <p className="text-[#55596A] dark:text-white/60 text-xs sm:text-sm mt-0.5">
            Compartilhe seu link oficial e acompanhe seus repasses via Pix.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[#59658F] dark:text-white/70 hover:text-[#2563EB] dark:hover:text-white px-3 py-1.5 rounded-lg border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] shadow-sm transition-colors cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
          Regras e Termos do Programa
        </button>
      </div>

      {/* 1. Card de Destaque: Link de Indicação Oficial */}
      <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-5 mb-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2563EB] dark:text-[#93C5FD] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
            Seu Link de Indicação Oficial
          </span>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 tabular-nums">
            {commRate}% recorrente por barbearia ativa (12 meses)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center px-3.5 py-2.5 bg-slate-50 dark:bg-white/[0.04] border border-[#E5E7EF] dark:border-[#232538] rounded-xl font-mono text-xs sm:text-sm text-[#171827] dark:text-white select-all break-all">
            {referralLink}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-sm active:scale-[0.98]"
            >
              {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-300" strokeWidth={1.75} /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
              {copiedLink ? 'Link copiado!' : 'Copiar Link'}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              title="Compartilhar no WhatsApp"
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" strokeWidth={1.75} />
              <span className="hidden md:inline">WhatsApp</span>
            </button>
          </div>
        </div>

        {copiedLink && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300 flex-shrink-0" strokeWidth={1.75} />
            <span>Link copiado com sucesso para a área de transferência!</span>
          </div>
        )}

        {/* Cupom / Código do Parceiro */}
        <div className="mt-3.5 pt-3.5 border-t border-[#E5E7EF] dark:border-[#232538] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-[#55596A] dark:text-white/65">
            <Tag className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
            <span>Cupom / Código do parceiro:</span>
            <span className="font-mono font-bold text-[#171827] dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.08] border border-[#E5E7EF] dark:border-[#232538]">
              {partnerCode || '—'}
            </span>
          </div>

          {partnerCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-[11px] font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={1.75} />
                  <span className="text-emerald-600 dark:text-emerald-300 font-bold">Código copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" strokeWidth={1.75} />
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
              <div key={i} className="h-28 bg-slate-100 dark:bg-white/[0.05] animate-pulse rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-64 bg-slate-100 dark:bg-white/[0.05] animate-pulse rounded-2xl" />
            <div className="h-64 bg-slate-100 dark:bg-white/[0.05] animate-pulse rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 2. Grade Enxuta de 4 Indicadores Essenciais (2x2 no mobile, 4 colunas no desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* KPI 1: A Receber (Próximo Pix) */}
            <div
              className={`rounded-2xl border p-4 shadow-sm transition-all ${
                Number(kpis.balance_approved) > 0
                  ? 'border-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-500/10'
                  : 'border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827]'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" strokeWidth={1.75} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Dias 05 a 10
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-black text-[#171827] dark:text-white tracking-tight tabular-nums">
                {brl(kpis.balance_approved)}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60 mt-0.5">
                A Receber (Próximo Pix)
              </div>
              <div className="text-[11px] text-[#55596A] dark:text-white/45 mt-0.5 truncate">
                Saldo aprovado para repasse
              </div>
            </div>

            {/* KPI 2: Em Retenção (Hold) com Tooltip explicativo */}
            <div className="relative rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-4 shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-300" strokeWidth={1.75} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowHoldTooltip((v) => !v)}
                  onMouseEnter={() => setShowHoldTooltip(true)}
                  onMouseLeave={() => setShowHoldTooltip(false)}
                  aria-label="Entenda o período de retenção"
                  className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.1] border border-[#E5E7EF] dark:border-white/10 flex items-center justify-center text-[#55596A] dark:text-white/55 hover:text-[#171827] dark:hover:text-white transition-colors cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
              <div className="text-xl lg:text-2xl font-black text-[#171827] dark:text-white tracking-tight tabular-nums">
                {brl(kpis.balance_pending)}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60 mt-0.5">
                Em Retenção (Hold)
              </div>
              <div className="text-[11px] text-[#55596A] dark:text-white/45 mt-0.5 truncate">
                Carência anti-fraude (14–30d)
              </div>

              {showHoldTooltip && (
                <div className="absolute z-30 left-2 right-2 -bottom-2 translate-y-full rounded-xl bg-[#171827] text-white border border-amber-500/30 p-3 shadow-xl text-[11px] leading-relaxed">
                  <strong className="text-amber-300 block mb-0.5">Retenção Anti-fraude (14 a 30 dias)</strong>
                  Após a barbearia pagar a mensalidade, a comissão aguarda a confirmação definitiva para proteger contra estornos antes de ir para &ldquo;A Receber&rdquo;.
                </div>
              )}
            </div>

            {/* KPI 3: Total Já Recebido */}
            <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-4 shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2563EB]/10 dark:bg-[#2563EB]/20 border border-[#2563EB]/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
                </div>
              </div>
              <div className="text-xl lg:text-2xl font-black text-[#171827] dark:text-white tracking-tight tabular-nums">
                {brl(kpis.balance_paid)}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60 mt-0.5">
                Total Já Recebido
              </div>
              <div className="text-[11px] text-[#55596A] dark:text-white/45 mt-0.5 truncate">
                Histórico vitalício via Pix
              </div>
            </div>

            {/* KPI 4: Barbearias Ativas */}
            <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-4 shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/20 flex items-center justify-center">
                  <Store className="w-4 h-4 text-violet-600 dark:text-violet-300" strokeWidth={1.75} />
                </div>
                {Number(kpis.total_referrals) > 0 && (
                  <span className="text-[10px] font-semibold text-[#55596A] dark:text-white/50 tabular-nums">
                    {kpis.total_referrals} indicações
                  </span>
                )}
              </div>
              <div className="text-xl lg:text-2xl font-black text-[#171827] dark:text-white tracking-tight tabular-nums">
                {activeCount}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60 mt-0.5">
                Barbearias Ativas
              </div>
              <div className="text-[11px] text-[#55596A] dark:text-white/45 mt-0.5 truncate">
                Assinaturas gerando comissão
              </div>
            </div>
          </div>

          {/* 3. Área Operacional / Histórico: Últimas Indicações & Histórico de Comissões */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Últimas Indicações */}
            <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
                    <h2 className="text-sm font-bold text-[#171827] dark:text-white">Últimas Indicações</h2>
                  </div>
                  <Link
                    to="/parceiro/indicacoes"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline"
                  >
                    Ver todas <ArrowRight className="w-3 h-3" strokeWidth={1.75} />
                  </Link>
                </div>

                {recentRefs.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[#E5E7EF] dark:border-[#232538] bg-slate-50 dark:bg-white/[0.015]">
                    <div className="w-11 h-11 rounded-2xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-5 h-5 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-sm font-bold text-[#171827] dark:text-white mb-1">
                      Sua primeira indicação começa aqui
                    </h3>
                    <p className="text-xs text-[#55596A] dark:text-white/55 max-w-xs mx-auto mb-4 leading-relaxed">
                      Envie seu link para barbeiros e donos de barbearia da sua região e ganhe 30% recorrente por 12 meses.
                    </p>
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
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
                          className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-[#E5E7EF] dark:border-[#232538]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-[#171827] dark:text-white truncate">
                              {r.referred_company_name || r.company_name || (
                                <span className="text-slate-400 dark:text-white/40 italic">Barbearia em cadastro</span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#55596A] dark:text-white/45 mt-0.5 tabular-nums">
                              {safeFmt(r.created_at || r.created_date)}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Histórico de Comissões */}
            <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-300" strokeWidth={1.75} />
                    <h2 className="text-sm font-bold text-[#171827] dark:text-white">Histórico de Comissões</h2>
                  </div>
                  <Link
                    to="/parceiro/comissoes"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline"
                  >
                    Ver extrato <ArrowRight className="w-3 h-3" strokeWidth={1.75} />
                  </Link>
                </div>

                {recentComms.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[#E5E7EF] dark:border-[#232538] bg-slate-50 dark:bg-white/[0.015]">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                      <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-300" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-sm font-bold text-[#171827] dark:text-white mb-1">
                      Nenhuma comissão lançada ainda
                    </h3>
                    <p className="text-xs text-[#55596A] dark:text-white/55 max-w-xs mx-auto mb-4 leading-relaxed">
                      Assim que suas barbearias indicadas ativarem a assinatura após os 7 dias grátis, seus repasses aparecerão aqui.
                    </p>
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
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
                          className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-[#E5E7EF] dark:border-[#232538]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[#171827] dark:text-white tabular-nums">
                              {brl(c.amount)}{' '}
                              <span className="text-[#55596A] dark:text-white/45 font-normal">
                                · Parcela #{c.billing_cycle || 1}/12
                              </span>
                            </div>
                            <div className="text-[10px] text-[#55596A] dark:text-white/45 mt-0.5 tabular-nums">
                              {safeFmt(c.created_at || c.created_date)}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Rodapé Discreto: Regras e Termos do Programa de Parceiros */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#55596A] dark:text-white/50 border-t border-[#E5E7EF] dark:border-[#232538]">
            <span>
              Repasses via Pix consolidados todo dia 01 e pagos entre os dias 05 e 10.
            </span>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
              Regras e Termos do Programa de Parceiros
            </button>
          </div>
        </div>
      )}

      {/* Modal informativo de Regras e Termos do Programa de Parceiros */}
      {showRulesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowRulesModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-6 text-[#171827] dark:text-white shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E5E7EF] dark:border-[#232538]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-300" strokeWidth={1.75} />
                <h3 className="text-base font-bold text-[#171827] dark:text-white">
                  Regras e Termos do Programa de Parceiros
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-[#55596A] dark:text-white/60 hover:text-[#171827] dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-[#55596A] dark:text-white/75 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-[#E5E7EF] dark:border-[#232538]">
                <strong className="text-[#171827] dark:text-white block mb-0.5">1. Comissão Recorrente de 30% (12 meses)</strong>
                Você recebe 30% sobre cada mensalidade paga pela barbearia indicada durante até 12 faturas consecutivas (R$ 23,97/mês nos meses 1 a 3 promocionais e R$ 35,70/mês do 4º ao 12º mês).
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-[#E5E7EF] dark:border-[#232538]">
                <strong className="text-[#171827] dark:text-white block mb-0.5">2. Período de Teste Gratuito (7 dias)</strong>
                Toda barbearia indicada inicia com 7 dias grátis. O saldo de comissão é gerado a partir do pagamento efetivo da mensalidade.
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-[#E5E7EF] dark:border-[#232538]">
                <strong className="text-amber-600 dark:text-amber-300 block mb-0.5">3. Retenção Anti-fraude (14 a 30 dias)</strong>
                Após o pagamento da fatura pela barbearia, o valor permanece em retenção de segurança antes de ser liberado como &ldquo;A Receber&rdquo;.
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-[#E5E7EF] dark:border-[#232538]">
                <strong className="text-emerald-600 dark:text-emerald-300 block mb-0.5">4. Calendário de Pagamento Pix</strong>
                As comissões aprovadas são fechadas no dia 01 de cada mês e transferidas via Pix entre os dias 05 e 10 (valor mínimo de repasse: R$ 50,00).
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#E5E7EF] dark:border-[#232538] flex items-center justify-between gap-3">
              <Link
                to="/termos"
                className="text-xs font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline"
              >
                Ver Termos de Uso completos →
              </Link>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
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