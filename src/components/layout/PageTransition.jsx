// PageTransition — wrapper que aplica slide-in horizontal entre páginas no mobile.
// Usa framer-motion. No desktop, simples fade (mais elegante para tela grande).
// É leve: só envolve o `children` e usa a key da rota.

import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

export default function PageTransition({ children }) {
  const location = useLocation();
  const isMobile = useIsMobile();

  const variants = isMobile
    ? {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit:    { opacity: 0, x: -24 },
      }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit:    { opacity: 0, y: -6 },
      };

  return (
    <motion.div
      key={location.pathname}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}