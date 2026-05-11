// Modal universal de lançamento — entrada/saída/sangria/suprimento + forma de pagamento.
import StandardModal from '@/components/ui/standard-modal';
import { PAYMENT_METHODS } from '@/lib/cashRegister';

const KIND_TABS = [
  { v: 'entrada',    l: 'Entrada',    color: 'bg-emerald-600' },
  { v: 'saida',      l: 'Saída',      color: 'bg-red-600' },
  { v: 'sangria',    l: 'Sangria',    color: 'bg-orange-600' },
  { v: 'suprimento', l: 'Suprimento', color: 'bg-[#2563EB]' },
];

// Sangria/suprimento são movimentações internas — método de pagamento não se aplica.
const supportsPaymentMethod = (kind) => kind === 'entrada' || kind === 'saida';

export default function EntryModal({ open, onClose, form, setForm, onConfirm, loading }) {
  const disabled = !form.amount;
  const showPayment = supportsPaymentMethod(form.entry_kind);

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title="Lançamento no caixa"
      footer={
        <>
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} disabled={disabled || loading}
            className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar lançamento'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Tabs de tipo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {KIND_TABS.map(t => (
            <button
              key={t.v}
              type="button"
              onClick={() => setForm(p => ({ ...p, entry_kind: t.v }))}
              className={`py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                form.entry_kind === t.v
                  ? `${t.color} text-white border-transparent`
                  : 'border-black/10 text-gray-600 hover:border-[#2563EB]/30 bg-white'
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição</label>
          <input type="text" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Ex: Venda de pomada, troco do banco..."
            className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Valor (R$) *</label>
          <input type="number" inputMode="decimal" min="0" step="0.01"
            value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
        </div>

        {showPayment && (
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">Forma de pagamento</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, payment_method: m.value }))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    form.payment_method === m.value
                      ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB] ring-1 ring-[#DBEAFE]'
                      : 'bg-white border-black/10 text-gray-600 hover:border-[#2563EB]/30'
                  }`}
                >
                  <span>{m.icon}</span><span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </StandardModal>
  );
}