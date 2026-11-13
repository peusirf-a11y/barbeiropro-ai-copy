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
  resolveReviewLink,
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
  const customer = safeCustomers.find(c => c.id === appointment.customer_id)
    || safeCustomers.find(c => (c.name || '').toLowerCase() === (appointment.customer_name || '').toLowerCase())
    || (appointment.customer_id ? { id: appointment.customer_id, name: appointment.customer_name || 'Cliente', phone: appointment.customer_phone || '' } : null);

  // Status que merecem perguntar "+ WhatsApp?": confirmar/cancelar/faltou/concluido.
  // "concluido" abre opção manual de enviar o link de avaliação imediatamente,
  // sem esperar o job automático (que roda ~2h depois).
  // "agendado" é estado neutro — só seta sem perguntar.
  const STATUS_NEEDS_WA = ['confirmado', 'cancelado', 'faltou', 'concluido'];

  const handleStatusClick = (key) => {
    // Status que não pergunta nada → só altera
    if (!STATUS_NEEDS_WA.includes(key)) {
      if (key === form.status) return;
      setForm(p => ({ ...p, status: key }));
      return;
    }
    // Abre action sheet (mesmo se já estiver no status, permite reenviar mensagem de WhatsApp)
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

    const targetPhone = appointment.customer_phone || appointment.client_phone || customer?.phone || '';
    if (!targetPhone) return;

    const enrichedAppointment = {
      ...appointment,
      customer_name: appointment.customer_name || appointment.client_name || customer?.name || 'Cliente',
    };

    let message = '';
    if (key === 'confirmado') {
      message = buildConfirmationMessage({ company, appointment: enrichedAppointment });
    } else if (key === 'cancelado') {
      message = buildCancellationMessage({ company, appointment: enrichedAppointment });
    } else if (key === 'faltou') {
      message = buildNoShowMessage({ company, appointment: enrichedAppointment });
    } else if (key === 'concluido') {
      const reviewLink = resolveReviewLink({ company, appointment: enrichedAppointment });
      message = buildPostAppointmentMessage({ company, appointment: enrichedAppointment, reviewLink });
    }
    if (message) openWhatsApp(targetPhone, message);
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
        className="flex-1 min-h-[44px] px-4 border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm font-semibold text-[#55596A] dark:text-[#CBD5E1] bg-[#FFFFFF] dark:bg-[#171827] hover:bg-[#F1F2F7] dark:hover:bg-[#232538] transition-colors cursor-pointer"
      >
        Cancelar
      </button>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex-1 min-h-[44px] px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-sm cursor-pointer"
      >
        {isSaving ? 'Salvando…' : 'Salvar Alterações'}
      </button>
    </>
  );

  return (
    <>
      <StandardModal
        open
        onClose={onClose}
        title="Detalhes do Agendamento"
        size="lg"
        footer={footer}
      >
        {/* Gatilho inteligente: cliente frequente sem assinatura → oferece plano */}
        {!isBarbeiro && companyId && (customer?.id || appointment.customer_id) && (
          <OfferPlanInlineBanner
            companyId={companyId}
            customerId={customer?.id || appointment.customer_id}
            onOffer={() => setShowOffer(true)}
          />
        )}

        {/* Identificação do cliente (read-only) */}
        <div className="rounded-xl border border-[#E5E7EF] dark:border-[#232538] bg-[#F8FAFC] dark:bg-[#1C1E30] p-3.5 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] font-bold text-[#59658F] dark:text-[#8F9BBF] uppercase tracking-wider block">Cliente</span>
              <p className="font-bold text-sm text-[#171827] dark:text-white mt-0.5">{appointment.customer_name}</p>
              <div className="mt-1"><CustomerTypeBadge customer={safeCustomers.find(c => c.id === appointment.customer_id)} /></div>
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#59658F] dark:text-[#8F9BBF] uppercase tracking-wider block">Telefone</span>
              <p className="font-bold text-sm text-[#171827] dark:text-white mt-0.5 tabular-nums">{appointment.customer_phone || '–'}</p>
            </div>
          </div>
        </div>

        {/* Campos editáveis */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Serviço *</label>
            <MobileSelect
              value={form.service_id}
              onChange={v => setForm(p => ({ ...p, service_id: v }))}
              disabled={isBarbeiro}
              placeholder="Selecionar serviço"
              className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Selecionar serviço</option>
              {safeServices.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min · R$ {s.price}</option>
              ))}
            </MobileSelect>
          </div>

          <div>
            <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Profissional *</label>
            <MobileSelect
              value={form.professional_id}
              onChange={v => setForm(p => ({ ...p, professional_id: v }))}
              disabled={isBarbeiro}
              placeholder="Selecionar profissional"
              className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Selecionar profissional</option>
              {safeProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </MobileSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Início *</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white font-semibold focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Fim estimado</label>
              <div className="w-full px-3.5 py-2.5 border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm bg-[#F8FAFC] dark:bg-[#1C1E30] text-[#171827] dark:text-white font-semibold tabular-nums">
                {endTime || '–'} <span className="text-xs font-normal text-[#55596A] dark:text-[#8F9BBF]">· {duration}min</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Status do Agendamento</span>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_KEYS.map(key => {
                const t = STATUS_TOKENS[key];
                const active = form.status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleStatusClick(key)}
                    className={`text-xs font-bold px-2 py-2 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? `${t.pill} ring-1 ring-current shadow-xs`
                        : 'bg-[#FFFFFF] dark:bg-[#171827] text-[#55596A] dark:text-[#8F9BBF] border-[#E5E7EF] dark:border-[#232538] hover:border-[#2563EB]'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Marcação paralela: pago */}
          <div>
            <span className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Situação do Pagamento</span>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, paid: !p.paid }))}
              disabled={appointment.paid_online}
              title={appointment.paid_online ? 'Pago online antecipadamente — não é possível alterar' : ''}
              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                form.paid
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40 shadow-xs'
                  : 'bg-[#FFFFFF] dark:bg-[#171827] text-[#55596A] dark:text-[#8F9BBF] border-[#E5E7EF] dark:border-[#232538] hover:border-[#2563EB]'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <span className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.paid ? 'bg-emerald-600 border-emerald-500' : 'border-[#CBD5E1] bg-white'}`}>
                  {form.paid && <span className="text-white text-[9px] leading-none">✓</span>}
                </span>
                <span>{form.paid ? 'Pago' : 'Marcar como pago'}</span>
              </span>
              {appointment.paid_online && (
                <span className="text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  {appointment.payment_status === 'confirmed_card' || appointment.payment_method === 'credit_card' || appointment.payment_method === 'card'
                    ? 'Cartão Online'
                    : 'Pix Online'}
                </span>
              )}
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Observações da bancada</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Anotações internas sobre o atendimento..."
              className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 resize-none font-medium"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3.5 flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs font-semibold bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {!isBarbeiro && onDelete && (
          <button
            onClick={() => { if (confirm('Excluir este agendamento?')) onDelete(appointment.id); }}
            className="w-full text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-bold py-2 mt-3.5 transition-colors cursor-pointer"
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
        hasPhone={!!(appointment.customer_phone || appointment.client_phone || customer?.phone)}
        onChooseOnly={handleStatusOnly}
        onChooseWithWhatsApp={handleStatusWithWhatsApp}
        onClose={() => setPendingStatus(null)}
      />
    </>
  );
}