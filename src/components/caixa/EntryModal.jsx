// Modal universal de lançamento — criação OU edição.
// - 4 tipos: entrada/saída/sangria/suprimento
// - Forma de pagamento aplica só para entrada/saída
// - Justificativa OBRIGATÓRIA em sangria/suprimento
// - Em modo edição (form.id presente), tipo é fixo (não muda natureza contábil)
import StandardModal from '@/components/ui/standard-modal';
import { PAYMENT_METHODS } from '@/lib/cashRegister';
import { useCashPermissions } from '@/hooks/useCashPermissions';

const KIND_TABS = [
  { v: 'entrada',    l: 'Entrada',    color: 'bg-emerald-600', cap: 'create_entry' },
  { v: 'saida',      l: 'Saída',      color: 'bg-red-600',     cap: 'create_entry' },
  { v: 'sangria',    l: 'Sangria',    color: 'bg-orange-600',  cap: 'sangria' },
  { v: 'suprimento', l: 'Suprimento', color: 'bg-[#2563EB]',   cap: 'suprimento' },
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
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} disabled={disabled || loading}
            className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50">
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
                    ? `${t.color} text-white border-transparent`
                    : 'border-black/10 text-gray-600 hover:border-[#2563EB]/30 bg-white disabled:opacity-40 disabled:hover:border-black/10'
                }`}
              >
                {t.l}
              </button>
            );
          })}
        </div>
        {isEdit && (
          <div className="text-[11px] text-[#6B7280] -mt-1">
            O tipo do lançamento não pode ser alterado. Para mudar a natureza, exclua e crie um novo.
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Descrição</label>
          <input type="text" value={form.description || ''}
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

        {needJustification && (
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">
              Motivo da {form.entry_kind === 'sangria' ? 'sangria' : 'suprimento'} *
            </label>
            <textarea
              rows={2}
              value={form.justification || ''}
              onChange={e => setForm(p => ({ ...p, justification: e.target.value }))}
              placeholder={form.entry_kind === 'sangria'
                ? 'Ex: Depósito no banco, pagamento de fornecedor...'
                : 'Ex: Reforço de troco, aporte do dono...'}
              className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm resize-none"
            />
            <div className="text-[11px] text-[#6B7280] mt-1">
              Justificativa obrigatória — fica registrada no histórico de auditoria.
            </div>
          </div>
        )}
      </div>
    </StandardModal>
  );
}