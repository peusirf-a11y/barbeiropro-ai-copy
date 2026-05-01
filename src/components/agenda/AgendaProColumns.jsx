// Visualização da agenda em colunas por profissional — estilo SaaS premium.
// Cada coluna = 1 profissional, linhas = horários (slots de 10 ou 15 min).
// Cards de agendamento são posicionados absolutamente conforme início/duração.
//
// Recursos:
// - Header com avatar circular grande, nome do profissional e próximo horário livre.
// - Eixo de horários com labels a cada slot.
// - Cards coloridos por status, com sombra leve, transparência e cantos arredondados.
// - Borda tracejada para clientes "novos" (sem histórico).
// - Linha vermelha do horário atual quando o dia selecionado é hoje.
// - Drag & drop entre profissionais (validação no parent).
// - Mobile: 1 barbeiro por vez com swipe lateral entre colunas (snap scroll).
// - Scroll horizontal automático se houver muitos barbeiros (desktop).

import { format, addMinutes } from 'date-fns';
import { Phone, MessageCircle, Smartphone, Monitor, Coffee, Hourglass } from 'lucide-react';
import { useMemo, useEffect, useRef, useState } from 'react';

const SLOT_HEIGHT = 28;       // altura px de cada slot
const START_HOUR = 8;
const END_HOUR = 21;
const COL_WIDTH = 200;        // largura desktop por coluna
const TIME_AXIS_WIDTH = 64;

// Paleta pastel inspirada na referência (Cash Barber).
// Cores suaves, transparência leve, texto contrastante.
const PASTEL = {
  agendado:       { bg: 'bg-[#F1F2F4]/70',  border: 'border-[#D1D5DB]',  text: 'text-gray-700',     accent: '#9CA3AF' },
  confirmado:     { bg: 'bg-[#DCF7E3]/80',  border: 'border-[#86E3A5]',  text: 'text-emerald-800',  accent: '#10B981' },
  em_atendimento: { bg: 'bg-[#FFF1C2]/80',  border: 'border-[#F5C842]',  text: 'text-amber-800',    accent: '#F59E0B' },
  concluido:      { bg: 'bg-[#E5E7EB]/70',  border: 'border-[#9CA3AF]',  text: 'text-gray-500',     accent: '#6B7280' },
  cancelado:      { bg: 'bg-[#FCE2E2]/80',  border: 'border-[#F08989]',  text: 'text-red-700',      accent: '#EF4444' },
  faltou:         { bg: 'bg-[#FFE4D1]/80',  border: 'border-[#F5A571]',  text: 'text-orange-700',   accent: '#F97316' },
};

// Variação extra de cor por profissional (rotacional) — só aplicada em
// agendamentos "agendado" sem cliente preferencial, para enriquecer visual.
const SOFT_TINTS = [
  { bg: 'bg-[#E9E5FF]/70', border: 'border-[#C7BCFD]', text: 'text-violet-800' }, // roxo claro (Pedro)
  { bg: 'bg-[#FFE4D1]/70', border: 'border-[#F5A571]', text: 'text-orange-700' }, // pêssego (João Paulo)
  { bg: 'bg-[#DCF7E3]/70', border: 'border-[#86E3A5]', text: 'text-emerald-800' }, // verde menta (Eduardo)
  { bg: 'bg-[#E5E7EB]/70', border: 'border-[#9CA3AF]', text: 'text-gray-700' },   // cinza
];

function generateSlots(stepMin) {
  const slots = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      slots.push({ h, m });
    }
  }
  return slots;
}

function minutesFromStart(date) {
  const d = new Date(date);
  return (d.getHours() - START_HOUR) * 60 + d.getMinutes();
}

