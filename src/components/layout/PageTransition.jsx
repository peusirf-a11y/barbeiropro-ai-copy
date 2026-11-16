// PageTransition — transição fluida entre rotas (Transitions.dev: blur-slide compositor-only)
// Usa apenas transform, opacity e filter com desaceleração exponencial.

import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { EXPO_EASE } from '@/components/motion/MotionPrimitives';

export default function PageTransition({ children }) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div key={location.pathname}>{children}</div>;
  }

  const variants = isMobile
    ? {
        initial: { opacity: 0, x: 18, filter: 'blur(4px)' },
        animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
        exit: { opacity: 0, x: -18, filter: 'blur(4px)' },
      }
    : {
        initial: { opacity: 0, y: 6, filter: 'blur(4px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        exit: { opacity: 0, y: -4, filter: 'blur(4px)' },
      };

  return (
    <motion.div
      key={location.pathname}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{ duration: 0.2, ease: EXPO_EASE }}
    >
      {children}
    </motion.div>
  );
}