// Visualização da agenda em colunas por profissional (estilo Cash Barber).
// Cada coluna = 1 profissional, linhas = horários (slots de 10 minutos).
// Cards de agendamento são posicionados absolutamente conforme início/duração.

import { format } from 'date-fns';
import { Phone, MessageCircle } from 'lucide-react';
import { useMemo, useEffect, useRef } from 'react';

const SLOT_MIN = 10;          // cada linha = 10 min
const SLOT_HEIGHT = 28;       // altura px de cada slot
const START_HOUR = 8;
const END_HOUR = 21;

// Paleta pastel para status — tons suaves como nas referências.
const PASTEL = {
  agendado:       { bg: 'bg-[#F1F2F4]',   border: 'border-[#D1D5DB]',  text: 'text-gray-700' },
  confirmado:     { bg: 'bg-[#DCF7E3]',   border: 'border-[#86E3A5]',  text: 'text-emerald-800' },
  em_atendimento: { bg: 'bg-[#FFF1C2]',   border: 'border-[#F5C842]',  text: 'text-amber-800' },
  concluido:      { bg: 'bg-[#E5E7EB]',   border: 'border-[#9CA3AF]',  text: 'text-gray-500' },
  cancelado:      { bg: 'bg-[#FCE2E2]',   border: 'border-[#F08989]',  text: 'text-red-700' },
  faltou:         { bg: 'bg-[#FFE4D1]',   border: 'border-[#F5A571]',  text: 'text-orange-700' },
};

function generateSlots() {
  const slots = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MIN) {
      slots.push({ h, m });
    }
  }
  return slots;
}

function minutesFromStart(date) {
  const d = new Date(date);
  return (d.getHours() - START_HOUR) * 60 + d.getMinutes();
}

