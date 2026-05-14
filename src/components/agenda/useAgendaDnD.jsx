// Hook que centraliza a lógica de drag-and-drop e resize na agenda.
// - Usa Pointer Events (funciona em desktop + mobile/touch).
// - Snap automático na grade de horários.
// - Auto-scroll quando o cursor chega nas bordas verticais do container.
// - Distingue clique simples (≤4px de movimento) de drag → não conflita com onCardClick.
//
// Estados expostos:
//   draggingId: id do appt sendo arrastado
//   resizingId: id do appt sendo redimensionado
//   ghost: { proId, top, height } — preview visual do destino (em px da grade)
//
// Callbacks chamados pelo parent:
//   onCommitMove({ appointment, toProfessionalId, newStartISO, newDurationMin }) → bool (false = revert)
//   onCommitResize({ appointment, newDurationMin }) → bool (false = revert)

import { useCallback, useEffect, useRef, useState } from 'react';

const CLICK_THRESHOLD_PX = 4;

export default function useAgendaDnD({
  selectedDate,
  startHour,
  slotInterval,
  slotHeight,
  colWidth,
  timeAxisWidth,
  professionals,
  scrollContainerRef,
  onCommitMove,
  onCommitResize,
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [resizingId, setResizingId] = useState(null);
  const [ghost, setGhost] = useState(null); // { proId, top, height, valid }

  // Refs mantêm o estado da operação atual sem disparar re-renders a cada movimento
  const opRef = useRef(null);
  // opRef = {
  //   kind: 'move' | 'resize',
  //   appt, durationMin,
  //   startPointer: {x, y},
  //   pointerId,
  //   originTop, originProIndex,
  //   moved: boolean,
  // }
  const autoScrollRef = useRef(null);

  // Helpers de conversão pixel ↔ tempo/coluna
  const pxToMinutes = useCallback((px) => Math.round(px / slotHeight) * slotInterval, [slotHeight, slotInterval]);
  const minutesToPx = useCallback((min) => (min / slotInterval) * slotHeight, [slotHeight, slotInterval]);

  const buildDateFromMinutes = useCallback((minutesFromStart) => {
    const d = new Date(selectedDate);
    d.setHours(startHour, 0, 0, 0);
    d.setMinutes(d.getMinutes() + Math.max(0, minutesFromStart));
    return d;
  }, [selectedDate, startHour]);

  // Calcula proIndex a partir do clientX dentro do container de colunas
  const getProIndexFromClientX = useCallback((clientX) => {
    const container = scrollContainerRef.current;
    if (!container) return -1;
    const rect = container.getBoundingClientRect();
    // scrollLeft subtrai o quanto já foi rolado horizontalmente
    const xInContainer = (clientX - rect.left) + container.scrollLeft - timeAxisWidth;
    const idx = Math.floor(xInContainer / colWidth);
    return Math.max(0, Math.min(professionals.length - 1, idx));
  }, [scrollContainerRef, timeAxisWidth, colWidth, professionals.length]);

  // Calcula top em px (snapado) a partir do clientY
  const getSnappedTopFromClientY = useCallback((clientY, offsetWithinCard = 0) => {
    const container = scrollContainerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const yInGrid = clientY - rect.top + container.scrollTop - offsetWithinCard;
    // Snap para múltiplo do slotInterval
    const snappedSlots = Math.max(0, Math.round(yInGrid / slotHeight));
    return snappedSlots * slotHeight;
  }, [scrollContainerRef, slotHeight]);

  // Auto-scroll quando o cursor chega nas bordas
  const updateAutoScroll = useCallback((clientY) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const EDGE = 60;
    let dy = 0;
    if (clientY < rect.top + EDGE) dy = -8;
    else if (clientY > rect.bottom - EDGE) dy = 8;

    if (dy !== 0 && !autoScrollRef.current) {
      autoScrollRef.current = setInterval(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop += dy;
      }, 16);
    } else if (dy === 0 && autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, [scrollContainerRef]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  // ─────────── MOVE ───────────
  // canChangePro: se false, o drag fica restrito à coluna do profissional original
  const startMove = useCallback((e, appt, durationMin, canChangePro = true) => {
    if (!onCommitMove) return;
    // só com botão esquerdo (mouse) ou touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();

    const cardEl = e.currentTarget;
    const cardRect = cardEl.getBoundingClientRect();
    const offsetWithinCard = e.clientY - cardRect.top;

    opRef.current = {
      kind: 'move',
      appt,
      durationMin,
      canChangePro,
      startPointer: { x: e.clientX, y: e.clientY },
      pointerId: e.pointerId,
      offsetWithinCard,
      moved: false,
    };
    try { cardEl.setPointerCapture(e.pointerId); } catch {}
  }, [onCommitMove]);

  // ─────────── RESIZE (borda inferior) ───────────
  // originTop = top em px do card original (para posicionar o ghost durante o resize)
  const startResize = useCallback((e, appt, durationMin, originTop) => {
    if (!onCommitResize) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    opRef.current = {
      kind: 'resize',
      appt,
      durationMin,
      originTop,
      startPointer: { x: e.clientX, y: e.clientY },
      pointerId: e.pointerId,
      moved: false,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }, [onCommitResize]);

  // Listeners globais — registrados uma vez
  useEffect(() => {
    const handleMove = (e) => {
      const op = opRef.current;
      if (!op) return;

      const dx = e.clientX - op.startPointer.x;
      const dy = e.clientY - op.startPointer.y;
      if (!op.moved && Math.hypot(dx, dy) < CLICK_THRESHOLD_PX) return;

      if (!op.moved) {
        op.moved = true;
        if (op.kind === 'move') setDraggingId(op.appt.id);
        if (op.kind === 'resize') setResizingId(op.appt.id);
      }

      updateAutoScroll(e.clientY);

      if (op.kind === 'move') {
        const rawIndex = Math.max(0, Math.min(professionals.length - 1, getProIndexFromClientX(e.clientX)));
        // Se não pode trocar de profissional, força o índice do profissional original
        const originIndex = professionals.findIndex(p => p.id === op.appt.professional_id);
        const proIndex = op.canChangePro ? rawIndex : Math.max(0, originIndex);
        const top = getSnappedTopFromClientY(e.clientY, op.offsetWithinCard);
        const proId = professionals[proIndex]?.id || op.appt.professional_id;
        setGhost({
          proIndex,
          proId,
          top,
          height: minutesToPx(op.durationMin),
        });
      } else if (op.kind === 'resize') {
        const deltaMin = pxToMinutes(dy);
        const newDuration = Math.max(slotInterval, op.durationMin + deltaMin);
        setGhost({
          proIndex: -1,
          proId: op.appt.professional_id,
          top: op.originTop,
          height: minutesToPx(newDuration),
          newDuration,
        });
      }
    };

    const handleUp = async (e) => {
      const op = opRef.current;
      if (!op) return;
      stopAutoScroll();

      // Clique simples (não houve drag) → deixa o onClick do card disparar
      if (!op.moved) {
        opRef.current = null;
        return;
      }

      // Operação válida → tenta commit
      try {
        if (op.kind === 'move') {
          const rawIndex = Math.max(0, Math.min(professionals.length - 1, getProIndexFromClientX(e.clientX)));
          const originIndex = professionals.findIndex(p => p.id === op.appt.professional_id);
          const proIndex = op.canChangePro ? rawIndex : Math.max(0, originIndex);
          const top = getSnappedTopFromClientY(e.clientY, op.offsetWithinCard);
          const minutesFromStart = pxToMinutes(top);
          const newStart = buildDateFromMinutes(minutesFromStart);
          const toProId = professionals[proIndex]?.id;
          console.log('[DnD] commitMove', {
            canChangePro: op.canChangePro,
            rawIndex,
            originIndex,
            proIndex,
            fromProId: op.appt.professional_id,
            toProId,
            is_flexible_assignment: op.appt.is_flexible_assignment,
          });
          if (toProId) {
            await onCommitMove?.({
              appointment: op.appt,
              toProfessionalId: toProId,
              newStartISO: newStart.toISOString(),
              newDurationMin: op.durationMin,
            });
          }
        } else if (op.kind === 'resize') {
          const deltaMin = pxToMinutes(e.clientY - op.startPointer.y);
          const newDuration = Math.max(slotInterval, op.durationMin + deltaMin);
          if (newDuration !== op.durationMin) {
            await onCommitResize?.({ appointment: op.appt, newDurationMin: newDuration });
          }
        }
      } finally {
        opRef.current = null;
        setDraggingId(null);
        setResizingId(null);
        setGhost(null);
      }
    };

    const handleCancel = () => {
      opRef.current = null;
      stopAutoScroll();
      setDraggingId(null);
      setResizingId(null);
      setGhost(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      stopAutoScroll();
    };
  }, [
    professionals, getProIndexFromClientX, getSnappedTopFromClientY,
    pxToMinutes, minutesToPx, buildDateFromMinutes, slotInterval,
    onCommitMove, onCommitResize, updateAutoScroll, stopAutoScroll,
  ]);

  return { draggingId, resizingId, ghost, startMove, startResize };
}