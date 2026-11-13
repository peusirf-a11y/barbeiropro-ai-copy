// Modal de confirmação forte para ações destrutivas.
// Exige digitação literal do nome da entidade antes de habilitar o botão.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDestructiveDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  expectedText,
  confirmLabel = 'Confirmar',
  isLoading = false,
}) {
  const [typed, setTyped] = useState('');
  const openTimeRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      setTyped('');
      return;
    }
    openTimeRef.current = Date.now();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape' && !isLoading) onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isLoading]);

  if (!open) return null;
  const matches = typed.trim() === (expectedText || '').trim();

  const dialog = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 touch-manipulation"
      onClick={(e) => {
        if (
          !isLoading &&
          e.target === e.currentTarget &&
          Date.now() - openTimeRef.current > 350
        ) {
          onCloseRef.current?.();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] text-[#171827] dark:text-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#171827] dark:text-white text-base leading-snug">{title}</h3>
            {description && (
              <p className="text-xs sm:text-sm text-[#55596A] dark:text-[#8F9BBF] mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onCloseRef.current?.()}
            aria-label="Fechar"
            className="p-1 -mr-1 rounded-lg text-[#59658F] dark:text-white/60 hover:text-[#171827] dark:hover:text-white hover:bg-[#F1F2F7] dark:hover:bg-white/10 flex-shrink-0 cursor-pointer touch-manipulation"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl p-3 text-xs sm:text-sm text-red-700 dark:text-red-300 mb-3">
          Para confirmar, digite exatamente: <strong className="font-mono break-all">{expectedText}</strong>
        </div>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={expectedText}
          className="w-full px-3.5 py-2.5 border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm font-mono bg-white text-slate-900"
        />

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onCloseRef.current?.()}
            className="flex-1 px-4 py-2.5 border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm font-semibold text-[#171827] dark:text-white hover:bg-[#F1F2F7] dark:hover:bg-white/5 cursor-pointer touch-manipulation"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || isLoading}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            {isLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(dialog, document.body)
    : null;
}