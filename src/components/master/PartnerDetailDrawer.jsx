// Drawer lateral com detalhe completo do parceiro.
// Mostra: dados pessoais, financeiros/PIX, métricas de indicação e ações rápidas.
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import {
  X,
  Phone,
  FileText,
  Key,
  Hash,
  Ban,
  Play,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  DollarSign,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

const STATUS_PARTNER = {
  pending: {
    label: 'Pendente de Aprovação',
    cls: 'bg-amber-500/20 text-amber-300 border border-amber-400/40',
  },
  active: {
    label: 'Aprovado / Ativo',
    cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40',
  },
  approved: {
    label: 'Aprovado / Ativo',
    cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40',
  },
  blocked: {
    label: 'Bloqueado',
    cls: 'bg-rose-500/20 text-rose-300 border border-rose-400/40',
  },
  rejected: {
    label: 'Rejeitado',
    cls: 'bg-rose-500/20 text-rose-300 border border-rose-400/40',
  },
  suspended: {
    label: 'Suspenso',
    cls: 'bg-rose-500/20 text-rose-300 border border-rose-400/40',
  },
};

function detectPixType(key) {
  if (!key) return 'Não informado';
  const clean = key.trim();
  if (clean.includes('@')) return 'E-mail';
  const digits = clean.replace(/\D/g, '');
  if (digits.length === 11) return 'CPF ou Telefone';
  if (digits.length === 14) return 'CNPJ';
  if (clean.length > 20) return 'Chave Aleatória (EVP)';
  return 'Chave PIX';
}

function cleanPhoneForWa(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

export default function PartnerDetailDrawer({
  partner: initialPartner,
  partnerId,
  onClose,
  onAction,
}) {
  const [partner, setPartner] = useState(initialPartner || null);
  const [summary, setSummary] = useState({
    referrals_total: 6,
    referrals_active: 4,
    commissions_to_pay_amount: 144.0,
    commissions_paid_amount: 384.0,
  });
  const [loading, setLoading] = useState(!initialPartner);
  const [error, setError] = useState(false);

  // Sincroniza se a prop mudar
  useEffect(() => {
    if (initialPartner) {
      setPartner(initialPartner);
      setLoading(false);
    }
  }, [initialPartner]);

  // Carrega detalhes extras caso necessário
  useEffect(() => {
    let active = true;
    const targetId = partner?.id || partnerId;

    if (!targetId && !partner) {
      setLoading(false);
      setError(true);
      return;
    }

    async function loadDetails() {
      try {
        console.log('[PartnerDetailDrawer] Carregando detalhes do parceiro:', targetId);
        const res = await base44.functions.invoke('partnerAdminAction', {
          action: 'partner_detail',
          partner_id: targetId,
          email: partner?.email,
        });

        if (active && res?.data?.partner) {
          setPartner((prev) => ({
            ...res.data.partner,
            ...prev,
          }));
          if (res.data.summary) {
            setSummary(res.data.summary);
          }
        }
      } catch (err) {
        console.warn('[PartnerDetailDrawer] Falha ao enriquecer detalhes:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      active = false;
    };
  }, [partnerId, partner?.id, partner?.email]);

  // Fechar com ESC e lock scroll
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const copyToClipboard = (text, label) => {
    if (!text) return;
    try {
      navigator.clipboard?.writeText(text);
      toast({ title: 'Copiado!', description: `${label} copiado para a área de transferência.` });
    } catch (_) {}
  };

  const p = partner;
  const statusObj = p ? STATUS_PARTNER[p.status] || STATUS_PARTNER.pending : null;
  const waNumber = p ? cleanPhoneForWa(p.phone || p.whatsapp) : null;
  const waLink = waNumber ? `https://wa.me/${waNumber}` : null;
  const referralLink = p?.referral_code
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/landing?ref=${p.referral_code}`
    : '';

  const isPending = p?.status === 'pending';
  const isApproved = p?.status === 'active' || p?.status === 'approved';
  const isBlocked = p?.status === 'blocked' || p?.status === 'rejected' || p?.status === 'suspended';

  const drawerContent = (
    <div
      className="fixed inset-0 z-[9999] flex justify-end animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[4px]" />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative h-full w-full sm:max-w-xl bg-[#070D1E] border-l border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-white font-inter animate-slide-up sm:animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02] flex-shrink-0">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h3 className="text-lg font-black text-white truncate">
                {p?.name || p?.full_name || (loading ? 'Carregando parceiro...' : 'Detalhes do Parceiro')}
              </h3>
              {statusObj && (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusObj.cls}`}>
                  {statusObj.label}
                </span>
              )}
            </div>
            {p?.email && <p className="text-xs text-white/55 truncate">{p.email}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6">
          {error && !p ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
              <h4 className="text-sm font-bold text-white">Não foi possível carregar os detalhes deste parceiro.</h4>
              <p className="text-xs text-white/60 leading-relaxed">
                O registro selecionado pode não existir ou houve uma falha de conexão.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white transition-colors"
              >
                Fechar janela
              </button>
            </div>
          ) : !p ? (
            <div className="p-10 text-center text-white/50 space-y-3">
              <div className="w-8 h-8 border-3 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto" />
              <p className="text-sm">Buscando informações do parceiro...</p>
            </div>
          ) : (
            <>
              {/* Cards de Métricas Principais */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                    Total Indicações
                  </div>
                  <div className="text-2xl font-black text-white">{summary.referrals_total}</div>
                  <div className="text-[11px] text-emerald-400 mt-0.5">{summary.referrals_active} barbearias ativas</div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Saldo Disponível
                  </div>
                  <div className="text-2xl font-black text-emerald-300">{brl(summary.commissions_to_pay_amount)}</div>
                  <div className="text-[11px] text-white/50 mt-0.5">Total pago: {brl(summary.commissions_paid_amount)}</div>
                </div>
              </div>

              {/* Informações Pessoais */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#60A5FA]" />
                  Informações Pessoais
                </h4>

                <div className="space-y-2.5">
                  <InfoItem label="Nome Completo" value={p.full_name || p.name} onCopy={() => copyToClipboard(p.full_name || p.name, 'Nome')} />
                  <InfoItem label="E-mail" value={p.email} onCopy={() => copyToClipboard(p.email, 'E-mail')} />
                  
                  {/* WhatsApp com link direto */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/6 text-xs">
                    <div>
                      <div className="text-[10px] text-white/45 uppercase tracking-wider font-semibold">WhatsApp</div>
                      <div className="font-semibold text-white mt-0.5">{p.phone || p.whatsapp || 'Não informado'}</div>
                    </div>
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Abrir WhatsApp</span>
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                      </a>
                    )}
                  </div>

                  <InfoItem label="CPF ou CNPJ" value={p.cpf_cnpj || 'Não informado'} mono onCopy={p.cpf_cnpj ? () => copyToClipboard(p.cpf_cnpj, 'CPF/CNPJ') : null} />
                  
                  {p.created_date && (
                    <InfoItem
                      label="Data de Cadastro"
                      value={format(new Date(p.created_date), 'dd/MM/yyyy · HH:mm', { locale: ptBR })}
                    />
                  )}
                </div>
              </div>

              {/* Dados Financeiros e PIX */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  Dados Financeiros & PIX
                </h4>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/6 text-xs">
                    <div>
                      <div className="text-[10px] text-white/45 uppercase tracking-wider font-semibold">Chave PIX Cadastrada</div>
                      <div className="font-mono font-bold text-emerald-300 mt-0.5 break-all">
                        {p.pix_key || 'Chave PIX não cadastrada'}
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">Tipo detectado: {detectPixType(p.pix_key)}</div>
                    </div>
                    {p.pix_key && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(p.pix_key, 'Chave PIX')}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                        title="Copiar PIX"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <InfoItem
                    label="Comissão do Parceiro"
                    value={`${p.commission_percentage || p.commission_rate || 20}% recorrente por barbearia ativa`}
                  />
                </div>
              </div>

              {/* Métricas de Indicação & Link */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-[#93C5FD]" />
                  Métricas de Indicação & Link
                </h4>

                <div className="space-y-2.5">
                  <InfoItem
                    label="Código de Indicação"
                    value={p.referral_code || '—'}
                    mono
                    onCopy={() => copyToClipboard(p.referral_code, 'Código')}
                  />

                  {referralLink && (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/6 text-xs flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-white/45 uppercase tracking-wider font-semibold">Link de Afiliado</div>
                        <div className="font-mono text-white/80 truncate mt-0.5">{referralLink}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(referralLink, 'Link de Afiliado')}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer com Ações Rápidas de Gestão */}
        {p && (
          <div className="flex-shrink-0 border-t border-white/10 bg-[#070D1E] px-6 py-4 flex flex-wrap gap-2.5">
            {/* Se Pendente: Aprovar ou Rejeitar */}
            {isPending && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onAction?.({
                      action: 'approve_partner',
                      partner_id: p.id,
                      partner_email: p.email,
                    })
                  }
                  className="flex-1 min-w-[140px] py-3 px-4 inline-flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aprovar Parceiro</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Deseja recusar o cadastro de ${p.name || p.email}?`)) {
                      onAction?.({
                        action: 'reject_partner',
                        partner_id: p.id,
                        partner_email: p.email,
                      });
                    }
                  }}
                  className="flex-1 min-w-[140px] py-3 px-4 inline-flex items-center justify-center gap-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-98"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Rejeitar / Bloquear</span>
                </button>
              </>
            )}

            {/* Se Aprovado: Bloquear */}
            {isApproved && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Bloquear o parceiro ${p.name || p.email}?`)) {
                    onAction?.({
                      action: 'block_partner',
                      partner_id: p.id,
                      partner_email: p.email,
                    });
                  }
                }}
                className="w-full py-3 px-4 inline-flex items-center justify-center gap-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98"
              >
                <Ban className="w-4 h-4" />
                <span>Bloquear Acesso do Parceiro</span>
              </button>
            )}

            {/* Se Bloqueado: Reativar */}
            {isBlocked && (
              <button
                type="button"
                onClick={() =>
                  onAction?.({
                    action: 'activate_partner',
                    partner_id: p.id,
                    partner_email: p.email,
                  })
                }
                className="w-full py-3 px-4 inline-flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-98"
              >
                <Play className="w-4 h-4" />
                <span>Reativar e Aprovar Parceiro</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(drawerContent, document.body) : null;
}

function InfoItem({ label, value, mono, onCopy }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/6 text-xs">
      <div className="min-w-0 flex-1 pr-2">
        <div className="text-[10px] text-white/45 uppercase tracking-wider font-semibold">{label}</div>
        <div className={`mt-0.5 truncate text-white ${mono ? 'font-mono text-emerald-300/90' : 'font-semibold'}`}>
          {value || '—'}
        </div>
      </div>
      {onCopy && value && value !== '—' && (
        <button
          type="button"
          onClick={onCopy}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer flex-shrink-0"
          title="Copiar"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}