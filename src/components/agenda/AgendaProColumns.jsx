// Visualização da agenda em colunas por profissional — estilo SaaS premium.
// Cada coluna = 1 profissional, linhas = horários (slots de 10 ou 15 min).
// Cards de agendamento são posicionados absolutamente conforme início/duração.
//
// Recursos:
// - Drag-and-drop completo (entre colunas E entre horários) via Pointer Events.
//   Funciona em desktop e mobile (touch/pen). Snap automático na grade.
// - Resize por borda inferior do card (alterar duração arrastando).
// - Ghost preview da posição de destino durante o drag.
// - Auto-scroll quando o cursor chega nas bordas verticais.
// - Validação de conflito ANTES do commit — se inválido, posição original é mantida.
// - Atualização otimista é feita pelo parent (mutation com onMutate).
// - Clique simples (sem drag) abre o modal de edição (CLICK_THRESHOLD = 4px).

import { format, addMinutes } from 'date-fns';
import { Smartphone, MessageCircle } from 'lucide-react';
import { useMemo, useEffect, useRef } from 'react';
import { getStatusToken, isClientWithoutPreference } from '@/lib/statusTokens';
import useAgendaDnD from './useAgendaDnD';

const SLOT_HEIGHT = 36;       // altura px de cada slot
const START_HOUR = 8;
const END_HOUR = 21;
const COL_WIDTH = 220;        // largura desktop por coluna
const TIME_AXIS_WIDTH = 64;

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
  if (Number.isNaN(d.getTime())) return 60;
  const raw = (d.getHours() - START_HOUR) * 60 + d.getMinutes();
  const maxMin = (END_HOUR - START_HOUR) * 60 - 15;
  return Math.max(0, Math.min(maxMin, raw));
}

function isSameSelectedDay(appt, selectedDate) {
  if (!appt || !selectedDate) return false;
  const targetYmd = format(selectedDate, 'yyyy-MM-dd');
  if (appt.date && String(appt.date).slice(0, 10) === targetYmd) {
    return true;
  }
  if (appt.scheduled_at) {
    const d = new Date(appt.scheduled_at);
    if (!Number.isNaN(d.getTime())) {
      if (d.toDateString() === selectedDate.toDateString()) return true;
      if (format(d, 'yyyy-MM-dd') === targetYmd) return true;
    }
    if (String(appt.scheduled_at).slice(0, 10) === targetYmd) return true;
  }
  return false;
}

