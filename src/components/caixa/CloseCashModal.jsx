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
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">Cancelar</button>
          <button onClick={onConfirm} disabled={disabled || loading}
            className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all">
            {loading ? 'Fechando...' : 'Fechar caixa'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="bg-blue-400/[0.08] border border-blue-400/25 rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#93C5FD] font-bold mb-2">Resumo</div>
          <div className="grid grid-cols-2 gap-y-1.5 text-xs">
            <span className="text-white/55">Saldo inicial</span><span className="font-semibold text-right text-white">{fmt(totals?.initial)}</span>
            <span className="text-white/55">Entradas</span><span className="font-semibold text-right text-emerald-300">+{fmt(totals?.totalIn)}</span>
            <span className="text-white/55">Suprimentos</span><span className="font-semibold text-right text-emerald-300">+{fmt(totals?.totalSuprimento)}</span>
            <span className="text-white/55">Saídas</span><span className="font-semibold text-right text-rose-300">-{fmt(totals?.totalOut)}</span>
            <span className="text-white/55">Sangrias</span><span className="font-semibold text-right text-rose-300">-{fmt(totals?.totalSangria)}</span>
          </div>
          <div className="border-t border-blue-400/20 mt-3 pt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-white/55">Saldo esperado</span>
            <span className="text-2xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">{fmt(totals?.expected)}</span>
          </div>
        </div>

        {breakdownEntries.length > 0 && (
          <div className="bg-white/[0.025] border border-white/8 rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-white/55 font-bold mb-2">Entradas por forma de pagamento</div>
            <div className="space-y-1">
              {breakdownEntries.map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between text-xs">
                  <span className="text-white/85">{getPaymentMethodIcon(method)} {getPaymentMethodLabel(method)}</span>
                  <span className="font-semibold text-white">{fmt(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-white/60 block mb-1">Saldo real contado (R$) *</label>
          <input type="number" inputMode="decimal" min="0" step="0.01"
            value={form.final_amount}
            onChange={e => setForm(p => ({ ...p, final_amount: e.target.value }))}
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
          {form.final_amount !== '' && (
            <div className={`text-xs font-semibold mt-1 ${diff === 0 ? 'text-white/55' : diff > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {diff === 0 ? 'Caixa bate certo' : `${diff > 0 ? '+' : ''}${fmt(Math.abs(diff))} ${diff > 0 ? 'de sobra' : 'de falta'}`}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-white/60 block mb-1">Observação (justificativa de diferença)</label>
          <textarea rows={2} value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
        </div>
      </div>
    </StandardModal>
  );
}