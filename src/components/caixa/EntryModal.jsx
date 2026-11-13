// Modal universal de lançamento — criação OU edição.
// Design System: Premium Business SaaS & Business Intelligence
import StandardModal from '@/components/ui/standard-modal';
import { PAYMENT_METHODS } from '@/lib/cashRegister';
import { useCashPermissions } from '@/hooks/useCashPermissions';

const KIND_TABS = [
  { v: 'entrada',    l: 'Entrada',    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm', cap: 'create_entry' },
  { v: 'saida',      l: 'Saída',      activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm', cap: 'create_entry' },
  { v: 'sangria',    l: 'Sangria',    activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm', cap: 'sangria' },
  { v: 'suprimento', l: 'Suprimento', activeClass: 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm', cap: 'suprimento' },
];

const supportsPaymentMethod = (kind) => kind === 'entrada' || kind === 'saida';
const requiresJustification = (kind) => kind === 'sangria' || kind === 'suprimento';

export default function EntryModal({ open, onClose, form, setForm, onConfirm, loading }) {
  const isEdit = !!form.id;
  const showPayment = supportsPaymentMethod(form.entry_kind);
  const needJustification = requiresJustification(form.entry_kind);
  const { can } = useCashPermissions();
  const visibleTabs = isEdit ? KIND_TABS : KIND_TABS.filter(t => can(t.cap));

  const disabled =
    !form.amount ||
    Number(form.amount) <= 0 ||
    (needJustification && !String(form.justification || '').trim());

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Lançamento' : 'Novo Lançamento no Caixa'}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm font-semibold text-[#55596A] dark:text-[#CBD5E1] bg-[#FFFFFF] dark:bg-[#171827] hover:bg-[#F1F2F7] dark:hover:bg-[#232538] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled || loading}
            className="flex-1 min-h-[44px] px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-bold disabled:opacity-50 shadow-sm transition-all cursor-pointer"
          >
            {loading ? 'Salvando...' : (isEdit ? 'Salvar Alterações' : 'Confirmar Lançamento')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tabs de tipo */}
        <div className={`grid gap-2 ${visibleTabs.length >= 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
          {visibleTabs.map(t => {
            const active = form.entry_kind === t.v;
            return (
              <button
                key={t.v}
                type="button"
                disabled={isEdit && !active}
                onClick={() => setForm(p => ({ ...p, entry_kind: t.v }))}
                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  active
                    ? t.activeClass
                    : 'border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] text-[#55596A] dark:text-[#8F9BBF] hover:border-[#2563EB] disabled:opacity-40'
                }`}
              >
                {t.l}
              </button>
            );
          })}
        </div>
        {isEdit && (
          <div className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] font-medium -mt-1">
            O tipo do lançamento não pode ser alterado para manter a integridade contábil.
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Descrição</label>
          <input
            type="text"
            value={form.description || ''}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Ex: Venda de pomada, troco do banco..."
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-medium"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Valor (R$) *</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            placeholder="0.00"
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-bold tabular-nums"
          />
        </div>

        {showPayment && (
          <div>
            <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Forma de pagamento</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, payment_method: m.value }))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    form.payment_method === m.value
                      ? 'bg-[#EFF6FF] dark:bg-blue-950/40 border-[#2563EB] text-[#2563EB] dark:text-blue-300 shadow-xs'
                      : 'bg-[#FFFFFF] dark:bg-[#171827] border-[#E5E7EF] dark:border-[#232538] text-[#55596A] dark:text-[#8F9BBF] hover:border-[#2563EB]'
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
            <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">
              Motivo da {form.entry_kind === 'sangria' ? 'sangria' : 'suprimento'} *
            </label>
            <textarea
              rows={2}
              value={form.justification || ''}
              onChange={e => setForm(p => ({ ...p, justification: e.target.value }))}
              placeholder={form.entry_kind === 'sangria'
                ? 'Ex: Depósito no banco, pagamento de fornecedor...'
                : 'Ex: Reforço de troco, aporte do proprietário...'}
              className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 resize-none focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-medium"
            />
            <div className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] mt-1 font-medium">
              Justificativa obrigatória — auditada e registrada permanentemente no sistema.
            </div>
          </div>
        )}
      </div>
    </StandardModal>
  );
}