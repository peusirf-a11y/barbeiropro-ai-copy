// Modal de abertura de caixa (mobile-first via StandardModal — footer sticky).
import StandardModal from '@/components/ui/standard-modal';

export default function OpenCashModal({ open, onClose, form, setForm, onConfirm, loading }) {
  const disabled = !form.initial_amount && form.initial_amount !== '0';
  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title="Abrir caixa"
      footer={
        <>
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} disabled={disabled || loading}
            className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
            {loading ? 'Abrindo...' : 'Abrir caixa'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Saldo inicial (R$) *</label>
          <input type="number" inputMode="decimal" min="0" step="0.01"
            value={form.initial_amount}
            onChange={e => setForm(p => ({ ...p, initial_amount: e.target.value }))}
            placeholder="Ex: 100.00"
            className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Observação</label>
          <input type="text" value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm" />
        </div>
      </div>
    </StandardModal>
  );
}