// Drawer lateral com detalhe completo do parceiro.
// Mostra: dados pessoais, KPIs, indicações recentes, comissões recentes, ações rápidas.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import {
  X, Mail, Phone, FileText, Key, Hash, Calendar, ShieldCheck,
  Pause, Play, CheckCircle2, Pencil, ExternalLink, AlertTriangle, Copy,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

const STATUS_PARTNER = {
  pending: { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  suspended: { label: 'Suspenso', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
};

const STATUS_REF = {
  pending: 'bg-white/8 text-white/70',
  converted: 'bg-amber-500/15 text-amber-200',
  active: 'bg-emerald-500/15 text-emerald-200',
  cancelled: 'bg-rose-500/10 text-rose-200',
  fraud: 'bg-rose-500/25 text-rose-200',
};

const STATUS_COMM = {
  pending: 'bg-amber-500/15 text-amber-200',
  approved: 'bg-emerald-500/15 text-emerald-200',
  paid: 'bg-blue-500/15 text-blue-200',
  cancelled: 'bg-rose-500/10 text-rose-200',
  chargeback: 'bg-rose-500/25 text-rose-200',
};

export default function PartnerDetailDrawer({ partnerId, onClose, onEdit, onAction }) {
  const open = !!partnerId;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const detailQ = useQuery({
    queryKey: ['partner', 'detail', partnerId],
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerAdminAction', {
        action: 'partner_detail', partner_id: partnerId,
      });
      return res?.data;
    },
    enabled: !!partnerId,
    staleTime: 15_000,
    retry: false,
  });

  if (!open) return null;

  const data = detailQ.data;
  const p = data?.partner;
  const s = data?.summary;
  const status = p ? (STATUS_PARTNER[p.status] || STATUS_PARTNER.pending) : null;

  const copyToClipboard = (text, label) => {
    navigator.clipboard?.writeText(text);
    toast({ title: 'Copiado', description: `${label} copiado.` });
  };

  const drawer = (
    <div className="fixed inset-0 z-[9999] flex justify-end animate-fade-in" onClick={onClose} aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative h-full w-full sm:max-w-xl bg-[#0A1124] border-l border-white/8 shadow-[0_30px_80px_rgba(0,0,0,0.7)] flex flex-col animate-slide-up sm:animate-fade-in overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-white truncate">{p?.name || 'Carregando...'}</h3>
              {status && <span className={`ds-badge ${status.cls}`}>{status.label}</span>}
            </div>
            {p?.email && <p className="text-xs text-white/55 truncate">{p.email}</p>}
          </div>
          <button onClick={onClose} className="p-2 -mr-2 hover:bg-white/10 rounded-lg flex-shrink-0" aria-label="Fechar">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 py-4 space-y-5">
          {detailQ.isError ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              <div className="font-bold mb-1">Erro ao carregar parceiro</div>
              <div className="text-xs text-rose-200/80">{detailQ.error?.message || 'Tente novamente em instantes.'}</div>
              <button onClick={() => detailQ.refetch()} className="mt-3 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-semibold">Tentar de novo</button>
            </div>
          ) : detailQ.isLoading || !p ? (
            <div className="space-y-3">
              <div className="h-20 rounded-xl skeleton" />
              <div className="h-32 rounded-xl skeleton" />
              <div className="h-32 rounded-xl skeleton" />
            </div>
          ) : (
            <>
              {/* KPIs do parceiro */}
              <div className="grid grid-cols-2 gap-2.5">
                <MiniStat label="Indicações" value={s.referrals_total} sub={`${s.referrals_active} pagando`} />
                <MiniStat label="Convertidas" value={s.referrals_converted} sub={s.referrals_fraud > 0 ? `${s.referrals_fraud} fraude` : 'sem alertas'} alert={s.referrals_fraud > 0} />
                <MiniStat label="A pagar" value={brl(s.commissions_to_pay_amount)} sub="aprovadas" highlight={s.commissions_to_pay_amount > 0} />
                <MiniStat label="Pago total" value={brl(s.commissions_paid_amount)} sub={`${s.commissions_total_count} comissão(ões)`} />
              </div>

              {/* Dados cadastrais */}
              <Section title="Dados cadastrais">
                <InfoRow icon={Hash} label="Código de indicação" value={p.referral_code} mono onCopy={() => copyToClipboard(p.referral_code, 'Código')} />
                <InfoRow icon={Mail} label="Email" value={p.email} onCopy={() => copyToClipboard(p.email, 'Email')} />
                <InfoRow icon={Phone} label="Telefone" value={p.phone || '—'} />
                <InfoRow icon={FileText} label="CPF/CNPJ" value={p.cpf_cnpj || '—'} mono />
                <InfoRow icon={Key} label="Chave PIX" value={p.pix_key || '—'} mono onCopy={p.pix_key ? () => copyToClipboard(p.pix_key, 'PIX') : null} />
                <InfoRow icon={ShieldCheck} label="Comissão" value={`${p.commission_percentage}%`} />
                <InfoRow icon={Calendar} label="Cadastro" value={format(new Date(p.created_date), 'dd MMM yyyy · HH:mm', { locale: ptBR })} />
                {p.approved_at && (
                  <InfoRow icon={CheckCircle2} label="Aprovado em" value={`${format(new Date(p.approved_at), 'dd MMM yyyy', { locale: ptBR })} por ${p.approved_by || '—'}`} />
                )}
                {p.suspended_at && (
                  <InfoRow icon={AlertTriangle} label="Suspenso em" value={`${format(new Date(p.suspended_at), 'dd MMM yyyy', { locale: ptBR })} — ${p.suspension_reason || 'sem motivo'}`} alert />
                )}
              </Section>

              {/* Notas */}
              {p.notes && (
                <Section title="Notas internas">
                  <p className="text-sm text-white/75 whitespace-pre-wrap leading-relaxed">{p.notes}</p>
                </Section>
              )}

              {/* Indicações recentes */}
              <Section title={`Indicações recentes (${data.referrals.length})`}>
                {data.referrals.length === 0 ? (
                  <p className="text-xs text-white/45">Nenhuma indicação ainda.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.referrals.slice(0, 8).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate">
                            {r.referred_company_name || <span className="text-white/40 italic">Pendente</span>}
                          </div>
                          <div className="text-[10px] text-white/45">
                            {format(new Date(r.created_date), 'dd MMM yyyy', { locale: ptBR })}
                          </div>
                        </div>
                        <span className={`ds-badge ${STATUS_REF[r.status] || STATUS_REF.pending} border-white/10`}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Comissões recentes */}
              <Section title={`Comissões recentes (${data.commissions.length})`}>
                {data.commissions.length === 0 ? (
                  <p className="text-xs text-white/45">Nenhuma comissão gerada.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.commissions.slice(0, 8).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white">{brl(c.amount)} · #{c.billing_cycle}</div>
                          <div className="text-[10px] text-white/45">
                            {format(new Date(c.created_date), 'dd MMM yyyy', { locale: ptBR })}
                          </div>
                        </div>
                        <span className={`ds-badge ${STATUS_COMM[c.status] || STATUS_COMM.pending} border-white/10`}>
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>

        {/* Footer com ações rápidas */}
        {p && (
          <div className="flex-shrink-0 border-t border-white/8 bg-[#0A1124] px-5 py-3 flex flex-wrap gap-2">
            <button onClick={() => onEdit?.(p)} className="flex-1 min-w-[120px] min-h-[40px] px-3 inline-flex items-center justify-center gap-2 border border-white/10 rounded-lg text-xs font-semibold text-white/80 bg-white/[0.03] hover:bg-white/[0.06]">
              <Pencil className="w-3.5 h-3.5" />Editar
            </button>
            {p.status === 'pending' && (
              <button onClick={() => onAction?.({ action: 'approve_partner', partner_id: p.id })}
                className="flex-1 min-w-[120px] min-h-[40px] px-3 inline-flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 rounded-lg text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />Aprovar
              </button>
            )}
            {p.status === 'active' && (
              <button onClick={() => {
                const reason = prompt('Motivo da suspensão:');
                if (reason !== null) onAction?.({ action: 'suspend_partner', partner_id: p.id, reason });
              }} className="flex-1 min-w-[120px] min-h-[40px] px-3 inline-flex items-center justify-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-200 rounded-lg text-xs font-semibold">
                <Pause className="w-3.5 h-3.5" />Suspender
              </button>
            )}
            {p.status === 'suspended' && (
              <button onClick={() => onAction?.({ action: 'activate_partner', partner_id: p.id })}
                className="flex-1 min-w-[120px] min-h-[40px] px-3 inline-flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 rounded-lg text-xs font-semibold">
                <Play className="w-3.5 h-3.5" />Reativar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(drawer, document.body) : null;
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45 mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono, alert, onCopy }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${alert ? 'bg-rose-500/10 border border-rose-400/25' : 'bg-white/[0.03] border border-white/8'}`}>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${alert ? 'text-rose-300' : 'text-white/45'}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-white/45 uppercase tracking-wider">{label}</div>
        <div className={`text-xs ${alert ? 'text-rose-200' : 'text-white'} ${mono ? 'font-mono' : 'font-semibold'} truncate`}>{value}</div>
      </div>
      {onCopy && (
        <button onClick={onCopy} className="p-1.5 hover:bg-white/10 rounded text-white/50 hover:text-white/80 flex-shrink-0" title="Copiar">
          <Copy className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, highlight, alert }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'border-blue-400/35 bg-blue-500/[0.08]' : alert ? 'border-rose-400/25 bg-rose-500/[0.06]' : 'border-white/8 bg-white/[0.03]'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/55 mb-1">{label}</div>
      <div className="text-lg font-black text-white tracking-tight">{value}</div>
      <div className={`text-[10px] mt-0.5 ${alert ? 'text-rose-300' : 'text-white/45'}`}>{sub}</div>
    </div>
  );
}