export default function AgendaProColumns({
  selectedDate,
  professionals,
  appointments,
  services,
  blocks,
  onCardClick,
}) {
  const slots = useMemo(generateSlots, []);
  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  const containerRef = useRef(null);

  // Filtra apenas o dia selecionado
  const dayAppts = useMemo(() => {
    return appointments.filter(a => {
      const d = new Date(a.scheduled_at);
      return d.toDateString() === selectedDate.toDateString();
    });
  }, [appointments, selectedDate]);

  const dayBlocks = useMemo(() => {
    return blocks.filter(b => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const s = new Date(selectedDate); s.setHours(0, 0, 0, 0);
      const e = new Date(selectedDate); e.setHours(23, 59, 59, 999);
      return start <= e && end >= s;
    });
  }, [blocks, selectedDate]);

  // Linha do "agora" (só se for hoje)
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const nowOffset = isToday ? minutesFromStart(new Date()) : -1;
  const showNowLine = nowOffset >= 0 && nowOffset <= totalMinutes;

  // Auto-scroll para o horário atual quando for hoje
  useEffect(() => {
    if (showNowLine && containerRef.current) {
      const targetTop = (nowOffset / SLOT_MIN) * SLOT_HEIGHT - 120;
      containerRef.current.scrollTop = Math.max(0, targetTop);
    }
  }, [showNowLine, nowOffset]);

  function getApptCard(appt) {
    const svc = services.find(s => s.id === appt.service_id);
    const dur = svc?.duration_minutes || 30;
    const top = (minutesFromStart(appt.scheduled_at) / SLOT_MIN) * SLOT_HEIGHT;
    const height = (dur / SLOT_MIN) * SLOT_HEIGHT - 2;
    return { top, height, dur };
  }

  function getBlockCard(b) {
    const startMin = Math.max(0, minutesFromStart(b.start_time));
    const endMin = Math.min(totalMinutes, minutesFromStart(b.end_time));
    const top = (startMin / SLOT_MIN) * SLOT_HEIGHT;
    const height = ((endMin - startMin) / SLOT_MIN) * SLOT_HEIGHT - 2;
    return { top, height };
  }

  const gridHeight = totalMinutes / SLOT_MIN * SLOT_HEIGHT;

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Header com avatares dos profissionais */}
      <div className="flex border-b border-black/5 sticky top-0 bg-white z-20">
        <div className="w-16 flex-shrink-0 border-r border-black/5" />
        {professionals.map(pro => (
          <div key={pro.id} className="flex-1 min-w-[160px] px-3 py-3 flex items-center gap-2 border-r border-black/5 last:border-r-0">
            {pro.photo_url ? (
              <img src={pro.photo_url} alt={pro.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white font-bold text-xs shadow-sm">
                {pro.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#0F172A] truncate">{pro.name}</div>
              {pro.specialty && <div className="text-[11px] text-gray-400 truncate">{pro.specialty}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Grid de horários x profissionais */}
      <div ref={containerRef} className="overflow-auto max-h-[640px]">
        <div className="flex" style={{ height: gridHeight }}>
          {/* Coluna de horários */}
          <div className="w-16 flex-shrink-0 border-r border-black/5 relative bg-[#FAFBFC]">
            {slots.map((s, i) => (
              <div
                key={i}
                className="text-[11px] text-gray-400 text-right pr-2 border-b border-black/5"
                style={{ height: SLOT_HEIGHT, lineHeight: `${SLOT_HEIGHT}px` }}
              >
                {s.m === 0 || s.m === 30 ? `${String(s.h).padStart(2, '0')}:${String(s.m).padStart(2, '0')}` : ''}
              </div>
            ))}
          </div>

          {/* Colunas de profissionais */}
          {professionals.map(pro => {
            const proAppts = dayAppts.filter(a => a.professional_id === pro.id);
            const proBlocks = dayBlocks.filter(b => !b.professional_id || b.professional_id === pro.id);
            return (
              <div key={pro.id} className="flex-1 min-w-[160px] relative border-r border-black/5 last:border-r-0">
                {/* Linhas de fundo (slots) */}
                {slots.map((s, i) => (
                  <div
                    key={i}
                    className={`border-b ${s.m === 0 ? 'border-black/10' : 'border-black/5'}`}
                    style={{ height: SLOT_HEIGHT }}
                  />
                ))}

                {/* Bloqueios (faixas listradas) */}
                {proBlocks.map(b => {
                  const { top, height } = getBlockCard(b);
                  if (height <= 0) return null;
                  return (
                    <div
                      key={b.id}
                      className="absolute left-1 right-1 rounded-lg border border-dashed border-gray-300 bg-[repeating-linear-gradient(45deg,#F3F4F6_0,#F3F4F6_8px,#E5E7EB_8px,#E5E7EB_16px)] flex items-center justify-center text-[11px] font-medium text-gray-500 px-2"
                      style={{ top, height }}
                      title={b.reason}
                    >
                      <div className="text-center">
                        <div className="font-semibold">{b.reason || 'Não atende'}</div>
                        <div className="text-[10px] opacity-70">
                          {format(new Date(b.start_time), 'HH:mm')} - {format(new Date(b.end_time), 'HH:mm')}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Cards de agendamento */}
                {proAppts.map(appt => {
                  const { top, height, dur } = getApptCard(appt);
                  const palette = PASTEL[appt.status] || PASTEL.agendado;
                  const startTime = format(new Date(appt.scheduled_at), 'HH:mm');
                  const endDate = new Date(new Date(appt.scheduled_at).getTime() + dur * 60000);
                  const endTime = format(endDate, 'HH:mm');
                  return (
                    <button
                      key={appt.id}
                      onClick={() => onCardClick?.(appt)}
                      className={`absolute left-1.5 right-1.5 rounded-lg border ${palette.bg} ${palette.border} ${palette.text} px-2.5 py-2 text-left hover:shadow-md hover:-translate-y-px transition-all duration-200 overflow-hidden`}
                      style={{ top: top + 1, height }}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <Phone className="w-3 h-3 opacity-60" />
                        <MessageCircle className="w-3 h-3 opacity-60" />
                      </div>
                      <div className="font-semibold text-[12px] leading-tight truncate">
                        {appt.customer_name || 'Cliente'}
                      </div>
                      <div className="text-[11px] opacity-80 truncate">{appt.service_name}</div>
                      {height > 50 && (
                        <div className="text-[10px] opacity-60 mt-0.5">{startTime} - {endTime}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Linha do horário atual — sobrepõe as colunas */}
        {showNowLine && (
          <div
            className="absolute left-16 right-0 pointer-events-none z-10 flex items-center"
            style={{ top: `${(nowOffset / SLOT_MIN) * SLOT_HEIGHT + 56}px` }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]" />
            <div className="flex-1 h-[2px] bg-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}