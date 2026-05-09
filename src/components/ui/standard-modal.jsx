// StandardModal — modal padrão do app, igual ao "Novo Lançamento" do Financeiro.
// Uso:
//   <StandardModal open={open} onClose={...} title="Novo Lançamento" footer={<botoes/>}>
//     ...form...
//   </StandardModal>
//
// Características:
// - Overlay preto 50%
// - Card branco rounded-2xl com sombra forte
// - Header com título e botão X
// - Footer opcional (slot pra botões "Cancelar" + "Salvar")
// - Click fora fecha; ESC fecha
// - max-h 92vh com scroll interno (igual ao do EditAppointmentModal)
// - mobile-friendly: p-4 ao redor evita corte em telas pequenas

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StandardModal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md', // 'sm' | 'md' | 'lg'
  hideCloseButton = false,
  className = '',
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[size] || 'max-w-md';

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          'bg-white rounded-2xl w-full shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[92vh] my-auto',
          maxW,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || !hideCloseButton) && (
          <div className="flex items-center justify-between p-6 pb-4">
            <h3 className="font-bold text-[#1B1C1E] text-base">{title}</h3>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="p-1 -mr-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
        )}
        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {children}
        </div>
        {footer && (
          <div className="px-6 pb-6 pt-2 flex gap-3 border-t border-black/5 mt-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}