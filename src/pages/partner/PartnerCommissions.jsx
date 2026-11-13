import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { getPartnerToken, useCurrentPartner } from '@/hooks/usePartnerAuth';
import { commissionKeys } from '@/lib/partnerKeys';
import FilterSelect from '@/components/ui/filter-select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, Shield, Wallet, Calendar } from 'lucide-react';

const STATUS = {
  pending:    { label: 'Em Hold (Anti-fraude)', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  approved:   { label: 'A Pagar (Aprovadas)',   cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  paid:       { label: 'Pago via Pix',          cls: 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#93C5FD] border-[#2563EB]/20' },
  cancelled:  { label: 'Cancelado',             cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' },
  chargeback: { label: 'Chargeback / Estorno',  cls: 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/30' },
};
const PAGE_SIZE = 20;
const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

export default function PartnerCommissions() {
  const token = getPartnerToken();
  const { partner } = useCurrentPartner();
  const [status, setStatus] = useState('all');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { data, isLoading } = useQuery({
    queryKey: commissionKeys.byPartner(partner?.id, { status }),
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerData', {
        action: 'my_commissions', token,
        status: status === 'all' ? undefined : status,
        limit: 200,
      });
      return res?.data?.commissions || [];
    },
    enabled: !!token && !!partner,
  });

  const items = data || [];
  const sliced = items.slice(0, visible);

  return (
    <PartnerLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#171827] dark:text-white">
            Comissões <span className="text-[#2563EB] dark:text-[#93C5FD] text-lg font-bold">(30% Recorrente)</span>
          </h1>
          <p className="text-[#55596A] dark:text-white/60 text-xs sm:text-sm mt-0.5">
            Acompanhe o ciclo de hold antifraude, saldo aprovado e repasses via Pix (teto de 12 mensalidades por barbearia).
          </p>
        </div>
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setVisible(PAGE_SIZE); }}>
          <option value="all">Todos os status</option>
          <option value="pending">Em Hold (Anti-fraude)</option>
          <option value="approved">A Pagar (Aprovadas)</option>
          <option value="paid">Pago via Pix</option>
          <option value="cancelled">Cancelado</option>
          <option value="chargeback">Chargeback</option>
        </FilterSelect>
      </div>

      {/* Resumo das regras de repasse */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] shadow-sm flex items-start gap-3">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <div className="text-xs text-[#55596A] dark:text-white/70">
            <strong className="text-[#171827] dark:text-white block mb-0.5">Hold Antifraude (14 a 30 dias)</strong>
            Retenção após o pagamento da mensalidade contra estornos ou cancelamentos imediatos.
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] shadow-sm flex items-start gap-3">
          <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-300 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <div className="text-xs text-[#55596A] dark:text-white/70">
            <strong className="text-[#171827] dark:text-white block mb-0.5">Fecho dia 01 · Pix dias 05 a 10</strong>
            Valor mínimo de transferência: <strong className="tabular-nums font-bold">R$ 50,00</strong> (se inferior, acumula para o ciclo seguinte).
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#171827] border border-[#E5E7EF] dark:border-[#232538] shadow-sm flex items-start gap-3">
          <Calendar className="w-4 h-4 text-[#2563EB] dark:text-[#93C5FD] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <div className="text-xs text-[#55596A] dark:text-white/70">
            <strong className="text-[#171827] dark:text-white block mb-0.5">Base 30% · Teto 12 Mensalidades</strong>
            <span className="tabular-nums">R$ 23,97/mês (meses 1 a 3 · R$ 79,90) e R$ 35,70/mês (mês 4 ao 12 · R$ 119,00).</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-[#55596A] dark:text-white/50">Carregando...</div>
        ) : sliced.length === 0 ? (
          <div className="p-12 text-center text-[#55596A] dark:text-white/50">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30 text-emerald-500" strokeWidth={1.75} />
            <p className="text-sm font-medium">Nenhuma comissão ainda. Continue indicando estabelecimentos da sua rota comercial!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EF] dark:border-[#232538] bg-slate-50/60 dark:bg-white/[0.02]">
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Data</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Ciclo (Teto 12)</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Mensalidade</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">%</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Comissão</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Liberação / Repasse</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EF] dark:divide-[#232538]">
                {sliced.map((c) => {
                  const s = STATUS[c.status] || STATUS.pending;
                  const cycleNum = Math.min(Number(c.billing_cycle || 1), 12);
                  const commPct = c.commission_percentage || 30;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-[#55596A] dark:text-white/60 tabular-nums">
                        {format(new Date(c.created_date || c.created_at || new Date()), 'dd MMM yyyy', { locale: ptBR })}
                      </td>
                      <td className="py-3 px-4 text-[#171827] dark:text-white/80 font-mono text-xs tabular-nums">
                        #{cycleNum}/12
                      </td>
                      <td className="py-3 px-4 text-[#55596A] dark:text-white/60 tabular-nums">
                        {brl(c.invoice_amount)}
                      </td>
                      <td className="py-3 px-4 text-[#55596A] dark:text-white/70 tabular-nums font-semibold">
                        {commPct}%
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-300 tabular-nums">
                        {brl(c.amount)}
                      </td>
                      <td className="py-3 px-4 text-[#55596A] dark:text-white/60 text-xs tabular-nums">
                        {c.status === 'pending' && c.hold_until
                          ? format(new Date(c.hold_until), 'dd MMM', { locale: ptBR })
                          : c.paid_at
                          ? format(new Date(c.paid_at), 'dd MMM', { locale: ptBR })
                          : 'Dia 05–10'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {visible < items.length && (
          <div className="p-3.5 border-t border-[#E5E7EF] dark:border-[#232538] text-center">
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="text-xs sm:text-sm font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline"
            >
              Carregar mais
            </button>
          </div>
        )}
      </div>
    </PartnerLayout>
  );
}