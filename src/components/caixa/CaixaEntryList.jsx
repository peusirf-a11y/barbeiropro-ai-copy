// Lista de movimentações do caixa aberto. Suporta entrada/saída/sangria/suprimento.
import { TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { getEntryKind, getPaymentMethodLabel } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

const KIND_META = {
  entrada:    { icon: TrendingUp,       wrap: 'bg-emerald-50 ring-1 ring-emerald-100', icon_color: 'text-emerald-600', amount_color: 'text-emerald-600', sign: '+' },
  saida:      { icon: TrendingDown,     wrap: 'bg-red-50 ring-1 ring-red-100',         icon_color: 'text-red-500',     amount_color: 'text-red-500',     sign: '-' },
  sangria:    { icon: ArrowUpFromLine,  wrap: 'bg-orange-50 ring-1 ring-orange-100',   icon_color: 'text-orange-600',  amount_color: 'text-orange-600',  sign: '-' },
  suprimento: { icon: ArrowDownToLine,  wrap: 'bg-blue-50 ring-1 ring-blue-100',       icon_color: 'text-[#2563EB]',   amount_color: 'text-[#2563EB]',   sign: '+' },
};

const KIND_LABEL = { entrada: 'Entrada', saida: 'Saída', sangria: 'Sangria', suprimento: 'Suprimento' };

export default function CaixaEntryList({ entries }) {
  if (!entries?.length) {
    return <div className="p-10 text-center text-sm text-[#6B7280]">Nenhuma movimentação ainda</div>;
  }
  return (
    <div className="divide-y divide-black/5 max-h-[440px] overflow-y-auto">
      {entries.map(e => {
        const kind = getEntryKind(e);
        const meta = KIND_META[kind] || KIND_META.entrada;
        const Icon = meta.icon;
        return (
          <div key={e.id} className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-[#FAFBFC] transition-colors">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.wrap}`}>
              <Icon className={`w-4 h-4 ${meta.icon_color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-[#111827] truncate">
                {e.description || e.category || KIND_LABEL[kind]}
              </div>
              <div className="text-xs text-[#6B7280] flex items-center gap-1.5 flex-wrap">
                <span>{KIND_LABEL[kind]}</span>
                {e.payment_method && <span>· {getPaymentMethodLabel(e.payment_method)}</span>}
                {e.origin && <span>· {e.origin}</span>}
              </div>
            </div>
            <div className={`text-sm font-bold whitespace-nowrap ${meta.amount_color}`}>
              {meta.sign}{fmt(e.amount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}