// Acha o próximo horário livre do profissional considerando os agendamentos
// futuros do dia. Granularidade = 30 min.
function findNextFreeSlot({ proAppts, services, selectedDate, isToday }) {
  const refNow = isToday ? new Date() : new Date(selectedDate);
  if (!isToday) refNow.setHours(START_HOUR, 0, 0, 0);

  const dayEnd = new Date(selectedDate);
  dayEnd.setHours(END_HOUR, 0, 0, 0);

  // Arredonda para o próximo múltiplo de 30 min
  const cursor = new Date(refNow);
  cursor.setSeconds(0, 0);
  const nextMinutes = Math.ceil(cursor.getMinutes() / 30) * 30;
  cursor.setMinutes(nextMinutes);
  if (cursor.getHours() < START_HOUR) cursor.setHours(START_HOUR, 0, 0, 0);

  const sorted = [...proAppts]
    .filter(a => !['cancelado', 'faltou'].includes(a.status))
    .map(a => {
      const dur = services.find(s => s.id === a.service_id)?.duration_minutes || 30;
      const start = new Date(a.scheduled_at);
      const end = addMinutes(start, dur);
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);

  let probe = new Date(cursor);
  while (probe < dayEnd) {
    const conflict = sorted.find(b => probe >= b.start && probe < b.end);
    if (!conflict) return probe;
    probe = new Date(conflict.end);
  }
  return null;
}

// Detecta cliente novo (sem total_appointments) — para borda tracejada.
function isNewClient(appt) {
  // O preferencial é receber a info via lookup; aqui usamos heurística:
  // se não tem customer_id, é cliente "sem preferência" / novo.
  return !appt.customer_id;
}

export default function AgendaProColumns({
  selectedDate,
  professionals,
  appointments,
  services,
  blocks,
  onCardClick,
  onMoveAppointment,
  slotInterval = 10,             // 10 ou 15 min
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetPro, setDropTargetPro] = useState(null);
  const [mobileProIndex, setMobileProIndex] = useState(0);

  const handleDragStart = (e, appt) => {
    if (!onMoveAppointment) return;
    setDraggingId(appt.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appt.id);
  };
  const handleDragEnd = () => { setDraggingId(null); setDropTargetPro(null); };
  const handleDragOver = (e, proId) => {
    if (!onMoveAppointment || !draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetPro !== proId) setDropTargetPro(proId);
  };
  const handleDrop = (e, proId) => {
    if (!onMoveAppointment) return;
    e.preventDefault();
    const apptId = e.dataTransfer.getData('text/plain') || draggingId;
    const appt = appointments.find(a => a.id === apptId);
    if (appt && appt.professional_id !== proId) {
      onMoveAppointment({ appointment: appt, toProfessionalId: proId });
    }
    setDraggingId(null);
    setDropTargetPro(null);
  };

  const slots = useMemo(() => generateSlots(slotInterval), [slotInterval]);
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
    const result = [];
    for (const b of blocks) {
      if (b.recurring) {
        if (typeof b.weekday !== 'number') continue;
        if (selectedDate.getDay() !== b.weekday) continue;
        if (!b.time_start || !b.time_end) continue;
        const [sh, sm] = String(b.time_start).split(':').map(Number);
        const [eh, em] = String(b.time_end).split(':').map(Number);
        const bStart = new Date(selectedDate); bStart.setHours(sh || 0, sm || 0, 0, 0);
        const bEnd = new Date(selectedDate);   bEnd.setHours(eh || 0, em || 0, 0, 0);
        result.push({ ...b, start_time: bStart.toISOString(), end_time: bEnd.toISOString() });
      } else if (b.start_time && b.end_time) {
        const start = new Date(b.start_time);
        const end = new Date(b.end_time);
        const s = new Date(selectedDate); s.setHours(0, 0, 0, 0);
        const e = new Date(selectedDate); e.setHours(23, 59, 59, 999);
        if (start <= e && end >= s) result.push(b);
      }
    }
    return result;
  }, [blocks, selectedDate]);

  // Linha do "agora" (só se for hoje)
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const nowOffset = isToday ? minutesFromStart(new Date()) : -1;
  const showNowLine = nowOffset >= 0 && nowOffset <= totalMinutes;

  // Auto-scroll para o horário atual quando for hoje
  useEffect(() => {
    if (showNowLine && containerRef.current) {
      const targetTop = (nowOffset / slotInterval) * SLOT_HEIGHT - 120;
      containerRef.current.scrollTop = Math.max(0, targetTop);
    }
  }, [showNowLine, nowOffset, slotInterval]);

  // Reseta índice mobile se a lista de pros mudar
  useEffect(() => {
    if (mobileProIndex >= professionals.length) setMobileProIndex(0);
  }, [professionals.length, mobileProIndex]);

  function getApptCard(appt) {
    const svc = services.find(s => s.id === appt.service_id);
    const dur = svc?.duration_minutes || 30;
    const top = (minutesFromStart(appt.scheduled_at) / slotInterval) * SLOT_HEIGHT;
    const height = (dur / slotInterval) * SLOT_HEIGHT - 2;
    return { top, height, dur };
  }

  function getBlockCard(b) {
    const startMin = Math.max(0, minutesFromStart(b.start_time));
    const endMin = Math.min(totalMinutes, minutesFromStart(b.end_time));
    const top = (startMin / slotInterval) * SLOT_HEIGHT;
    const height = ((endMin - startMin) / slotInterval) * SLOT_HEIGHT - 2;
    return { top, height };
  }

  const gridHeight = totalMinutes / slotInterval * SLOT_HEIGHT;

  // Ícones decorativos no card (estilo da referência: WhatsApp, monitor, café…)
  // Aqui mostramos sempre Phone+Chat porque é o caso mais comum.
  const renderCardIcons = (appt) => (
    <div className="flex items-center gap-1 mb-0.5 opacity-60">
      <Smartphone className="w-3 h-3" />
      <MessageCircle className="w-3 h-3" />
    </div>
  );

  // Pro a renderizar — mobile: só o atual; desktop: todos.
  const renderedPros = professionals;

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] overflow-hidden">
      {/* ───────── MOBILE: Pílulas de seleção de profissional ───────── */}
      {professionals.length > 1 && (
        <div className="md:hidden flex items-center gap-2 px-3 py-3 overflow-x-auto border-b border-black/5 bg-[#FAFBFC]">
          {professionals.map((pro, idx) => {
            const active = idx === mobileProIndex;
            return (
              <button
                key={pro.id}
                onClick={() => setMobileProIndex(idx)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${active ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-[0_4px_12px_rgba(37,99,235,0.25)]' : 'bg-white text-gray-700 border-black/10'}`}
              >
                {pro.photo_url ? (
                  <img src={pro.photo_url} alt={pro.name} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white font-bold text-[10px]">
                    {pro.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="text-xs font-semibold">{pro.name?.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ───────── Container scrollable horizontal (desktop) / único pro (mobile) ───────── */}
      <div ref={containerRef} className="overflow-auto max-h-[680px]">
        {/* Header com avatares — sticky no topo */}
        <div className="sticky top-0 z-20 bg-white border-b border-black/5 flex">
          <div className="flex-shrink-0 border-r border-black/5" style={{ width: TIME_AXIS_WIDTH }} />

          {/* Desktop: todos os pros */}
          <div className="hidden md:flex flex-1">
            {renderedPros.map(pro => {
              const proAppts = dayAppts.filter(a => a.professional_id === pro.id);
              const nextFree = findNextFreeSlot({ proAppts, services, selectedDate, isToday });
              return <ProHeader key={pro.id} pro={pro} nextFree={nextFree} width={COL_WIDTH} />;
            })}
          </div>
          {/* Mobile: só o pro selecionado */}
          <div className="md:hidden flex-1">
            {renderedPros[mobileProIndex] && (() => {
              const pro = renderedPros[mobileProIndex];
              const proAppts = dayAppts.filter(a => a.professional_id === pro.id);
              const nextFree = findNextFreeSlot({ proAppts, services, selectedDate, isToday });
              return <ProHeader pro={pro} nextFree={nextFree} mobile />;
            })()}
          </div>
        </div>

        {/* Grid de horários x profissionais */}
        <div className="flex relative" style={{ height: gridHeight }}>
          {/* Coluna de horários (eixo vertical) */}
          <div
            className="flex-shrink-0 border-r border-black/5 relative bg-[#FAFBFC] z-10"
            style={{ width: TIME_AXIS_WIDTH }}
          >
            {slots.map((s, i) => {
              const showLabel = slotInterval >= 15 || s.m % 30 === 0 || s.m === 10 || s.m === 20 || s.m === 40 || s.m === 50;
              return (
                <div
                  key={i}
                  className={`text-[11px] text-right pr-2.5 border-b ${s.m === 0 ? 'border-black/10 text-gray-500 font-semibold' : 'border-black/5 text-gray-400'}`}
                  style={{ height: SLOT_HEIGHT, lineHeight: `${SLOT_HEIGHT}px` }}
                >
                  {showLabel ? `${String(s.h).padStart(2, '0')}:${String(s.m).padStart(2, '0')}` : ''}
                </div>
              );
            })}
          </div>

          {/* Linha do horário atual — sobrepõe as colunas */}
          {showNowLine && (
            <div
              className="absolute pointer-events-none z-30 flex items-center"
              style={{
                top: `${(nowOffset / slotInterval) * SLOT_HEIGHT}px`,
                left: TIME_AXIS_WIDTH - 4,
                right: 0,
              }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.2)] flex-shrink-0" />
              <div className="flex-1 h-[2px] bg-red-500" />
            </div>
          )}

          {/* Colunas de profissionais — desktop: todas; mobile: só a atual */}
          {/* Desktop */}
          <div className="hidden md:flex flex-1">
            {renderedPros.map((pro, idx) => (
              <ProColumn
                key={pro.id}
                pro={pro}
                index={idx}
                slots={slots}
                slotInterval={slotInterval}
                dayAppts={dayAppts.filter(a => a.professional_id === pro.id)}
                proBlocks={dayBlocks.filter(b => !b.professional_id || b.professional_id === pro.id)}
                getApptCard={getApptCard}
                getBlockCard={getBlockCard}
                onCardClick={onCardClick}
                onMoveAppointment={onMoveAppointment}
                draggingId={draggingId}
                isDropTarget={dropTargetPro === pro.id}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, pro.id)}
                onDragLeave={() => dropTargetPro === pro.id && setDropTargetPro(null)}
                onDrop={(e) => handleDrop(e, pro.id)}
                renderCardIcons={renderCardIcons}
                width={COL_WIDTH}
              />
            ))}
          </div>
          {/* Mobile */}
          <div className="md:hidden flex-1">
            {renderedPros[mobileProIndex] && (() => {
              const pro = renderedPros[mobileProIndex];
              const idx = mobileProIndex;
              return (
                <ProColumn
                  pro={pro}
                  index={idx}
                  slots={slots}
                  slotInterval={slotInterval}
                  dayAppts={dayAppts.filter(a => a.professional_id === pro.id)}
                  proBlocks={dayBlocks.filter(b => !b.professional_id || b.professional_id === pro.id)}
                  getApptCard={getApptCard}
                  getBlockCard={getBlockCard}
                  onCardClick={onCardClick}
                  onMoveAppointment={onMoveAppointment}
                  draggingId={draggingId}
                  isDropTarget={dropTargetPro === pro.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, pro.id)}
                  onDragLeave={() => dropTargetPro === pro.id && setDropTargetPro(null)}
                  onDrop={(e) => handleDrop(e, pro.id)}
                  renderCardIcons={renderCardIcons}
                  mobile
                />
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Sub-components ─────────────────── */

function ProHeader({ pro, nextFree, width, mobile }) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-3 py-3 border-r border-black/5 last:border-r-0 ${mobile ? 'w-full' : ''}`}
      style={mobile ? undefined : { width, minWidth: width }}
    >
      {pro.photo_url ? (
        <img src={pro.photo_url} alt={pro.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-md" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white font-bold text-sm shadow-md">
          {pro.name?.[0]?.toUpperCase() || '?'}
        </div>
      )}
      <div className="text-sm font-semibold text-[#0F172A] mt-1.5 text-center truncate max-w-full">{pro.name}</div>
      {nextFree && (
        <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
          Livre às {format(nextFree, 'HH:mm')}
        </div>
      )}
    </div>
  );
}

function ProColumn({
  pro, index, slots, slotInterval,
  dayAppts, proBlocks, getApptCard, getBlockCard,
  onCardClick, onMoveAppointment,
  draggingId, isDropTarget,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  renderCardIcons, width, mobile,
}) {
  return (
    <div
      className={`relative border-r border-black/5 last:border-r-0 transition-colors ${isDropTarget ? 'bg-[#EFF6FF] ring-2 ring-inset ring-[#2563EB]/40' : ''} ${mobile ? 'w-full' : ''}`}
      style={mobile ? undefined : { width, minWidth: width }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
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
            className="absolute left-1.5 right-1.5 rounded-xl border border-dashed border-gray-300 bg-[repeating-linear-gradient(45deg,#F3F4F6_0,#F3F4F6_8px,#E5E7EB_8px,#E5E7EB_16px)] flex flex-col items-start justify-start text-gray-500 px-2.5 py-1.5"
            style={{ top, height }}
            title={b.reason}
          >
            <div className="text-[12px] font-semibold leading-tight">{b.reason || 'Não atende'}</div>
            <div className="text-[10px] opacity-70 mt-0.5">
              {format(new Date(b.start_time), 'HH:mm')} - {format(new Date(b.end_time), 'HH:mm')}
            </div>
          </div>
        );
      })}

      {/* Cards de agendamento */}
      {dayAppts.map(appt => {
        const { top, height, dur } = getApptCard(appt);
        // Status determina paleta. Para "agendado" usamos tint rotacional por
        // profissional para variar visual (estilo da referência).
        let palette;
        if (appt.status === 'agendado') {
          palette = SOFT_TINTS[index % SOFT_TINTS.length];
        } else {
          palette = PASTEL[appt.status] || PASTEL.agendado;
        }
        const startTime = format(new Date(appt.scheduled_at), 'HH:mm');
        const endDate = addMinutes(new Date(appt.scheduled_at), dur);
        const endTime = format(endDate, 'HH:mm');
        const draggable = !!onMoveAppointment && !['concluido', 'cancelado', 'faltou'].includes(appt.status);
        const isDragging = draggingId === appt.id;
        const newClient = isNewClient(appt);

        return (
          <button
            key={appt.id}
            draggable={draggable}
            onDragStart={(e) => onDragStart(e, appt)}
            onDragEnd={onDragEnd}
            onClick={() => onCardClick?.(appt)}
            className={`absolute left-1.5 right-1.5 rounded-xl border ${palette.bg} ${palette.border} ${palette.text} ${newClient ? 'border-dashed' : ''} px-2.5 py-2 text-left transition-all duration-200 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:-translate-y-px hover:z-10 ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDragging ? 'opacity-40 ring-2 ring-[#2563EB]' : ''}`}
            style={{ top: top + 1, height }}
            title={`${appt.customer_name || 'Cliente'} · ${appt.service_name} · ${startTime}–${endTime}`}
          >
            {height >= 36 && renderCardIcons(appt)}
            <div className="font-semibold text-[12px] leading-tight truncate">
              {appt.customer_name || 'Cliente'}
            </div>
            <div className="text-[11px] opacity-80 truncate leading-tight mt-0.5">{appt.service_name}</div>
            {height > 56 && (
              <div className="text-[10px] opacity-60 mt-1">{startTime} - {endTime}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}