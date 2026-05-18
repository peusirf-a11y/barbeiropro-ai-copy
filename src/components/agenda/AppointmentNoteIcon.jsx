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
        className="inline-flex items-center justify-center text-[#93C5FD] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/40 rounded transition-colors"
      >
        <MessageCircle className={`${iconSize} fill-[#1D4ED8]/40`} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 top-full right-0 mt-1.5 w-60 max-w-[80vw] bg-[#0A1124] rounded-xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-md p-3 text-left animate-fade-in"
        >
          <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
            Observação
          </div>
          <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap break-words">
            {note}
          </p>
        </div>
      )}
    </span>
  );
}