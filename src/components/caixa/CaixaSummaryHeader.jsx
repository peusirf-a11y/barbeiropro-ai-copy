// Header executivo do caixa aberto: saldo esperado + ações primárias
// Design System: Premium Business SaaS & Business Intelligence
import { Plus, Lock, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

export default function CaixaSummaryHeader({ openCash, expected, onNewEntry, onSangria, onSuprimento, onClose }) {
  return (
    <div className="relative bg-gradient-to-br from-[#171827] via-[#1E293B] to-[#1E3A8A] text-white rounded-2xl p-5 sm:p-6 mb-5 border border-[#334155] shadow-sm overflow-hidden">
      <div className="relative flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-bold text-[#93C5FD]">
            Saldo esperado em caixa
          </div>
          <div className="text-3xl sm:text-4xl font-black mt-1 tracking-tight text-white tabular-nums">
            {fmt(expected)}
          </div>
          <div className="text-xs text-[#CBD5E1] mt-1 font-medium">
            Aberto em {format(new Date(openCash.opened_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
            {openCash.opened_by ? ` · Operador: ${openCash.opened_by}` : ''}
          </div>
        </div>
      </div>

      <div className="relative grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-5">
        {onNewEntry && (
          <button
            onClick={onNewEntry}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl border border-white/15 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>Novo Lançamento</span>
          </button>
        )}
        {onSuprimento && (
          <button
            onClick={onSuprimento}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl border border-white/15 transition-all cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4" strokeWidth={1.75} />
            <span>Suprimento</span>
          </button>
        )}
        {onSangria && (
          <button
            onClick={onSangria}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl border border-white/15 transition-all cursor-pointer"
          >
            <ArrowUpFromLine className="w-4 h-4" strokeWidth={1.75} />
            <span>Sangria</span>
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all sm:ml-auto cursor-pointer"
          >
            <Lock className="w-4 h-4" strokeWidth={1.75} />
            <span>Fechar Caixa</span>
          </button>
        )}
      </div>
    </div>
  );
}