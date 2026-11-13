// Modal de fechamento de caixa — mostra resumo + breakdown e exige saldo contado.
// Design System: Premium Business SaaS & Business Intelligence
import StandardModal from '@/components/ui/standard-modal';
import { getPaymentMethodLabel, getPaymentMethodIcon } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function CloseCashModal({ open, onClose, totals, form, setForm, onConfirm, loading }) {
  const expectedVal = Number(totals?.expected || 0);
  const rawStr = String(form.final_amount ?? '').replace(/[R$\s]/g, '').trim();
  const effectiveStr = rawStr === '' ? String(expectedVal) : rawStr;
  const parsedCounted = Number(effectiveStr.replace(',', '.'));
  const counted = Number.isFinite(parsedCounted) ? parsedCounted : expectedVal;
  const diff = +(counted - expectedVal).toFixed(2);
  const breakdownEntries = Object.entries(totals?.breakdown || {});

  const handleConfirm = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (loading) return;
    onConfirm({
      ...form,
      final_amount: rawStr === '' ? String(expectedVal.toFixed(2)) : rawStr,
    });
  };

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title="Fechar Caixa & Conciliação"
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
            data-testid="confirm-close-cash-btn"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 min-h-[44px] px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-bold disabled:opacity-50 shadow-sm transition-all cursor-pointer"
          >
            {loading ? 'Fechando...' : 'Confirmar Fechamento'}
          </button>
        </>
      }
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="bg-[#EFF6FF] dark:bg-blue-950/20 border border-[#DBEAFE] dark:border-blue-800/40 rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#2563EB] dark:text-blue-300 font-bold mb-2.5">Balanço Esperado</div>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-[#55596A] dark:text-[#8F9BBF] font-medium">Saldo inicial</span>
            <span className="font-bold text-right text-[#171827] dark:text-white tabular-nums">{fmt(totals?.initial)}</span>
            <span className="text-[#55596A] dark:text-[#8F9BBF] font-medium">Entradas brutas</span>
            <span className="font-bold text-right text-emerald-600 dark:text-emerald-400 tabular-nums">+{fmt(totals?.totalIn)}</span>
            <span className="text-[#55596A] dark:text-[#8F9BBF] font-medium">Suprimentos</span>
            <span className="font-bold text-right text-[#2563EB] dark:text-blue-400 tabular-nums">+{fmt(totals?.totalSuprimento)}</span>
            <span className="text-[#55596A] dark:text-[#8F9BBF] font-medium">Saídas operacionais</span>
            <span className="font-bold text-right text-rose-600 dark:text-rose-400 tabular-nums">-{fmt(totals?.totalOut)}</span>
            <span className="text-[#55596A] dark:text-[#8F9BBF] font-medium">Sangrias de caixa</span>
            <span className="font-bold text-right text-amber-600 dark:text-amber-400 tabular-nums">-{fmt(totals?.totalSangria)}</span>
          </div>
          <div className="border-t border-[#DBEAFE] dark:border-blue-800/40 mt-3 pt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-[#55596A] dark:text-[#8F9BBF]">Saldo em Gaveta Esperado</span>
            <span className="text-2xl font-black text-[#171827] dark:text-white tabular-nums">{fmt(totals?.expected)}</span>
          </div>
        </div>

        {breakdownEntries.length > 0 && (
          <div className="bg-[#F8FAFC] dark:bg-[#1C1E30] border border-[#E5E7EF] dark:border-[#232538] rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-[#59658F] dark:text-[#8F9BBF] font-bold mb-2">Entradas por forma de pagamento</div>
            <div className="space-y-1.5">
              {breakdownEntries.map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between text-xs">
                  <span className="text-[#171827] dark:text-white font-medium flex items-center gap-1.5">
                    <span>{getPaymentMethodIcon(method)}</span>
                    <span>{getPaymentMethodLabel(method)}</span>
                  </span>
                  <span className="font-bold text-[#171827] dark:text-white tabular-nums">{fmt(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="close-cash-final-amount" className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Saldo real contado em gaveta (R$) *</label>
          <input
            id="close-cash-final-amount"
            data-testid="close-cash-amount-input"
            type="text"
            inputMode="decimal"
            placeholder={expectedVal.toFixed(2)}
            value={form.final_amount}
            onChange={e => setForm(p => ({ ...p, final_amount: e.target.value }))}
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-bold tabular-nums"
          />
          <div className={`text-xs font-bold mt-1.5 tabular-nums ${diff === 0 ? 'text-emerald-600 dark:text-emerald-400' : diff > 0 ? 'text-[#2563EB] dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {diff === 0 ? '✓ Valor confere perfeitamente com o esperado' : `${diff > 0 ? '+' : ''}${fmt(Math.abs(diff))} ${diff > 0 ? 'de sobra' : 'de falta'}`}
          </div>
        </div>

        <div>
          <label htmlFor="close-cash-notes" className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Observação (justificativa de diferença)</label>
          <textarea
            id="close-cash-notes"
            rows={2}
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Opcional: motivo de eventuais sobras ou faltas..."
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 resize-none focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-medium"
          />
        </div>
      </form>
    </StandardModal>
  );
}