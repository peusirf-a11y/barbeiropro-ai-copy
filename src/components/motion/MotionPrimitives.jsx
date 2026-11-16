// MotionPrimitives.jsx — Primitivas fluidas de animação e micro-interação
// Inspiradas em React Bits, Transitions.dev e TasteSkill:
// - Apenas propriedades compositoras (transform, opacity, filter)
// - Tracking de spotlight via CSS custom properties (zero re-renders no mousemove)
// - Curva de desaceleração precisa: cubic-bezier(0.16, 1, 0.3, 1)
// - Respeito total a prefers-reduced-motion

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

export const EXPO_EASE = [0.16, 1, 0.3, 1];

/**
 * SpotlightCard — Superfície escura refinada com brilho radial que acompanha o ponteiro
 * e linha especular sutil no topo. No modo adaptativo, alterna entre branco limpo (light)
 * e obsidiana profunda (dark).
 */
export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(37, 99, 235, 0.12)',
  variant = 'adaptive', // 'adaptive' | 'dark'
  as = 'div',
  hoverLift = true,
  ...props
}) {
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };

  const baseSurface =
    variant === 'dark'
      ? 'bg-[#0B1121]/90 border border-white/[0.08] shadow-[0_20px_50px_-20px_rgba(2,6,23,0.8)] backdrop-blur-xl'
      : 'bg-white dark:bg-[#0B1121]/90 border border-slate-200/90 dark:border-white/[0.08] shadow-[0_6px_24px_-8px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_50px_-20px_rgba(2,6,23,0.8)] backdrop-blur-xl';

  const hoverClasses = hoverLift
    ? 'hover:-translate-y-0.5 hover:border-blue-300/80 dark:hover:border-[#60A5FA]/35 hover:shadow-[0_12px_32px_-8px_rgba(37,99,235,0.14)] dark:hover:shadow-[0_20px_50px_-20px_rgba(2,6,23,0.9)]'
    : 'hover:border-blue-300/60 dark:hover:border-[#60A5FA]/30';

  const Component = as;

  return (
    <Component
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`group/spot relative overflow-hidden transition-[transform,border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${baseSurface} ${hoverClasses} ${className}`}
      {...props}
    >
      {/* Linha especular superior sutil */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[10%] top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 dark:opacity-100 group-hover/spot:opacity-100 transition-opacity duration-300"
      />
      {/* Halo radial reativo ao ponteiro (compositor-only opacity) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 group-hover/spot:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(360px circle at var(--spot-x, 50%) var(--spot-y, 0%), ${spotlightColor}, transparent 68%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </Component>
  );
}

/**
 * BlurReveal — Entrada cinematográfica de texto/bloco com blur -> nitidez (React Bits / Transitions.dev).
 */
export function BlurReveal({
  children,
  delay = 0,
  duration = 0.45,
  y = 12,
  className = '',
  inView = false,
}) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  const initial = { opacity: 0, y, filter: 'blur(8px)' };
  const target = { opacity: 1, y: 0, filter: 'blur(0px)' };

  if (inView) {
    return (
      <motion.div
        initial={initial}
        whileInView={target}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration, delay, ease: EXPO_EASE }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={initial}
      animate={target}
      transition={{ duration, delay, ease: EXPO_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * CountUpValue — Interpola valores numéricos formatados com tabular-nums ao entrar na viewport.
 */
export function CountUpValue({
  to,
  prefix = '',
  suffix = '',
  decimals = 0,
  durationMs = 950,
  className = '',
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-30px' });
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(prefersReduced ? to : 0);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(to);
      return;
    }
    if (!isInView) return;

    let rafId = 0;
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(to * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isInView, to, durationMs, prefersReduced]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('pt-BR');

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * HairlineDivider — Divisor arquitetônico sutil entre seções.
 */
export function HairlineDivider({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`h-px w-full bg-gradient-to-r from-transparent via-slate-900/10 dark:via-white/[0.09] to-transparent ${className}`}
    />
  );
}
