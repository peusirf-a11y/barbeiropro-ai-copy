import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { getPartnerToken, useCurrentPartner } from '@/hooks/usePartnerAuth';
import { referralKeys } from '@/lib/partnerKeys';
import FilterSelect from '@/components/ui/filter-select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users } from 'lucide-react';

const STATUS_LABEL = {
  pending: { label: 'Aguardando', cls: 'bg-white/[0.06] text-white/70 border-white/15' },
  converted: { label: 'Trial ativo', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  active: { label: 'Ativa', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  cancelled: { label: 'Cancelada', cls: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  fraud: { label: 'Bloqueada', cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40' },
};

const PAGE_SIZE = 20;

export default function PartnerReferrals() {
  const token = getPartnerToken();
  const { partner } = useCurrentPartner();
  const [status, setStatus] = useState('all');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { data, isLoading } = useQuery({
    queryKey: referralKeys.byPartner(partner?.id, { status }),
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerData', {
        action: 'my_referrals', token,
        status: status === 'all' ? undefined : status,
        limit: 200,
      });
      return res?.data?.referrals || [];
    },
    enabled: !!token && !!partner,
  });

  const items = data || [];
  const sliced = items.slice(0, visible);

  return (
    <PartnerLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Indicações</h1>
          <p className="text-white/50 text-sm mt-1">{items.length} indicação{items.length === 1 ? '' : 'ões'} no total.</p>
        </div>
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setVisible(PAGE_SIZE); }}>
          <option value="all">Todos os status</option>
          <option value="pending">Aguardando</option>
          <option value="converted">Trial ativo</option>
          <option value="active">Ativa</option>
          <option value="cancelled">Cancelada</option>
          <option value="fraud">Bloqueada</option>
        </FilterSelect>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-white/50">Carregando...</div>
        ) : sliced.length === 0 ? (
          <div className="p-10 text-center text-white/50">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma indicação ainda. Compartilhe seu link!</p>
          </div>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Barbearia</th>
                <th>Status</th>
                <th>Indicada em</th>
                <th>1º pagamento</th>
              </tr>
            </thead>
            <tbody>
              {sliced.map(r => {
                const s = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
                return (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.referred_company_name || <span className="text-white/40 italic">Pendente</span>}</td>
                    <td><span className={`ds-badge ${s.cls}`}>{s.label}</span></td>
                    <td className="text-white/60">{format(new Date(r.created_date), 'dd MMM yyyy', { locale: ptBR })}</td>
                    <td className="text-white/60">{r.first_payment_at ? format(new Date(r.first_payment_at), 'dd MMM yyyy', { locale: ptBR }) : '—'}</td>
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