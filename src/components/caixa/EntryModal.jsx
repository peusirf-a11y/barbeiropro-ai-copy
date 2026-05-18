// Modal universal de lançamento — criação OU edição.
// - 4 tipos: entrada/saída/sangria/suprimento
// - Forma de pagamento aplica só para entrada/saída
// - Justificativa OBRIGATÓRIA em sangria/suprimento
// - Em modo edição (form.id presente), tipo é fixo (não muda natureza contábil)
import StandardModal from '@/components/ui/standard-modal';
import { PAYMENT_METHODS } from '@/lib/cashRegister';
import { useCashPermissions } from '@/hooks/useCashPermissions';

const KIND_TABS = [
  { v: 'entrada',    l: 'Entrada',    color: 'bg-emerald-500',   cap: 'create_entry' },
  { v: 'saida',      l: 'Saída',      color: 'bg-rose-500',      cap: 'create_entry' },
  { v: 'sangria',    l: 'Sangria',    color: 'bg-orange-500',    cap: 'sangria' },
  { v: 'suprimento', l: 'Suprimento', color: 'bg-gradient-to-br from-[#2563EB] to-[#3B82F6]', cap: 'suprimento' },
];

const supportsPaymentMethod = (kind) => kind === 'entrada' || kind === 'saida';
const requiresJustification = (kind) => kind === 'sangria' || kind === 'suprimento';

export default function EntryModal({ open, onClose, form, setForm, onConfirm, loading }) {
  const isEdit = !!form.id;
  const showPayment = supportsPaymentMethod(form.entry_kind);
  const needJustification = requiresJustification(form.entry_kind);
  const { can } = useCashPermissions();
  // Em edição, mostramos somente o tipo atual (não troca natureza contábil).
  // Em criação, filtramos pelas caps disponíveis.
  const visibleTabs = isEdit ? KIND_TABS : KIND_TABS.filter(t => can(t.cap));

  const disabled =
    !form.amount ||
    Number(form.amount) <= 0 ||
    (needJustification && !String(form.justification || '').trim());

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar lançamento' : 'Lançamento no caixa'}
      footer={
        <>
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">Cancelar</button>
          <button onClick={onConfirm} disabled={disabled || loading}
            className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all">
            {loading ? 'Salvando...' : (isEdit ? 'Salvar alterações' : 'Salvar lançamento')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Tabs de tipo — desabilitadas em edição (natureza contábil não muda) */}
        <div className={`grid gap-2 ${visibleTabs.length >= 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
          {visibleTabs.map(t => {
            const active = form.entry_kind === t.v;
            return (
              <button
                key={t.v}
                type="button"
                disabled={isEdit && !active}
                onClick={() => setForm(p => ({ ...p, entry_kind: t.v }))}
                className={`py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                  active
                    ? `${t.color} text-white border-transparent shadow-[0_4px_12px_rgba(0,0,0,0.4)] ring-1 ring-white/15`
                    : 'border-white/10 text-white/65 hover:border-[#60A5FA]/30 hover:bg-white/[0.06] bg-white/[0.03] disabled:opacity-40 disabled:hover:border-white/10'
                }`}
              >
                {t.l}
              </button>
            );
          })}
        </div>
        {isEdit && (
          <div className="text-[11px] text-white/45 -mt-1">
            O tipo do lançamento não pode ser alterado. Para mudar a natureza, exclua e crie um novo.
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-white/60 block mb-1">Descrição</label>
          <input type="text" value={form.description || ''}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Ex: Venda de pomada, troco do banco..."
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
        </div>

        <div>
          <label className="text-xs font-semibold text-white/60 block mb-1">Valor (R$) *</label>
          <input type="number" inputMode="decimal" min="0" step="0.01"
            value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
        </div>

        {showPayment && (
          <div>
            <label className="text-xs font-semibold text-white/60 block mb-1.5">Forma de pagamento</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, payment_method: m.value }))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    form.payment_method === m.value
                      ? 'bg-blue-400/[0.12] border-[#60A5FA] text-[#93C5FD] ring-1 ring-blue-400/30'
                      : 'bg-white/[0.03] border-white/10 text-white/65 hover:border-[#60A5FA]/30 hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{m.icon}</span><span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {needJustification && (
          <div>
            <label className="text-xs font-semibold text-white/60 block mb-1">
              Motivo da {form.entry_kind === 'sangria' ? 'sangria' : 'suprimento'} *
            </label>
            <textarea
              rows={2}
              value={form.justification || ''}
              onChange={e => setForm(p => ({ ...p, justification: e.target.value }))}
              placeholder={form.entry_kind === 'sangria'
                ? 'Ex: Depósito no banco, pagamento de fornecedor...'
                : 'Ex: Reforço de troco, aporte do dono...'}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
            />
            <div className="text-[11px] text-white/45 mt-1">
              Justificativa obrigatória — fica registrada no histórico de auditoria.
            </div>
          </div>
        )}
      </div>
    </StandardModal>
  );
}