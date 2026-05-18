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
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">Cancelar</button>
          <button onClick={onConfirm} disabled={disabled || loading}
            className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-rose-600 to-rose-500 text-white rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-50 shadow-[0_8px_24px_rgba(244,63,94,0.4)] ring-1 ring-white/10 transition-all">
            {loading ? 'Excluindo...' : 'Excluir lançamento'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 p-3 bg-rose-400/[0.08] border border-rose-400/25 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-rose-300 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-100">
            <div className="font-semibold mb-0.5">Esta ação não pode ser desfeita.</div>
            <div>O lançamento será marcado como excluído e ficará registrado no histórico de auditoria.</div>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wider text-white/55 font-bold mb-1">Lançamento</div>
          <div className="font-semibold text-sm text-white">{entry.description || entry.category || kind}</div>
          <div className="text-xs text-white/55 mt-0.5">
            {fmt(entry.amount)} · {kind}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-white/60 block mb-1">Motivo da exclusão *</label>
          <textarea
            rows={3}
            value={reason || ''}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex: Lançamento duplicado, valor incorreto, cancelamento..."
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
          />
        </div>
      </div>
    </StandardModal>
  );
}