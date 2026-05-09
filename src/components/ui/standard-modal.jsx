// StandardModal — modal padrão do sistema (premium, mobile-first).
//
// Comportamento:
// - Mobile: bottom-sheet (cola no rodapé, cantos arredondados em cima)
// - Desktop: card centralizado
// - Footer sempre visível (sticky), respeita safe-area
// - Body com scroll interno (nunca sobrepõe footer)
// - Z-index acima da bottom navigation do app
// - Fecha com ESC, click fora e botão X
// - Animação suave de entrada
// - Compatível com teclado mobile (usa 100dvh + scroll interno)
//
// Uso:
//   <StandardModal open={open} onClose={...} title="Novo Lançamento" footer={<botoes/>}>
//     ...form...
//   </StandardModal>

import { useEffect } from 'react';
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
  // ESC fecha + lock do scroll do body
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeCls = SIZE_MAP[size] || SIZE_MAP.lg;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[3px] animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          'bg-white w-full shadow-2xl flex flex-col overflow-hidden',
          // Bottom-sheet no mobile, card no desktop
          'rounded-t-3xl sm:rounded-2xl',
          // Altura: 90dvh no mobile, auto até 88vh no desktop
          'max-h-[90dvh] sm:max-h-[88vh] sm:m-4',
          // Animação de slide-up no mobile
          'animate-slide-up sm:animate-fade-in',
          sizeCls,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag-handle visual (mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header — fixo, compacto */}
        {(title || !hideCloseButton) && (
          <div className="flex items-center justify-between px-5 sm:px-6 pt-3 sm:pt-5 pb-3 flex-shrink-0">
            <h3 className="font-bold text-[#1B1C1E] text-base sm:text-lg truncate pr-2">{title}</h3>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="p-2 -mr-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
        )}

        {/* Body — scroll interno */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 pb-4 modal-scroll">
          {children}
        </div>

        {/* Footer — sticky, sempre visível, respeita safe-area */}
        {footer && (
          <div
            className="flex-shrink-0 border-t border-black/5 bg-white px-5 sm:px-6 py-3 sm:py-4 flex gap-3"
            style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}