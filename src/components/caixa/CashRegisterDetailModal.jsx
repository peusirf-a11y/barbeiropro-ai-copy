// Drill-down de um caixa fechado: totais + breakdown + movimentações.
import StandardModal from '@/components/ui/standard-modal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText } from 'lucide-react';
import { getPaymentMethodLabel, getPaymentMethodIcon, getOriginMeta } from '@/lib/cashRegister';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

function Line({ label, value, color = 'text-[#111827]', bold = false }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5">
      <span className="text-[#6B7280]">{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-semibold'} ${color}`}>{value}</span>
    </div>
  );
}

export default function CashRegisterDetailModal({ open, onClose, summary, onExport }) {
  if (!summary) return null;
  const r = summary.register;
  const t = summary.totals;
  const breakdown = Object.entries(t.breakdown || {}).sort((a, b) => b[1] - a[1]);

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title={`Caixa de ${format(new Date(r.opened_at), "d MMM yyyy", { locale: ptBR })}`}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="flex-1 min-h-[48px] px-4 border border-black/10 rounded-xl text-sm font-medium text-[#111827] hover:bg-gray-50">Fechar</button>
          <button onClick={() => onExport(summary)} className="flex-1 min-h-[48px] px-4 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] inline-flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />Exportar PDF
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="text-xs text-[#6B7280]">
          Aberto em {format(new Date(r.opened_at), "dd/MM HH:mm", { locale: ptBR })} {r.opened_by ? `por ${r.opened_by}` : ''} ·
          Fechado em {r.closed_at ? format(new Date(r.closed_at), " dd/MM HH:mm", { locale: ptBR }) : '—'} {r.closed_by ? `por ${r.closed_by}` : ''}
        </div>

        {/* Totais */}
        <div className="bg-[#FAFBFC] rounded-xl border border-black/5 p-4">
          <Line label="Saldo inicial" value={fmt(t.initial)} />
          <Line label="Entradas"      value={`+${fmt(t.totalIn)}`}        color="text-emerald-600" />
          <Line label="Suprimentos"   value={`+${fmt(t.totalSuprimento)}`}color="text-[#2563EB]" />
          <Line label="Saídas"        value={`-${fmt(t.totalOut)}`}       color="text-red-500" />
          <Line label="Sangrias"      value={`-${fmt(t.totalSangria)}`}   color="text-orange-600" />
          <div className="border-t border-dashed border-black/10 my-2" />
          <Line label="Saldo esperado" value={fmt(t.expected)} bold />
          {t.final != null && <Line label="Conferido"    value={fmt(t.final)} bold />}
          {t.difference != null && (
            <Line
              label="Diferença"
              value={`${t.difference > 0 ? '+' : ''}${fmt(t.difference)}`}
              color={t.difference >= 0 ? 'text-emerald-600' : 'text-red-500'}
              bold
            />
          )}
          {r.notes && <div className="mt-3 text-xs italic text-[#6B7280]">"{r.notes}"</div>}
        </div>

        {/* Breakdown */}
        {breakdown.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#6B7280] mb-2">Por forma de pagamento</div>
            <div className="space-y-1.5">
              {breakdown.map(([m, v]) => (
                <div key={m} className="flex items-center justify-between text-sm">
                  <span><span className="mr-1">{getPaymentMethodIcon(m)}</span>{getPaymentMethodLabel(m)}</span>
                  <span className="font-bold text-[#111827]">{fmt(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Movimentações */}
        {summary.entries?.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#6B7280] mb-2">
              Movimentações ({summary.entries.length})
            </div>
            <div className="divide-y divide-black/5 border border-black/5 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
              {summary.entries.map(e => {
                const origin = getOriginMeta(e.origin || 'manual');
                const kind = e.entry_kind || e.type;
                const isOut = kind === 'saida' || kind === 'sangria';
                return (
                  <div key={e.id} className="flex items-start gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#111827] truncate">
                          {e.description || e.category || kind}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${origin.badge}`}>
                          {origin.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B7280] mt-0.5">
                        {kind}
                        {e.payment_method ? ` · ${getPaymentMethodLabel(e.payment_method)}` : ''}
                        {e.created_date ? ` · ${format(new Date(e.created_date), "dd/MM HH:mm")}` : ''}
                      </div>
                    </div>
                    <div className={`text-sm font-bold whitespace-nowrap ${isOut ? 'text-red-500' : 'text-emerald-600'}`}>
                      {isOut ? '-' : '+'}{fmt(e.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </StandardModal>
  );
}