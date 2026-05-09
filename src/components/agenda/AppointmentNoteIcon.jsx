// Ícone discreto que indica que existe observação no agendamento.
// Aparece SOMENTE quando appt.notes está preenchido.
// Ao clicar/hover abre tooltip com o conteúdo completo.

import { useState, useRef, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';

export default function AppointmentNoteIcon({ note, size = 'sm', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!note) return null;

  const iconSize = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title="Observação do cliente"
        aria-label="Ver observação do cliente"
        className="inline-flex items-center justify-center text-[#2563EB] hover:text-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 rounded transition-colors"
      >
        <MessageCircle className={`${iconSize} fill-[#DBEAFE]`} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 top-full right-0 mt-1.5 w-60 max-w-[80vw] bg-white rounded-xl border border-black/10 shadow-[var(--shadow-lg)] p-3 text-left animate-fade-in"
        >
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Observação
          </div>
          <p className="text-xs text-[#111827] leading-relaxed whitespace-pre-wrap break-words">
            {note}
          </p>
        </div>
      )}
    </span>
  );
}