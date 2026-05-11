// Header azul do caixa aberto: saldo esperado + ações primárias.
import { Plus, Lock, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

export default function CaixaSummaryHeader({ openCash, expected, onNewEntry, onSangria, onSuprimento, onClose }) {
  return (
    <div className="bg-gradient-to-br from-[#2563EB] to-[#1d4ed8] text-white rounded-2xl p-5 sm:p-6 mb-5 shadow-[0_8px_24px_rgba(37,99,235,0.25)]">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-white/70">Saldo esperado</div>
          <div className="text-3xl sm:text-4xl font-black mt-1 tracking-tight">{fmt(expected)}</div>
          <div className="text-xs text-white/70 mt-1">
            Aberto em {format(new Date(openCash.opened_at), "d MMM, HH:mm", { locale: ptBR })}
            {openCash.opened_by ? ` · por ${openCash.opened_by}` : ''}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-5">
        {onNewEntry && (
          <button onClick={onNewEntry}
            className="flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus className="w-4 h-4" />Lançamento
          </button>
        )}
        {onSuprimento && (
          <button onClick={onSuprimento}
            className="flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <ArrowDownToLine className="w-4 h-4" />Suprimento
          </button>
        )}
        {onSangria && (
          <button onClick={onSangria}
            className="flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <ArrowUpFromLine className="w-4 h-4" />Sangria
          </button>
        )}
        {onClose && (
          <button onClick={onClose}
            className="flex items-center justify-center gap-2 bg-white text-[#2563EB] text-sm font-bold px-4 py-2.5 rounded-xl hover:shadow-lg transition-all sm:ml-auto">
            <Lock className="w-4 h-4" />Fechar caixa
          </button>
        )}
      </div>
    </div>
  );
}