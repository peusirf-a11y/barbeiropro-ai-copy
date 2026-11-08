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
            className="flex-1 min-h-[48px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-testid="confirm-open-cash-btn"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all"
          >
            {loading ? 'Abrindo...' : 'Confirmar abertura'}
          </button>
        </>
      }
    >
      <form onSubmit={handleConfirm} className="space-y-3">
        <div>
          <label htmlFor="open-cash-initial-amount" className="text-xs font-semibold text-white/60 block mb-1">Saldo inicial (R$) *</label>
          <input
            id="open-cash-initial-amount"
            data-testid="open-cash-amount-input"
            type="text"
            inputMode="decimal"
            value={form.initial_amount}
            onChange={e => setForm(p => ({ ...p, initial_amount: e.target.value }))}
            placeholder="Ex: 100.00"
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
          />
        </div>
        <div>
          <label htmlFor="open-cash-notes" className="text-xs font-semibold text-white/60 block mb-1">Observação</label>
          <input
            id="open-cash-notes"
            type="text"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
          />
        </div>
      </form>
    </StandardModal>
  );
}