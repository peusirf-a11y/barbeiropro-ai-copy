// Sub-aba "Pagamentos do mês" da página Master/Parceiros.
// Agrupa comissões aprovadas por parceiro dentro de um mês selecionado.
// Permite marcar TODAS as comissões aprovadas de um parceiro como pagas de uma vez,
// com uma única referência de PIX. Pensado pro fluxo mensal real: 1 PIX → 1 clique.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { commissionKeys, partnerKeys } from '@/lib/partnerKeys';
import { DollarSign, CheckCircle2, Clock, Copy, Check } from 'lucide-react';
import StandardModal from '@/components/ui/standard-modal';
import MonthPicker from '@/components/master/MonthPicker';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

export default function MasterPartnersPayoutsTab({ month, onMonthChange }) {
  const qc = useQueryClient();
  const [payTarget, setPayTarget] = useState(null);

  const payoutsQ = useQuery({
    queryKey: ['partners', 'payouts', month],
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerAdminAction', {
        action: 'payouts_by_month', month,
      });
      return res?.data || { payouts: [], totals: {} };
    },
    staleTime: 30_000,
  });

  const bulkMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('partnerAdminAction', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners', 'payouts'] });
      qc.invalidateQueries({ queryKey: commissionKeys.all() });
      qc.invalidateQueries({ queryKey: partnerKeys.all() });
      qc.invalidateQueries({ queryKey: ['partners', 'kpis'] });
      setPayTarget(null);
    },
  });

  const data = payoutsQ.data || { payouts: [], totals: {} };
  const totals = data.totals || {};
  const payouts = data.payouts || [];

  return (
    <div className="space-y-4">
      {/* Header: seletor de mês + totais */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Pagamentos do mês</h3>
          <p className="text-xs text-white/55 mt-0.5">Agrupado por parceiro. Faça 1 PIX por parceiro e marque tudo pago.</p>
        </div>
        <MonthPicker value={month} onChange={onMonthChange} />
      </div>

      {/* Totais do mês */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="A pagar" value={brl(totals.to_pay_amount)} sub={`${totals.partners_to_pay || 0} parceiro(s)`} icon={DollarSign} color="blue" highlight />
        <SummaryCard label="Já pago no mês" value={brl(totals.paid_amount)} sub="dentro deste período" icon={CheckCircle2} color="emerald" />
        <SummaryCard label="Em hold" value={brl(totals.hold_amount)} sub="aguardando liberação" icon={Clock} color="amber" />
        <SummaryCard label="Mês" value={formatMonthLabel(month)} sub="período analisado" icon={DollarSign} color="violet" />
      </div>

      {/* Lista de parceiros */}
      <div className="space-y-3">
        {payoutsQ.isLoading ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-8 text-center text-white/50">Carregando…</div>
        ) : payouts.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-10 text-center text-white/50">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma comissão neste mês.</p>
          </div>
        ) : (
          payouts.map((g) => (
            <PartnerPayoutCard key={g.partner_id} group={g} onPay={() => setPayTarget(g)} />
          ))
        )}
      </div>

      {/* Modal: pagar em lote */}
      <BulkPayModal
        target={payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={(ref) => bulkMutation.mutate({
          action: 'mark_commissions_paid_bulk',
          commission_ids: payTarget.to_pay_ids,
          payment_reference: ref,
        })}
        loading={bulkMutation.isPending}
      />
    </div>
  );
}

