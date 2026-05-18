// Modal completo de edição de agendamento — horário, profissional, serviço, status, observações.
// Valida conflitos antes de salvar e usa update otimista no parent para UI imediata.

import { useState, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { STATUS_TOKENS } from '@/lib/statusTokens';
import CustomerTypeBadge from '@/components/agenda/CustomerTypeBadge';
import OfferPlanInlineBanner from '@/components/agenda/OfferPlanInlineBanner';
import OfferPlanModal from '@/components/clientes/OfferPlanModal';
import { useCompany } from '@/hooks/useCompany';
import MobileSelect from '@/components/ui/mobile-select';
import StandardModal from '@/components/ui/standard-modal';
import {
  buildConfirmationMessage,
  buildCancellationMessage,
  buildNoShowMessage,
  buildPostAppointmentMessage,
  openWhatsApp,
} from '@/lib/whatsappCompose';
import StatusActionSheet from '@/components/agenda/StatusActionSheet';
import { safeArray } from '@/lib/safeArray';

const STATUS_KEYS = ['agendado', 'confirmado', 'concluido', 'cancelado', 'faltou'];

// Converte ISO/Date para o formato exigido pelo input datetime-local (sem TZ)
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditAppointmentModal({
  appointment,
  professionals,
  services,
  customers,
  isBarbeiro,
  hasConflict,        // (proId, dateTime, serviceId, excludeId) => boolean
  hitsBlock,          // (proId, dateTime, serviceId) => boolean
  onSave,             // ({ id, data }) => void  (otimista: parent atualiza cache)
  onDelete,           // (id) => void
  onClose,            // () => void
  isSaving,
}) {
  const [form, setForm] = useState({
    professional_id: appointment.professional_id || '',
    service_id: appointment.service_id || '',
    scheduled_at: toLocalInput(appointment.scheduled_at),
    status: appointment.status || 'agendado',
    notes: appointment.notes || '',
    paid: !!appointment.paid || !!appointment.paid_online,
  });
  const [error, setError] = useState('');
  const [showOffer, setShowOffer] = useState(false);
  // Action sheet: { key } quando aberto, null fechado.
  const [pendingStatus, setPendingStatus] = useState(null);
  const { company, companyId } = useCompany();
  const safeCustomers = safeArray(customers);
  const safeServices = safeArray(services);
  const safeProfessionals = safeArray(professionals);
  const customer = safeCustomers.find(c => c.id === appointment.customer_id);

  // Status que merecem perguntar "+ WhatsApp?": confirmar/cancelar/faltou/concluido.
  // "concluido" abre opção manual de enviar o link de avaliação imediatamente,
  // sem esperar o job automático (que roda ~2h depois).
  // "agendado" é estado neutro — só seta sem perguntar.
  const STATUS_NEEDS_WA = ['confirmado', 'cancelado', 'faltou', 'concluido'];

  const handleStatusClick = (key) => {
    // Mesmo status → no-op
    if (key === form.status) return;
    // Status que não pergunta nada → só altera
    if (!STATUS_NEEDS_WA.includes(key)) {
      setForm(p => ({ ...p, status: key }));
      return;
    }
    // Abre action sheet
    setPendingStatus({ key });
  };

  // Action sheet escolheu "apenas alterar" — seta o status no form.
  const handleStatusOnly = () => {
    if (!pendingStatus) return;
    setForm(p => ({ ...p, status: pendingStatus.key }));
    setPendingStatus(null);
  };

  // Action sheet escolheu "alterar + WhatsApp" — seta status e abre wa.me.
  // Ordem importa: status PRIMEIRO (não depende do WA). WA é só camada UX.
  const handleStatusWithWhatsApp = () => {
    if (!pendingStatus) return;
    const key = pendingStatus.key;
    setForm(p => ({ ...p, status: key }));
    setPendingStatus(null);

    if (!appointment.customer_phone) return;

    let message = '';
    if (key === 'confirmado') {
      message = buildConfirmationMessage({ company, appointment });
    } else if (key === 'cancelado') {
      message = buildCancellationMessage({ company, appointment });
    } else if (key === 'faltou') {
      message = buildNoShowMessage({ company, appointment });
    } else if (key === 'concluido') {
      // Usa review_token já presente no appointment (gerado pelo onAppointmentConcluded)
      // ou o link externo do Google configurado pela barbearia.
      const baseUrl = window.location.origin;
      const reviewLink = appointment.review_token
        ? `${baseUrl}/avaliar/${appointment.review_token}`
        : (company?.whatsapp_settings?.review_link || '');
      message = buildPostAppointmentMessage({ company, appointment, reviewLink });
    }
    if (message) openWhatsApp(appointment.customer_phone, message);
  };

  const service = safeServices.find(s => s.id === form.service_id);
  // custom_duration_minutes (definido por resize manual) sobrescreve a duração padrão
  const duration = appointment.custom_duration_minutes || service?.duration_minutes || 30;

  // Hora de fim derivada (apenas exibição)
  const endTime = useMemo(() => {
    if (!form.scheduled_at) return '';
    const start = new Date(form.scheduled_at);
    if (Number.isNaN(start.getTime())) return '';
    const end = new Date(start.getTime() + duration * 60_000);
    return format(end, 'HH:mm');
  }, [form.scheduled_at, duration]);

  const handleSave = () => {
    setError('');
    if (!form.professional_id || !form.service_id || !form.scheduled_at) {
      setError('Preencha profissional, serviço e horário.');
      return;
    }
    const dt = new Date(form.scheduled_at);
    if (Number.isNaN(dt.getTime())) {
      setError('Horário inválido.');
      return;
    }
    if (hasConflict(form.professional_id, dt, form.service_id, appointment.id)) {
      setError('Conflito de horário: este profissional já tem outro agendamento neste horário.');
      return;
    }
    if (hitsBlock(form.professional_id, dt, form.service_id)) {
      setError('Horário bloqueado (almoço/folga/evento). Escolha outro horário.');
      return;
    }
    const pro = safeProfessionals.find(p => p.id === form.professional_id);
    const svc = safeServices.find(s => s.id === form.service_id);
    // Marcação paralela "pago": só altera quando o usuário mexeu no toggle.
    // Não toca em paid_online (que é exclusivo do Stripe).
    const wasPaid = !!appointment.paid;
    const paidPatch = form.paid !== wasPaid
      ? {
          paid: form.paid,
          paid_at: form.paid ? new Date().toISOString() : null,
        }
      : {};

    onSave({
      id: appointment.id,
      data: {
        professional_id: form.professional_id,
        professional_name: pro?.name || appointment.professional_name,
        service_id: form.service_id,
        service_name: svc?.name || appointment.service_name,
        scheduled_at: dt.toISOString(),
        status: form.status,
        notes: form.notes,
        price: svc?.price ?? appointment.price,
        ...paidPatch,
      },
    });
  };

  const footer = (
    <>
      <button
        onClick={onClose}
        className="flex-1 min-h-[48px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors"
      >
        Cancelar
      </button>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15"
      >
        {isSaving ? 'Salvando…' : 'Salvar'}
      </button>
    </>
  );

  return (
    <>
      <StandardModal
        open
        onClose={onClose}
        title="Editar agendamento"
        size="lg"
        footer={footer}
      >
        {/* Gatilho inteligente: cliente frequente sem assinatura → oferece plano */}
        {!isBarbeiro && companyId && appointment.customer_id && (
          <OfferPlanInlineBanner
            companyId={companyId}
            customerId={appointment.customer_id}
            onOffer={() => setShowOffer(true)}
          />
        )}

        {/* Identificação do cliente (read-only) */}
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] text-white/50 block">Cliente</span>
              <p className="font-semibold text-sm text-white">{appointment.customer_name}</p>
              <div className="mt-1"><CustomerTypeBadge customer={safeCustomers.find(c => c.id === appointment.customer_id)} /></div>
            </div>
            <div>
              <span className="text-[11px] text-white/50 block">Telefone</span>
              <p className="font-semibold text-sm text-white">{appointment.customer_phone || '–'}</p>
            </div>
          </div>
        </div>

        {/* Campos editáveis */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-white/60 block mb-1">Serviço *</label>
            <MobileSelect
              value={form.service_id}
              onChange={v => setForm(p => ({ ...p, service_id: v }))}
              disabled={isBarbeiro}
              placeholder="Selecionar serviço"
              className="w-full px-3 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Selecionar serviço</option>
              {safeServices.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min · R${s.price}</option>
              ))}
            </MobileSelect>
          </div>

          <div>
            <label className="text-xs font-semibold text-white/60 block mb-1">Profissional *</label>
            <MobileSelect
              value={form.professional_id}
              onChange={v => setForm(p => ({ ...p, professional_id: v }))}
              disabled={isBarbeiro}
              placeholder="Selecionar profissional"
              className="w-full px-3 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Selecionar profissional</option>
              {safeProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </MobileSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Início *</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Fim (calculado)</label>
              <div className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-sm bg-white/[0.02] text-white/70">
                {endTime || '–'} <span className="text-[11px] text-white/45">· {duration}min</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-white/60 block mb-1.5">Status</span>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_KEYS.map(key => {
                const t = STATUS_TOKENS[key];
                const active = form.status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleStatusClick(key)}
                    className={`text-xs font-medium px-2 py-2 rounded-lg border transition-all ${active ? `${t.pill} ring-2 ring-offset-1 ring-offset-[#0A1124] ring-current` : 'bg-white/[0.03] text-white/65 border-white/10 hover:bg-white/[0.06] hover:text-white'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Marcação paralela: pago. Independe do status (cliente pode estar
              "agendado" mas já ter pago; ou "concluído" mas ainda não ter pago). */}
          <div>
            <span className="text-xs font-semibold text-white/60 block mb-1.5">Pagamento</span>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, paid: !p.paid }))}
              disabled={appointment.paid_online}
              title={appointment.paid_online ? 'Pago online via Stripe — não é possível alterar' : ''}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                form.paid
                  ? 'bg-emerald-400/15 text-emerald-200 border-emerald-400/40 ring-2 ring-emerald-400/25'
                  : 'bg-white/[0.03] text-white/65 border-white/10 hover:bg-white/[0.06] hover:text-white'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <span className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.paid ? 'bg-emerald-500 border-emerald-400' : 'border-white/30 bg-white/5'}`}>
                  {form.paid && <span className="text-white text-[10px] leading-none">✓</span>}
                </span>
                {form.paid ? 'Pago' : 'Marcar como pago'}
              </span>
              {appointment.paid_online && (
                <span className="text-[10px] font-bold uppercase bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.5 rounded">Online</span>
              )}
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-white/60 block mb-1">Observações</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-rose-200 text-sm bg-rose-500/10 border border-rose-400/30 rounded-lg p-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        {!isBarbeiro && onDelete && (
          <button
            onClick={() => { if (confirm('Excluir este agendamento?')) onDelete(appointment.id); }}
            className="w-full text-xs text-rose-300 hover:text-rose-200 font-medium py-2 mt-3 transition-colors"
          >
            Excluir agendamento
          </button>
        )}
      </StandardModal>

      {showOffer && customer && (
        <OfferPlanModal
          companyId={companyId}
          customer={customer}
          onClose={() => setShowOffer(false)}
        />
      )}

      {/* Action sheet de confirmação ao mudar status — pergunta se envia WA */}
      <StatusActionSheet
        open={!!pendingStatus}
        statusKey={pendingStatus?.key}
        hasPhone={!!appointment.customer_phone}
        onChooseOnly={handleStatusOnly}
        onChooseWithWhatsApp={handleStatusWithWhatsApp}
        onClose={() => setPendingStatus(null)}
      />
    </>
  );
}