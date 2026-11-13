// Modal de exclusão segura — obrigatório informar motivo (vai pro audit log).
// Design System: Premium Business SaaS & Business Intelligence
import StandardModal from '@/components/ui/standard-modal';
import { AlertTriangle } from 'lucide-react';
import { getEntryKind } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function DeleteEntryModal({ open, onClose, entry, reason, setReason, onConfirm, loading }) {
  const disabled = !String(reason || '').trim();
  if (!entry) return null;
  const kind = getEntryKind(entry);

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title="Excluir Lançamento"
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
            className="flex-1 min-h-[44px] px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 shadow-sm transition-all cursor-pointer"
          >
            {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <div className="text-xs text-rose-900 dark:text-rose-200 font-medium">
            <div className="font-bold mb-0.5">Atenção: Ação Irreversível</div>
            <div>O lançamento será inativado e o evento ficará registrado com seu usuário no log de auditoria fiscal.</div>
          </div>
        </div>

        <div className="bg-[#F8FAFC] dark:bg-[#1C1E30] border border-[#E5E7EF] dark:border-[#232538] rounded-xl p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-[#59658F] dark:text-[#8F9BBF] font-bold mb-1">Registro Selecionado</div>
          <div className="font-bold text-sm text-[#171827] dark:text-white">{entry.description || entry.category || kind}</div>
          <div className="text-xs text-[#55596A] dark:text-[#8F9BBF] mt-1 font-semibold tabular-nums">
            {fmt(entry.amount)} · <span className="uppercase">{kind}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-[#171827] dark:text-white block mb-1.5">Justificativa da exclusão *</label>
          <textarea
            rows={3}
            value={reason || ''}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex: Lançamento duplicado, valor incorreto, estorno de transação..."
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] rounded-xl text-sm text-[#171827] dark:text-white placeholder:text-[#55596A]/50 resize-none focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-medium"
          />
        </div>
      </div>
    </StandardModal>
  );
}