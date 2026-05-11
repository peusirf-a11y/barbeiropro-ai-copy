// Timeline inteligente de movimentações.
// - Badges coloridas por origem (agendamento/manual/comissao/...)
// - Mostra cliente, profissional, horário, observação, justificativa
// - Botões editar/excluir respeitam isEntryLocked()
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
  entrada:    { icon: TrendingUp,       wrap: 'bg-emerald-50 ring-1 ring-emerald-100', icon_color: 'text-emerald-600', amount_color: 'text-emerald-600', sign: '+', label: 'Entrada' },
  saida:      { icon: TrendingDown,     wrap: 'bg-red-50 ring-1 ring-red-100',         icon_color: 'text-red-500',     amount_color: 'text-red-500',     sign: '-', label: 'Saída' },
  sangria:    { icon: ArrowUpFromLine,  wrap: 'bg-orange-50 ring-1 ring-orange-100',   icon_color: 'text-orange-600',  amount_color: 'text-orange-600',  sign: '-', label: 'Sangria' },
  suprimento: { icon: ArrowDownToLine,  wrap: 'bg-blue-50 ring-1 ring-blue-100',       icon_color: 'text-[#2563EB]',   amount_color: 'text-[#2563EB]',   sign: '+', label: 'Suprimento' },
};

export default function CaixaEntryList({ entries, professionalsMap = {}, customersMap = {}, onEdit, onDelete }) {
  if (!entries?.length) {
    return <div className="p-10 text-center text-sm text-[#6B7280]">Nenhuma movimentação encontrada</div>;
  }
  return (
    <div className="divide-y divide-black/5 max-h-[520px] overflow-y-auto">
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
          <div key={e.id} className="flex items-start gap-3 p-4 hover:bg-[#FAFBFC] transition-colors group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.wrap}`}>
              <Icon className={`w-4 h-4 ${meta.icon_color}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-[#111827] truncate">
                  {e.description || e.category || meta.label}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${origin.badge}`}>
                  {origin.label}
                </span>
                {!canEdit && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#6B7280]">
                    <Lock className="w-3 h-3" />Bloqueado
                  </span>
                )}
              </div>

              <div className="text-xs text-[#6B7280] flex items-center gap-1.5 flex-wrap mt-1">
                <span>{meta.label}</span>
                {e.payment_method && <span>· {getPaymentMethodIcon(e.payment_method)} {getPaymentMethodLabel(e.payment_method)}</span>}
                {time && <span>· {time}</span>}
                {proName && <span className="inline-flex items-center gap-0.5">· <Scissors className="w-3 h-3" />{proName}</span>}
                {custName && <span className="inline-flex items-center gap-0.5">· <User className="w-3 h-3" />{custName}</span>}
              </div>

              {e.justification && (
                <div className="text-xs text-[#6B7280] italic mt-1 line-clamp-2">
                  "{e.justification}"
                </div>
              )}
              {e.edited_at && (
                <div className="text-[10px] text-[#6B7280] mt-0.5">
                  Editado por {e.edited_by || 'sistema'} em {format(new Date(e.edited_at), "d MMM HH:mm", { locale: ptBR })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <div className={`text-sm font-bold whitespace-nowrap mr-1 ${meta.amount_color}`}>
                {meta.sign}{fmt(e.amount)}
              </div>
              {canEdit && onEdit && (
                <button
                  onClick={() => onEdit(e)}
                  className="p-1.5 rounded-lg hover:bg-[#EFF6FF] text-[#6B7280] hover:text-[#2563EB] transition-colors"
                  aria-label="Editar lançamento"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canDel && onDelete && (
                <button
                  onClick={() => onDelete(e)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-[#6B7280] hover:text-red-600 transition-colors"
                  aria-label="Excluir lançamento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}