// Acha o próximo horário livre do profissional considerando os agendamentos
// futuros do dia. Granularidade = 30 min.
function findNextFreeSlot({ proAppts, services, selectedDate, isToday }) {
  const refNow = isToday ? new Date() : new Date(selectedDate);
  if (!isToday) refNow.setHours(START_HOUR, 0, 0, 0);

  const dayEnd = new Date(selectedDate);
  dayEnd.setHours(END_HOUR, 0, 0, 0);

  const cursor = new Date(refNow);
  cursor.setSeconds(0, 0);
  const nextMinutes = Math.ceil(cursor.getMinutes() / 30) * 30;
  cursor.setMinutes(nextMinutes);
  if (cursor.getHours() < START_HOUR) cursor.setHours(START_HOUR, 0, 0, 0);

  const sorted = [...proAppts]
    .filter(a => !['cancelado', 'faltou'].includes(a.status))
    .map(a => {
      const dur = a.custom_duration_minutes || services.find(s => s.id === a.service_id)?.duration_minutes || 30;
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


export default function AgendaProColumns({
  selectedDate,
  professionals,
  appointments,
  services,
  blocks,
  onCardClick,
  onMoveAppointment,   // ({ appointment, toProfessionalId, newStartISO, newDurationMin }) => void
  onResizeAppointment, // ({ appointment, newDurationMin }) => void
  slotInterval = 15,
}) {
  const containerRef = useRef(null);
  const slots = useMemo(() => generateSlots(slotInterval), [slotInterval]);
  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  const gridHeight = (totalMinutes / slotInterval) * SLOT_HEIGHT;

  const basePros = useMemo(() => {
    if (Array.isArray(professionals) && professionals.length > 0) {
      return professionals;
    }
    return [{ id: '__default_pro__', name: 'Barbeiro Principal' }];
  }, [professionals]);

  // Filtra apenas o dia selecionado (resiliente a timezone e campo date/scheduled_at)
  const dayAppts = useMemo(() => {
    return (appointments || [])
      .filter(a => isSameSelectedDay(a, selectedDate))
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, [appointments, selectedDate]);

  // Mapeia cada agendamento do dia para uma coluna de profissional válida
  // (se professional_id não bater com nenhum pro ativo, tenta por nome ou aloca na 1ª coluna)
  const apptsByProId = useMemo(() => {
    const map = {};
    for (const p of basePros) {
      map[p.id] = [];
    }
    const proIds = new Set(basePros.map(p => String(p.id)));
    const firstProId = basePros[0]?.id;

    for (const appt of dayAppts) {
      const rawPid = appt.professional_id ? String(appt.professional_id) : '';
      if (rawPid && proIds.has(rawPid)) {
        map[rawPid].push(appt);
        continue;
      }
      const pName = String(appt.professional_name || '').trim().toLowerCase();
      const byName = pName
        ? basePros.find(p => String(p.name || '').trim().toLowerCase() === pName)
        : null;
      if (byName) {
        map[byName.id].push(appt);
      } else if (firstProId) {
        map[firstProId].push(appt);
      }
    }
    return map;
  }, [basePros, dayAppts]);

  // Ordena colunas para que os profissionais com agendamentos no dia selecionado apareçam nas primeiras colunas à esquerda
  const renderedPros = useMemo(() => {
    return [...basePros].sort((a, b) => {
      const aAppts = apptsByProId[a.id] || [];
      const bAppts = apptsByProId[b.id] || [];
      const aHas = aAppts.length > 0 ? 1 : 0;
      const bHas = bAppts.length > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (aHas && bHas) {
        const aConfirmed = aAppts.filter(x => x.status === 'confirmado').length;
        const bConfirmed = bAppts.filter(x => x.status === 'confirmado').length;
        if (aConfirmed !== bConfirmed) return bConfirmed - aConfirmed;
        return new Date(aAppts[0].scheduled_at) - new Date(bAppts[0].scheduled_at);
      }
      return 0;
    });
  }, [basePros, apptsByProId]);

  const dayBlocks = useMemo(() => {
    const result = [];
    for (const b of blocks || []) {
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

  // DnD via hook
  const { draggingId, resizingId, ghost, startMove, startResize } = useAgendaDnD({
    selectedDate,
    startHour: START_HOUR,
    slotInterval,
    slotHeight: SLOT_HEIGHT,
    colWidth: COL_WIDTH,
    timeAxisWidth: TIME_AXIS_WIDTH,
    professionals: renderedPros,
    scrollContainerRef: containerRef,
    onCommitMove: onMoveAppointment,
    onCommitResize: onResizeAppointment,
  });

  // Linha do "agora" (só se for hoje)
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const nowOffset = isToday ? minutesFromStart(new Date()) : -1;
  const showNowLine = nowOffset >= 0 && nowOffset <= totalMinutes;

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollLeft = 0;
    if (dayAppts.length > 0) {
      const firstMin = minutesFromStart(dayAppts[0].scheduled_at);
      const targetTop = (firstMin / slotInterval) * SLOT_HEIGHT - 48;
      containerRef.current.scrollTop = Math.max(0, targetTop);
    } else if (showNowLine) {
      const targetTop = (nowOffset / slotInterval) * SLOT_HEIGHT - 120;
      containerRef.current.scrollTop = Math.max(0, targetTop);
    } else {
      containerRef.current.scrollTop = 0;
    }
  }, [selectedDate, dayAppts, showNowLine, nowOffset, slotInterval]);

  function getApptCard(appt) {
    const svc = services.find(s => s.id === appt.service_id);
    const dur = appt.custom_duration_minutes || svc?.duration_minutes || 30;
    const top = (minutesFromStart(appt.scheduled_at) / slotInterval) * SLOT_HEIGHT;
    const rawHeight = (dur / slotInterval) * SLOT_HEIGHT - 2;
    const height = Math.max(46, rawHeight);
    return { top, height, dur };
  }

  function getBlockCard(b) {
    const startMin = Math.max(0, minutesFromStart(b.start_time));
    const endMin = Math.min(totalMinutes, minutesFromStart(b.end_time));
    const top = (startMin / slotInterval) * SLOT_HEIGHT;
    const height = ((endMin - startMin) / slotInterval) * SLOT_HEIGHT - 2;
    return { top, height };
  }

  const renderCardIcons = () => (
    <div className="flex items-center gap-1 mb-0.5 opacity-60">
      <Smartphone className="w-3 h-3" />
      <MessageCircle className="w-3 h-3" />
    </div>
  );

  const totalGridWidth = TIME_AXIS_WIDTH + renderedPros.length * COL_WIDTH;

  return (
    <div
      data-testid="agenda-pro-grid"
      data-slot-interval={slotInterval}
      data-selected-date={format(selectedDate, 'yyyy-MM-dd')}
      className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden"
    >
      {/* Resumo explícito da programação do dia selecionado */}
      <div
        data-testid="selected-day-schedule-summary"
        className="px-4 py-2.5 border-b border-white/8 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2"
      >
        <div className="text-xs font-semibold text-white/80">
          Programação do dia ({format(selectedDate, 'dd/MM/yyyy')}):{' '}
          <span className="text-emerald-300 font-bold">
            {dayAppts.length} {dayAppts.length === 1 ? 'agendamento no dia' : 'agendamentos no dia'}
          </span>
        </div>
        {dayAppts.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {dayAppts.map((a) => {
              const token = getStatusToken(a.status);
              const tStr = format(new Date(a.scheduled_at), 'HH:mm');
              return (
                <button
                  key={`day-chip-${a.id}`}
                  type="button"
                  onClick={() => onCardClick?.(a)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="font-bold text-emerald-300">{tStr}</span>
                  <span className="font-semibold text-white">{a.customer_name || 'Cliente'}</span>
                  <span className="text-white/70">· {a.service_name || 'Corte'}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-200">
                    {token.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="overflow-auto max-h-[680px] select-none"
        style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
      >
        <div style={{ minWidth: totalGridWidth }}>
          {/* Header */}
          <div className="sticky top-0 z-20 bg-[#0A1124]/95 backdrop-blur-xl border-b border-white/8 flex">
            <div className="flex-shrink-0 border-r border-white/5" style={{ width: TIME_AXIS_WIDTH }} />
            {renderedPros.map(pro => {
              const proAppts = apptsByProId[pro.id] || [];
              const nextFree = findNextFreeSlot({ proAppts, services, selectedDate, isToday });
              return <ProHeader key={pro.id} pro={pro} nextFree={nextFree} count={proAppts.length} width={COL_WIDTH} />;
            })}
          </div>

          {/* Grid */}
          <div className="flex relative" style={{ height: gridHeight }}>
            {/* Eixo de horários */}
            <div className="flex-shrink-0 border-r border-white/5 relative bg-white/[0.015] z-10" style={{ width: TIME_AXIS_WIDTH }}>
              {slots.map((s, i) => {
                return (
                  <div
                    key={i}
                    className={`text-[11px] text-right pr-2.5 border-b ${s.m === 0 ? 'border-white/10 text-white/55 font-semibold' : 'border-white/[0.04] text-white/30'}`}
                    style={{ height: SLOT_HEIGHT, lineHeight: `${SLOT_HEIGHT}px` }}
                  >
                    {`${String(s.h).padStart(2, '0')}:${String(s.m).padStart(2, '0')}`}
                  </div>
                );
              })}
            </div>

            {/* Linha do agora */}
            {showNowLine && (
              <div
                className="absolute pointer-events-none z-30 flex items-center"
                style={{ top: `${(nowOffset / slotInterval) * SLOT_HEIGHT}px`, left: TIME_AXIS_WIDTH - 4, right: 0 }}
              >
                <div className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_0_3px_rgba(251,113,133,0.25),0_0_12px_rgba(251,113,133,0.6)] flex-shrink-0" />
                <div className="flex-1 h-[1.5px] bg-gradient-to-r from-rose-400 to-rose-400/30" />
              </div>
            )}

            {/* Colunas dos profissionais */}
            <div className="flex flex-1">
              {renderedPros.map((pro) => (
                <ProColumn
                  key={pro.id}
                  pro={pro}
                  slots={slots}
                  dayAppts={apptsByProId[pro.id] || []}
                  proBlocks={dayBlocks.filter(b => !b.professional_id || b.professional_id === pro.id)}
                  getApptCard={getApptCard}
                  getBlockCard={getBlockCard}
                  onCardClick={onCardClick}
                  startMove={startMove}
                  startResize={startResize}
                  draggingId={draggingId}
                  resizingId={resizingId}
                  isGhostTarget={ghost?.proId === pro.id}
                  ghost={ghost?.proId === pro.id ? ghost : null}
                  renderCardIcons={renderCardIcons}
                  width={COL_WIDTH}
                  canMove={!!onMoveAppointment}
                  canResize={!!onResizeAppointment}
                  professionals={renderedPros}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Sub-components ─────────────────── */

function ProHeader({ pro, nextFree, count, width }) {
  return (
    <div
      className="flex flex-col items-center justify-center px-3 py-3 border-r border-white/5 last:border-r-0 flex-shrink-0"
      style={{ width, minWidth: width }}
    >
      {pro.photo_url ? (
        <img src={pro.photo_url} alt={pro.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.4)]" />
      ) : (
        <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-[#1D4ED8] to-[#60A5FA] flex items-center justify-center text-white font-bold text-sm ring-1 ring-white/15 shadow-[0_4px_16px_rgba(37,99,235,0.45)]">
          <span className="absolute inset-0 rounded-full bg-[#60A5FA]/40 blur-md opacity-50" />
          <span className="relative">{pro.name?.[0]?.toUpperCase() || '?'}</span>
        </div>
      )}
      <div className="text-sm font-semibold text-white mt-1.5 text-center truncate max-w-full">{pro.name}</div>
      {count > 0 && (
        <div className="text-[10px] text-blue-300 font-semibold mt-0.5">
          {count} {count === 1 ? 'agendamento' : 'agendamentos'}
        </div>
      )}
      {nextFree && (
        <div className="text-[10px] text-emerald-300 font-medium mt-0.5">
          Livre às {format(nextFree, 'HH:mm')}
        </div>
      )}
    </div>
  );
}

function ProColumn({
  pro, slots,
  dayAppts, proBlocks, getApptCard, getBlockCard,
  onCardClick, startMove, startResize,
  draggingId, resizingId, isGhostTarget, ghost,
  renderCardIcons, width, canMove, canResize,
}) {
  // Calcula colunas lado-a-lado caso haja agendamentos no mesmo horário na mesma coluna
  const positionedAppts = useMemo(() => {
    const items = dayAppts.map((appt) => {
      const { top, height, dur } = getApptCard(appt);
      return { appt, top, height, bottom: top + height, dur };
    });
    return items.map((item, idx) => {
      const overlapping = items.filter(
        (other) => other.top < item.bottom && other.bottom > item.top
      );
      const overlapCount = Math.max(1, overlapping.length);
      const overlapIdx = Math.max(0, overlapping.findIndex((o) => o.appt.id === item.appt.id));
      return { ...item, overlapCount, overlapIdx, idx };
    });
  }, [dayAppts, getApptCard]);

  return (
    <div
      className={`relative border-r border-white/5 last:border-r-0 transition-colors flex-shrink-0 ${isGhostTarget ? 'bg-[#2563EB]/8' : ''}`}
      style={{ width, minWidth: width }}
    >
      {/* Linhas de fundo */}
      {slots.map((s, i) => (
        <div
          key={i}
          className={`border-b ${s.m === 0 ? 'border-white/8' : 'border-white/[0.035]'}`}
          style={{ height: SLOT_HEIGHT }}
        />
      ))}

      {/* Bloqueios */}
      {proBlocks.map(b => {
        const { top, height } = getBlockCard(b);
        if (height <= 0) return null;
        return (
          <div
            key={b.id}
            className="absolute left-1.5 right-1.5 rounded-xl border border-dashed border-white/15 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.025)_0,rgba(255,255,255,0.025)_8px,rgba(255,255,255,0.05)_8px,rgba(255,255,255,0.05)_16px)] flex flex-col items-start justify-start text-white/50 px-2.5 py-1.5"
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

      {/* Ghost preview — destino do drag/resize */}
      {ghost && (
        <div
          className="absolute left-1.5 right-1.5 rounded-xl border-2 border-dashed border-[#60A5FA] bg-[#60A5FA]/15 pointer-events-none z-20 transition-[top,height] duration-75 shadow-[0_0_24px_rgba(96,165,250,0.4)]"
          style={{
            top: ghost.top != null ? ghost.top : undefined,
            height: ghost.height,
          }}
        />
      )}

      {/* Cards de agendamento */}
      {positionedAppts.map(({ appt, top, height, dur, overlapCount, overlapIdx }) => {
        const token = getStatusToken(appt.status);
        const startTime = format(new Date(appt.scheduled_at), 'HH:mm');
        const endDate = addMinutes(new Date(appt.scheduled_at), dur);
        const endTime = format(endDate, 'HH:mm');
        const movable = canMove && !['concluido', 'cancelado', 'faltou'].includes(appt.status);
        const resizable = canResize && !['concluido', 'cancelado', 'faltou'].includes(appt.status);
        const isDragging = draggingId === appt.id;
        const isResizing = resizingId === appt.id;
        const noPreference = isClientWithoutPreference(appt);
        const canChangePro = noPreference;
        const cursorClass = !movable ? 'cursor-pointer' : canChangePro ? 'cursor-grab active:cursor-grabbing' : 'cursor-ns-resize';

        const widthPct = 100 / overlapCount;
        const leftPct = overlapIdx * widthPct;

        return (
          <div
            key={appt.id}
            data-testid={`schedule-appointment-card-${appt.id}`}
            data-appointment-status={appt.status}
            onPointerDown={(e) => movable && startMove(e, appt, dur, canChangePro)}
            onClick={(e) => {
              if (!isDragging && !isResizing) onCardClick?.(appt);
              e.stopPropagation();
            }}
            className={`absolute rounded-xl ${token.cardBg} ${token.cardText} px-2.5 py-1.5 text-left overflow-hidden backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.25)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:-translate-y-px hover:z-20 hover:brightness-110 ${cursorClass} ${isDragging ? 'opacity-30' : 'transition-all duration-150'} ${noPreference ? 'border-2 border-dashed' : 'border border-solid'} ${token.cardBorder}`}
            style={{
              top: top + 1,
              height,
              left: `calc(${leftPct}% + 4px)`,
              width: `calc(${widthPct}% - 8px)`,
              touchAction: 'none',
            }}
            title={noPreference
              ? `${appt.customer_name || 'Cliente'} · Sem preferência de barbeiro · ${startTime}–${endTime} (${token.label})`
              : `${appt.customer_name || 'Cliente'} · ${appt.service_name} · ${startTime}–${endTime} (${token.label})`}
          >
            {height >= 72 && renderCardIcons(appt)}
            <div className="font-semibold text-[11px] leading-tight truncate flex items-center justify-between gap-1">
              <span className="truncate">{appt.customer_name || 'Cliente'}</span>
              <span className="text-[9px] font-bold px-1 py-px rounded bg-white/10 text-white/90 flex-shrink-0">
                {token.label}
              </span>
            </div>
            <div className="text-[10px] opacity-85 truncate leading-tight mt-0.5">
              {appt.service_name || 'Corte'} · {startTime} - {endTime}
            </div>
            {(noPreference || appt.payment_method === 'subscription' || appt.paid_online) && (
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {noPreference && (
                  <span className="text-[8px] font-medium px-1 py-px rounded bg-white/10 text-white/70 border border-dashed border-white/25 flex-shrink-0">
                    sem pref.
                  </span>
                )}
                {appt.payment_method === 'subscription' && (
                  <span className="text-[8px] font-bold px-1 py-px rounded bg-violet-400/20 text-violet-200 border border-violet-400/30">
                    PLANO
                  </span>
                )}
                {appt.paid_online && (
                  <span className="text-[8px] font-bold px-1 py-px rounded bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                    PAGO
                  </span>
                )}
              </div>
            )}

            {/* Handle de resize na borda inferior */}
            {resizable && (
              <div
                onPointerDown={(e) => startResize(e, appt, dur, top + 1)}
                className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-[#60A5FA]/30 rounded-b-xl"
                style={{ touchAction: 'none' }}
                title="Arraste para alterar a duração"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}