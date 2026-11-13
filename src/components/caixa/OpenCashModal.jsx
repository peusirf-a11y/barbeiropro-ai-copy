// Modal de abertura de caixa (mobile-first via StandardModal — footer sticky).
import StandardModal from '@/components/ui/standard-modal';

export default function OpenCashModal({ open, onClose, form, setForm, onConfirm, loading }) {
  const rawStr = String(form.initial_amount ?? '').replace(/[R$\s]/g, '').trim();
  const handleConfirm = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (loading) return;
    onConfirm({
      ...form,
      initial_amount: rawStr === '' ? '0' : rawStr,
    });
  };

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title="Abrir caixa"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm font-semibold text-[#55596A] dark:text-[#CBD5E1] bg-[#FFFFFF] dark:bg-[#171827] hover:bg-[#F1F2F7] dark:hover:bg-[#232538] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-testid="confirm-open-cash-btn"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 min-h-[44px] px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-bold disabled:opacity-50 shadow-sm transition-all cursor-pointer"
          >
            {loading ? 'Abrindo...' : 'Confirmar Abertura'}
          </button>
        </>
      }
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        <div>
          <label htmlFor="open-cash-initial-amount" className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Saldo inicial (R$) *</label>
          <input
            id="open-cash-initial-amount"
            data-testid="open-cash-amount-input"
            type="text"
            inputMode="decimal"
            value={form.initial_amount}
            onChange={e => setForm(p => ({ ...p, initial_amount: e.target.value }))}
            placeholder="Ex: 100.00"
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-semibold tabular-nums"
          />
        </div>
        <div>
          <label htmlFor="open-cash-notes" className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Observação</label>
          <input
            id="open-cash-notes"
            type="text"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Opcional: anotações sobre o turno..."
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-medium"
          />
        </div>
      </form>
    </StandardModal>
  );
}