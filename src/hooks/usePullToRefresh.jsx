// usePullToRefresh — gesto pull-to-refresh para mobile.
//
// Uso:
//   const { containerProps, indicator } = usePullToRefresh({ onRefresh: () => refetch() });
//   return <div {...containerProps}>{indicator}{...conteúdo}</div>;
//
// Só ativa em mobile (<768px). No desktop devolve no-op.
// Threshold padrão: 70px. Resistência ~0.5 (efeito elástico).

import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2, ArrowDown } from 'lucide-react';

const THRESHOLD = 70;
const MAX_PULL = 120;

export function usePullToRefresh({ onRefresh, enabled = true } = {}) {
  const isMobile = useIsMobile();
  const active = !!enabled && isMobile && typeof onRefresh === 'function';
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    const onTouchStart = (e) => {
      if (refreshing) return;
      // Só inicia se já está no topo da página
      if ((window.scrollY || document.documentElement.scrollTop) > 0) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };
    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshing) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      const distance = Math.min(dy * 0.5, MAX_PULL);
      setPull(distance);
    };
    const onTouchEnd = async () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const reached = pull >= THRESHOLD;
      if (reached) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [active, pull, refreshing, onRefresh]);

  if (!active) {
    return { containerProps: {}, indicator: null, refreshing: false };
  }

  const ready = pull >= THRESHOLD;
  const indicator = (
    <div
      aria-hidden={pull === 0 && !refreshing}
      className="flex items-center justify-center text-[#2563EB] pointer-events-none"
      style={{
        height: refreshing ? THRESHOLD : pull,
        transition: pullingRef.current ? 'none' : 'height 0.25s ease',
        overflow: 'hidden',
      }}
    >
      {refreshing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <ArrowDown
          className="w-5 h-5 transition-transform duration-200"
          style={{ transform: ready ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      )}
    </div>
  );

  return {
    containerProps: {
      style: { touchAction: 'pan-y' },
    },
    indicator,
    refreshing,
  };
}