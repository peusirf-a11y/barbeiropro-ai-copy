// Header azul do caixa aberto: saldo esperado + ações primárias.
import { Plus, Lock, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

export default function CaixaSummaryHeader({ openCash, expected, onNewEntry, onSangria, onSuprimento, onClose }) {
  return (
    <div className="relative bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white rounded-2xl p-5 sm:p-6 mb-5 shadow-[0_16px_48px_rgba(37,99,235,0.4)] ring-1 ring-white/15 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent pointer-events-none" />
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#60A5FA]/25 blur-3xl rounded-full pointer-events-none" />
      <div className="relative flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-white/75">Saldo esperado</div>
          <div className="text-3xl sm:text-4xl font-black mt-1 tracking-tight bg-gradient-to-b from-white to-white/85 bg-clip-text text-transparent">{fmt(expected)}</div>
          <div className="text-xs text-white/70 mt-1">
            Aberto em {format(new Date(openCash.opened_at), "d MMM, HH:mm", { locale: ptBR })}
            {openCash.opened_by ? ` · por ${openCash.opened_by}` : ''}
          </div>
        </div>
      </div>

      <div className="relative grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-5">
        {onNewEntry && (
          <button onClick={onNewEntry}
            className="flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold px-4 py-2.5 rounded-xl ring-1 ring-white/15 transition-colors">
            <Plus className="w-4 h-4" />Lançamento
          </button>
        )}
        {onSuprimento && (
          <button onClick={onSuprimento}
            className="flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold px-4 py-2.5 rounded-xl ring-1 ring-white/15 transition-colors">
            <ArrowDownToLine className="w-4 h-4" />Suprimento
          </button>
        )}
        {onSangria && (
          <button onClick={onSangria}
            className="flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold px-4 py-2.5 rounded-xl ring-1 ring-white/15 transition-colors">
            <ArrowUpFromLine className="w-4 h-4" />Sangria
          </button>
        )}
        {onClose && (
          <button onClick={onClose}
            className="flex items-center justify-center gap-2 bg-white text-[#1D4ED8] text-sm font-bold px-4 py-2.5 rounded-xl hover:shadow-[0_8px_24px_rgba(255,255,255,0.4)] transition-all sm:ml-auto">
            <Lock className="w-4 h-4" />Fechar caixa
          </button>
        )}
      </div>
    </div>
  );
}