function PartnerPayoutCard({ group, onPay }) {
  const [pixCopied, setPixCopied] = useState(false);

  const copyPix = () => {
    if (!group.pix_key) return;
    navigator.clipboard.writeText(group.pix_key).then(() => {
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 1500);
    });
  };

  const hasToPay = group.to_pay_amount > 0;

  return (
    <div className={`rounded-2xl border ${hasToPay ? 'border-blue-400/30 bg-blue-500/[0.04]' : 'border-white/8 bg-white/[0.025]'} backdrop-blur-md p-4`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white truncate">{group.partner_name}</div>
          <div className="text-xs text-white/55 truncate">{group.partner_email}</div>
          {group.pix_key && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-white/45 font-semibold">PIX</span>
              <button
                onClick={copyPix}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#93C5FD] hover:text-white bg-white/[0.04] border border-white/10 px-2 py-1 rounded-lg max-w-full"
                title="Copiar chave PIX"
              >
                <span className="truncate">{group.pix_key}</span>
                {pixCopied ? <Check className="w-3 h-3 text-emerald-300 flex-shrink-0" /> : <Copy className="w-3 h-3 flex-shrink-0" />}
              </button>
            </div>
          )}
          {!group.pix_key && (
            <div className="mt-2 text-[11px] text-rose-300">⚠ Parceiro sem chave PIX cadastrada</div>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/45 font-semibold">A pagar</div>
            <div className={`text-xl font-black ${hasToPay ? 'text-white' : 'text-white/40'}`}>{brl(group.to_pay_amount)}</div>
            <div className="text-[11px] text-white/55">{group.to_pay_ids.length} comiss{group.to_pay_ids.length === 1 ? 'ão' : 'ões'}</div>
          </div>
          <button
            onClick={onPay}
            disabled={!hasToPay}
            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-sm font-bold shadow-brand hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Marcar pago
          </button>
        </div>
      </div>

      {/* Breakdown se houver pago/hold no mesmo mês */}
      {(group.paid_amount > 0 || group.hold_amount > 0) && (
        <div className="mt-3 pt-3 border-t border-white/8 flex flex-wrap gap-3 text-xs">
          {group.paid_amount > 0 && (
            <div className="text-emerald-300">
              <CheckCircle2 className="w-3 h-3 inline mr-1" />
              Já pago neste mês: <strong>{brl(group.paid_amount)}</strong> ({group.paid_count})
            </div>
          )}
          {group.hold_amount > 0 && (
            <div className="text-amber-300">
              <Clock className="w-3 h-3 inline mr-1" />
              Em hold: <strong>{brl(group.hold_amount)}</strong> ({group.hold_count})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BulkPayModal({ target, onClose, onConfirm, loading }) {
  const [ref, setRef] = useState('');
  if (!target) return null;
  return (
    <StandardModal
      open={!!target}
      onClose={onClose}
      title={`Marcar pagamento · ${target.partner_name}`}
      size="md"
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="flex-1 min-h-[44px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06]">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(ref)}
            disabled={loading}
            className="flex-1 min-h-[44px] px-4 bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Processando…' : `Confirmar pagamento de ${brl(target.to_pay_amount)}`}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 text-sm space-y-1">
          <div><span className="text-white/55">Parceiro:</span> <strong>{target.partner_name}</strong></div>
          <div><span className="text-white/55">Total:</span> <strong>{brl(target.to_pay_amount)}</strong></div>
          <div><span className="text-white/55">Comissões:</span> {target.to_pay_ids.length}</div>
          {target.pix_key && <div><span className="text-white/55">PIX:</span> <span className="font-mono text-[#93C5FD]">{target.pix_key}</span></div>}
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 block mb-1">Referência do PIX (E2E ou comprovante)</label>
          <input
            value={ref}
            onChange={e => setRef(e.target.value)}
            placeholder="Ex: E12345678..."
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white"
          />
        </div>
        <p className="text-[11px] text-white/40">
          Todas as {target.to_pay_ids.length} comissões aprovadas serão marcadas como pagas com esta referência. Faça o PIX manualmente antes de confirmar.
        </p>
      </div>
    </StandardModal>
  );
}

function SummaryCard({ label, value, sub, icon: Icon, color, highlight }) {
  const COLORS = {
    emerald: 'text-emerald-200 bg-emerald-400/12 ring-emerald-400/25',
    blue: 'text-blue-200 bg-blue-400/12 ring-blue-400/25',
    amber: 'text-amber-200 bg-amber-400/12 ring-amber-400/25',
    violet: 'text-violet-200 bg-violet-400/12 ring-violet-400/25',
  };
  return (
    <div className={`rounded-2xl border ${highlight ? 'border-blue-400/35 bg-blue-500/[0.06]' : 'border-white/8 bg-white/[0.025]'} backdrop-blur-md p-4`}>
      <div className={`w-9 h-9 rounded-xl ring-1 flex items-center justify-center mb-2 ${COLORS[color] || COLORS.blue}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl font-black text-white tracking-tight">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mt-0.5">{label}</div>
      <div className="text-[11px] text-white/45 mt-0.5 truncate">{sub}</div>
    </div>
  );
}

function formatMonthLabel(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return '—';
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
}