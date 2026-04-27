// Modal de confirmação forte para ações destrutivas.
// Exige digitação literal do nome da entidade antes de habilitar o botão.
import { useState, useEffect } from 'react';
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

  useEffect(() => { if (!open) setTyped(''); }, [open]);

  if (!open) return null;
  const matches = typed.trim() === (expectedText || '').trim();

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#1B1C1E]">{title}</h3>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-3">
          Para confirmar, digite exatamente: <strong className="font-mono">{expectedText}</strong>
        </div>
        <input
          autoFocus
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={expectedText}
          className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm font-mono"
        />

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches || isLoading}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}