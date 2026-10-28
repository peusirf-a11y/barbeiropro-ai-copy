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
  pending:    { label: 'Em Hold (Anti-fraude)', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  approved:   { label: 'A Pagar (Aprovadas)',   cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  paid:       { label: 'Pago via Pix',          cls: 'bg-blue-500/15 text-blue-200 border-blue-400/30' },
  cancelled:  { label: 'Cancelado',             cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  chargeback: { label: 'Chargeback / Estorno',  cls: 'bg-rose-500/25 text-rose-200 border-rose-400/45' },
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            Comissões (30% Recorrente)
          </h1>
          <p className="text-white/50 text-sm mt-1">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 flex items-start gap-3">
          <Shield className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-white/65">
            <strong className="text-white block mb-0.5">Hold Antifraude (14 a 30 dias)</strong>
            Retenção após o pagamento da mensalidade contra estornos ou cancelamentos imediatos.
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 flex items-start gap-3">
          <Wallet className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-white/65">
            <strong className="text-white block mb-0.5">Fecho dia 01 · Pix dias 05 a 10</strong>
            Valor mínimo de transferência: <strong>R$ 50,00</strong> (se inferior, acumula para o ciclo seguinte).
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 flex items-start gap-3">
          <Calendar className="w-4 h-4 text-[#93C5FD] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-white/65">
            <strong className="text-white block mb-0.5">Base 30% · Teto 12 Mensalidades</strong>
            R$ 23,97/mês (meses 1 a 3 · R$ 79,90) e R$ 35,70/mês (mês 4 ao 12 · R$ 119,00).
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-white/50">Carregando...</div>
        ) : sliced.length === 0 ? (
          <div className="p-10 text-center text-white/50">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma comissão ainda. Continue indicando estabelecimentos da sua rota comercial!</p>
          </div>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Ciclo (Teto 12)</th>
                <th>Mensalidade Paga</th>
                <th>%</th>
                <th>Comissão</th>
                <th>Liberação / Repasse</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sliced.map((c) => {
                const s = STATUS[c.status] || STATUS.pending;
                const cycleNum = Math.min(Number(c.billing_cycle || 1), 12);
                const commPct = c.commission_percentage || 30;
                return (
                  <tr key={c.id}>
                    <td className="text-white/60">{format(new Date(c.created_date || c.created_at || new Date()), 'dd MMM yyyy', { locale: ptBR })}</td>
                    <td className="text-white/80 font-mono text-xs">#{cycleNum}/12</td>
                    <td className="text-white/60">{brl(c.invoice_amount)}</td>
                    <td className="text-white/70">{commPct}%</td>
                    <td className="font-bold text-emerald-300">{brl(c.amount)}</td>
                    <td className="text-white/60 text-xs">
                      {c.status === 'pending' && c.hold_until
                        ? format(new Date(c.hold_until), 'dd MMM', { locale: ptBR })
                        : c.paid_at
                        ? format(new Date(c.paid_at), 'dd MMM', { locale: ptBR })
                        : 'Dia 05–10'}
                    </td>
                    <td><span className={`ds-badge ${s.cls}`}>{s.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {visible < items.length && (
          <div className="p-3 border-t border-white/8 text-center">
            <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className="text-sm font-semibold text-[#93C5FD] hover:underline">
              Carregar mais
            </button>
          </div>
        )}
      </div>
    </PartnerLayout>
  );
}