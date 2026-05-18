// StandardModal — modal padrão do sistema (premium, mobile-first, à prova de teclado).
//
// Comportamento:
// - Mobile: bottom-sheet (cola no rodapé, cantos arredondados em cima)
// - Desktop: card centralizado
// - Footer SEMPRE visível (sticky), respeita safe-area-inset-bottom
// - Body com scroll interno (nunca empurra o footer pra fora)
// - Z-index 9999 (acima da bottom navigation do app)
// - Acompanha o teclado mobile via window.visualViewport (input focado nunca fica escondido)
// - Fecha com ESC, click fora e botão X
// - Anti-zoom iOS já garantido no index.css (font-size: 16px nos inputs <640px)
//
// Uso:
//   <StandardModal open={...} onClose={...} title="..." footer={<botoes/>}>
//     ...form...
//   </StandardModal>

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE_MAP = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
};

export default function StandardModal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
  hideCloseButton = false,
  className = '',
}) {
  // Altura disponível ajustada conforme o teclado (visualViewport).
  // Quando o teclado abre no mobile, visualViewport.height encolhe — usamos isso
  // para fixar a altura do modal de forma que footer + último campo continuem visíveis.
  const [viewportHeight, setViewportHeight] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);

    // Lock scroll do body
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // visualViewport: API moderna que reflete a área visível REAL (descontando teclado)
    const vv = window.visualViewport;
    const updateVH = () => {
      if (vv) setViewportHeight(vv.height);
    };
    updateVH();
    vv?.addEventListener('resize', updateVH);
    vv?.addEventListener('scroll', updateVH);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      vv?.removeEventListener('resize', updateVH);
      vv?.removeEventListener('scroll', updateVH);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeCls = SIZE_MAP[size] || SIZE_MAP.lg;

  // Altura do modal interno: usa visualViewport quando disponível (encolhe com teclado),
  // senão 92dvh. Mobile-only — desktop usa max-h-[88vh] via classe.
  const innerStyle = viewportHeight
    ? { maxHeight: `${Math.max(viewportHeight - 8, 240)}px` }
    : { maxHeight: '92dvh' };

  // CRÍTICO: renderizar via Portal no document.body para escapar do stacking context
  // criado pelo `transform` do framer-motion (PageTransition). Sem isso, o overlay
  // ficaria preso dentro do <main> e a bottom navigation apareceria por cima.
  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[3px] animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        style={innerStyle}
        className={cn(
          'bg-[#0A1124] border border-white/8 text-white w-full shadow-[0_30px_80px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden',
          'rounded-t-3xl sm:rounded-2xl',
          'sm:max-h-[88vh] sm:m-4',
          'animate-slide-up sm:animate-fade-in',
          sizeCls,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag-handle visual (mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header — fixo, compacto */}
        {(title || !hideCloseButton) && (
          <div className="flex items-center justify-between px-5 sm:px-6 pt-2 sm:pt-5 pb-3 flex-shrink-0 border-b border-white/5">
            <h3 className="font-bold text-white text-base sm:text-lg truncate pr-2">{title}</h3>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="p-2 -mr-2 hover:bg-white/10 active:bg-white/15 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            )}
          </div>
        )}

        {/* Body — scroll interno; pb extra garante que último input nunca encoste no footer */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 modal-scroll"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {/* Footer — sticky, sempre visível, respeita safe-area */}
        {footer && (
          <div
            className="flex-shrink-0 border-t border-white/8 bg-[#0A1124] px-5 sm:px-6 pt-3 flex gap-3"
            style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Renderiza no body para escapar de qualquer stacking context (framer-motion, transform, etc.)
  return typeof document !== 'undefined'
    ? createPortal(modal, document.body)
    : null;
}