import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { getPartnerToken, useCurrentPartner } from '@/hooks/usePartnerAuth';
import { commissionKeys } from '@/lib/partnerKeys';
import FilterSelect from '@/components/ui/filter-select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign } from 'lucide-react';

const STATUS = {
  pending:    { label: 'Em hold',    cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  approved:   { label: 'Aprovado',   cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  paid:       { label: 'Pago',       cls: 'bg-blue-500/15 text-blue-200 border-blue-400/30' },
  cancelled:  { label: 'Cancelado',  cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  chargeback: { label: 'Chargeback', cls: 'bg-rose-500/25 text-rose-200 border-rose-400/45' },
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
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Comissões</h1>
          <p className="text-white/50 text-sm mt-1">Histórico completo das suas comissões.</p>
        </div>
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setVisible(PAGE_SIZE); }}>
          <option value="all">Todos os status</option>
          <option value="pending">Em hold</option>
          <option value="approved">Aprovado</option>
          <option value="paid">Pago</option>
          <option value="cancelled">Cancelado</option>
          <option value="chargeback">Chargeback</option>
        </FilterSelect>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-white/50">Carregando...</div>
        ) : sliced.length === 0 ? (
          <div className="p-10 text-center text-white/50">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma comissão ainda. Continue indicando!</p>
          </div>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Ciclo</th>
                <th>Valor invoice</th>
                <th>%</th>
                <th>Comissão</th>
                <th>Liberação</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sliced.map(c => {
                const s = STATUS[c.status] || STATUS.pending;
                return (
                  <tr key={c.id}>
                    <td className="text-white/60">{format(new Date(c.created_date), 'dd MMM yyyy', { locale: ptBR })}</td>
                    <td className="text-white/70">#{c.billing_cycle || 1}</td>
                    <td className="text-white/60">{brl(c.invoice_amount)}</td>
                    <td className="text-white/70">{c.commission_percentage}%</td>
                    <td className="font-bold">{brl(c.amount)}</td>
                    <td className="text-white/60 text-xs">
                      {c.status === 'pending' && c.hold_until ? format(new Date(c.hold_until), "dd MMM", { locale: ptBR }) : c.paid_at ? format(new Date(c.paid_at), 'dd MMM', { locale: ptBR }) : '—'}
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
            <button onClick={() => setVisible(v => v + PAGE_SIZE)} className="text-sm font-semibold text-[#93C5FD] hover:underline">Carregar mais</button>
          </div>
        )}
      </div>
    </PartnerLayout>
  );
}