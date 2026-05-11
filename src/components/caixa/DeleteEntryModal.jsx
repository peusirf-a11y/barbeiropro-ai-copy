// Modal de exclusão segura — obrigatório informar motivo (vai pro audit log).
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
      title="Excluir lançamento"
      footer={
        <>
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} disabled={disabled || loading}
            className="flex-1 min-h-[48px] px-4 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Excluindo...' : 'Excluir lançamento'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-900">
            <div className="font-semibold mb-0.5">Esta ação não pode ser desfeita.</div>
            <div>O lançamento será marcado como excluído e ficará registrado no histórico de auditoria.</div>
          </div>
        </div>

        <div className="bg-[#FAFBFC] border border-black/5 rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-bold mb-1">Lançamento</div>
          <div className="font-semibold text-sm text-[#111827]">{entry.description || entry.category || kind}</div>
          <div className="text-xs text-[#6B7280] mt-0.5">
            {fmt(entry.amount)} · {kind}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Motivo da exclusão *</label>
          <textarea
            rows={3}
            value={reason || ''}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex: Lançamento duplicado, valor incorreto, cancelamento..."
            className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm resize-none"
          />
        </div>
      </div>
    </StandardModal>
  );
}