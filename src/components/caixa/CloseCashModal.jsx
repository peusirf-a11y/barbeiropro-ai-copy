// Modal de fechamento de caixa — mostra resumo + breakdown e exige saldo contado.
import StandardModal from '@/components/ui/standard-modal';
import { getPaymentMethodLabel, getPaymentMethodIcon } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function CloseCashModal({ open, onClose, totals, form, setForm, onConfirm, loading }) {
  const disabled = !form.final_amount && form.final_amount !== '0';
  const counted = Number(form.final_amount) || 0;
  const diff = +(counted - (totals?.expected || 0)).toFixed(2);
  const breakdownEntries = Object.entries(totals?.breakdown || {});

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title="Fechar caixa"
      footer={
        <>
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} disabled={disabled || loading}
            className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
            {loading ? 'Fechando...' : 'Fechar caixa'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="bg-[#2563EB]/5 border border-[#2563EB]/15 rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#2563EB] font-bold mb-2">Resumo</div>
          <div className="grid grid-cols-2 gap-y-1.5 text-xs">
            <span className="text-[#6B7280]">Saldo inicial</span><span className="font-semibold text-right">{fmt(totals?.initial)}</span>
            <span className="text-[#6B7280]">Entradas</span><span className="font-semibold text-right text-emerald-600">+{fmt(totals?.totalIn)}</span>
            <span className="text-[#6B7280]">Suprimentos</span><span className="font-semibold text-right text-emerald-600">+{fmt(totals?.totalSuprimento)}</span>
            <span className="text-[#6B7280]">Saídas</span><span className="font-semibold text-right text-red-500">-{fmt(totals?.totalOut)}</span>
            <span className="text-[#6B7280]">Sangrias</span><span className="font-semibold text-right text-red-500">-{fmt(totals?.totalSangria)}</span>
          </div>
          <div className="border-t border-[#2563EB]/15 mt-3 pt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Saldo esperado</span>
            <span className="text-2xl font-black text-[#2563EB]">{fmt(totals?.expected)}</span>
          </div>
        </div>

        {breakdownEntries.length > 0 && (
          <div className="bg-white border border-black/10 rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-bold mb-2">Entradas por forma de pagamento</div>
            <div className="space-y-1">
              {breakdownEntries.map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between text-xs">
                  <span className="text-[#111827]">{getPaymentMethodIcon(method)} {getPaymentMethodLabel(method)}</span>
                  <span className="font-semibold">{fmt(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Saldo real contado (R$) *</label>
          <input type="number" inputMode="decimal" min="0" step="0.01"
            value={form.final_amount}
            onChange={e => setForm(p => ({ ...p, final_amount: e.target.value }))}
            className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
          {form.final_amount !== '' && (
            <div className={`text-xs font-semibold mt-1 ${diff === 0 ? 'text-[#6B7280]' : diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {diff === 0 ? 'Caixa bate certo' : `${diff > 0 ? '+' : ''}${fmt(Math.abs(diff))} ${diff > 0 ? 'de sobra' : 'de falta'}`}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Observação (justificativa de diferença)</label>
          <textarea rows={2} value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm resize-none" />
        </div>
      </div>
    </StandardModal>
  );
}