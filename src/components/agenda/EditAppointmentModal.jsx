// Modal completo de edição de agendamento — horário, profissional, serviço, status, observações.
// Valida conflitos antes de salvar e usa update otimista no parent para UI imediata.

import { useState, useMemo } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { STATUS_TOKENS } from '@/lib/statusTokens';
import CustomerTypeBadge from '@/components/agenda/CustomerTypeBadge';
import OfferPlanInlineBanner from '@/components/agenda/OfferPlanInlineBanner';
import OfferPlanModal from '@/components/clientes/OfferPlanModal';
import { useCompany } from '@/hooks/useCompany';
import MobileSelect from '@/components/ui/mobile-select';

const STATUS_KEYS = ['agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'faltou'];

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
  });
  const [error, setError] = useState('');
  const [showOffer, setShowOffer] = useState(false);
  const { companyId } = useCompany();
  const customer = customers.find(c => c.id === appointment.customer_id);

  const service = services.find(s => s.id === form.service_id);
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
    const pro = professionals.find(p => p.id === form.professional_id);
    const svc = services.find(s => s.id === form.service_id);
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
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-[#1B1C1E]">Editar agendamento</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        {/* Gatilho inteligente: cliente frequente sem assinatura → oferece plano */}
        {!isBarbeiro && companyId && appointment.customer_id && (
          <OfferPlanInlineBanner
            companyId={companyId}
            customerId={appointment.customer_id}
            onOffer={() => setShowOffer(true)}
          />
        )}

        {/* Identificação do cliente (read-only) */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] text-gray-400 block">Cliente</span>
              <p className="font-semibold text-sm">{appointment.customer_name}</p>
              <div className="mt-1"><CustomerTypeBadge customer={customers.find(c => c.id === appointment.customer_id)} /></div>
            </div>
            <div>
              <span className="text-[11px] text-gray-400 block">Telefone</span>
              <p className="font-semibold text-sm">{appointment.customer_phone || '–'}</p>
            </div>
          </div>
        </div>

        {/* Campos editáveis */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Serviço *</label>
            <MobileSelect
              value={form.service_id}
              onChange={v => setForm(p => ({ ...p, service_id: v }))}
              disabled={isBarbeiro}
              placeholder="Selecionar serviço"
              className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">Selecionar serviço</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min · R${s.price}</option>
              ))}
            </MobileSelect>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Profissional *</label>
            <MobileSelect
              value={form.professional_id}
              onChange={v => setForm(p => ({ ...p, professional_id: v }))}
              disabled={isBarbeiro}
              placeholder="Selecionar profissional"
              className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">Selecionar profissional</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </MobileSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Início *</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Fim (calculado)</label>
              <div className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm bg-gray-50 text-gray-600">
                {endTime || '–'} <span className="text-[11px] text-gray-400">· {duration}min</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-gray-500 block mb-1.5">Status</span>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_KEYS.map(key => {
                const t = STATUS_TOKENS[key];
                const active = form.status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, status: key }))}
                    className={`text-xs font-medium px-2 py-2 rounded-lg border ${active ? `${t.pill} ring-2 ring-offset-1 ring-current` : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Observações</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg p-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {isSaving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>

        {!isBarbeiro && onDelete && (
          <button
            onClick={() => { if (confirm('Excluir este agendamento?')) onDelete(appointment.id); }}
            className="w-full text-xs text-red-500 hover:text-red-700 font-medium py-2 mt-3"
          >
            Excluir agendamento
          </button>
        )}
      </div>

      {showOffer && customer && (
        <OfferPlanModal
          companyId={companyId}
          customer={customer}
          onClose={() => setShowOffer(false)}
        />
      )}
    </div>
  );
}