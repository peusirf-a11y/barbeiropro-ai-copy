// Timeline inteligente de movimentações.
// Design System: Premium Business SaaS & Business Intelligence
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2, User, Scissors, Lock } from 'lucide-react';
import {
  getEntryKind,
  getPaymentMethodLabel,
  getPaymentMethodIcon,
  getOriginMeta,
  canEditEntry,
  canDeleteEntry,
} from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

const KIND_META = {
  entrada:    { icon: TrendingUp,       wrap: 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40', icon_color: 'text-emerald-600 dark:text-emerald-400', amount_color: 'text-emerald-600 dark:text-emerald-400', sign: '+', label: 'Entrada' },
  saida:      { icon: TrendingDown,     wrap: 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40',       icon_color: 'text-rose-600 dark:text-rose-400',    amount_color: 'text-rose-600 dark:text-rose-400',    sign: '-', label: 'Saída' },
  sangria:    { icon: ArrowUpFromLine,  wrap: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40',   icon_color: 'text-amber-600 dark:text-amber-400',  amount_color: 'text-amber-600 dark:text-amber-400',  sign: '-', label: 'Sangria' },
  suprimento: { icon: ArrowDownToLine,  wrap: 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40',       icon_color: 'text-[#2563EB] dark:text-blue-400',   amount_color: 'text-[#2563EB] dark:text-blue-400',   sign: '+', label: 'Suprimento' },
};

export default function CaixaEntryList({ entries, professionalsMap = {}, customersMap = {}, onEdit, onDelete }) {
  if (!entries?.length) {
    return (
      <div className="p-12 text-center text-xs sm:text-sm text-[#55596A] dark:text-[#8F9BBF] font-medium">
        Nenhuma movimentação registrada para este caixa.
      </div>
    );
  }
  return (
    <div className="divide-y divide-[#E5E7EF] dark:divide-[#232538] max-h-[520px] overflow-y-auto">
      {entries.map(e => {
        const kind = getEntryKind(e);
        const meta = KIND_META[kind] || KIND_META.entrada;
        const Icon = meta.icon;
        const origin = getOriginMeta(e.origin || 'manual');
        const canEdit = canEditEntry(e);
        const canDel = canDeleteEntry(e);
        const proName = e.professional_id ? professionalsMap[e.professional_id]?.name : null;
        const custName = e.customer_id ? customersMap[e.customer_id]?.name : null;
        const time = e.created_date ? format(new Date(e.created_date), 'HH:mm', { locale: ptBR }) : null;

        return (
          <div key={e.id} className="flex items-start gap-3.5 p-4 hover:bg-[#F8FAFC] dark:hover:bg-[#1C1E30] transition-colors group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.wrap}`}>
              <Icon className={`w-4 h-4 ${meta.icon_color}`} strokeWidth={1.75} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-[#171827] dark:text-white truncate">
                  {e.description || e.category || meta.label}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${origin.badge}`}>
                  {origin.label}
                </span>
                {!canEdit && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#59658F] dark:text-[#8F9BBF]">
                    <Lock className="w-3 h-3" strokeWidth={1.75} />Bloqueado
                  </span>
                )}
              </div>

              <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] flex items-center gap-1.5 flex-wrap mt-1 font-medium">
                <span>{meta.label}</span>
                {e.payment_method && <span>· {getPaymentMethodIcon(e.payment_method)} {getPaymentMethodLabel(e.payment_method)}</span>}
                {time && <span>· {time}</span>}
                {proName && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[#171827] dark:text-white">
                    · <Scissors className="w-3 h-3 text-[#59658F]" strokeWidth={1.75} />{proName}
                  </span>
                )}
                {custName && (
                  <span className="inline-flex items-center gap-1">
                    · <User className="w-3 h-3 text-[#59658F]" strokeWidth={1.75} />{custName}
                  </span>
                )}
              </div>

              {e.justification && (
                <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] italic mt-1 line-clamp-2 bg-[#F1F2F7] dark:bg-[#232538] p-2 rounded-lg">
                  "{e.justification}"
                </div>
              )}
              {e.edited_at && (
                <div className="text-[10px] text-[#55596A] dark:text-[#8F9BBF] mt-1 font-medium">
                  Editado por {e.edited_by || 'sistema'} em {format(new Date(e.edited_at), "d MMM HH:mm", { locale: ptBR })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <div className={`text-sm font-black tabular-nums whitespace-nowrap mr-1 ${meta.amount_color}`}>
                {meta.sign}{fmt(e.amount)}
              </div>
              {canEdit && onEdit && (
                <button
                  onClick={() => onEdit(e)}
                  className="p-1.5 rounded-lg hover:bg-[#E5E7EF] dark:hover:bg-[#232538] text-[#59658F] hover:text-[#171827] dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Editar lançamento"
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
              {canDel && onDelete && (
                <button
                  onClick={() => onDelete(e)}
                  className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[#59658F] hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  aria-label="Excluir lançamento"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}