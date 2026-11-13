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
  pending:   { label: 'Indicação em avaliação',     cls: 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 border-[#E5E7EF] dark:border-[#232538]' },
  converted: { label: 'Em avaliação (Trial 7 dias)', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  active:    { label: 'Ativa (Comissionando 30%)',  cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  completed: { label: 'Ciclo concluído (12/12)',    cls: 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#93C5FD] border-[#2563EB]/20' },
  cancelled: { label: 'Cancelada',                  cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' },
  fraud:     { label: 'Irregular / Bloqueada',      cls: 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/30' },
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#171827] dark:text-white">
            Indicações <span className="tabular-nums font-bold text-[#59658F]">({items.length})</span>
          </h1>
          <p className="text-[#55596A] dark:text-white/60 text-xs sm:text-sm mt-0.5">
            Cada barbearia indicada usufrui de 7 dias de teste gratuito e gera 30% de comissão recorrente por até 12 mensalidades (~R$ 393,21/ano).
          </p>
        </div>
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setVisible(PAGE_SIZE); }}>
          <option value="all">Todos os status</option>
          <option value="pending">Indicação em avaliação</option>
          <option value="converted">Trial 7 dias (Em avaliação)</option>
          <option value="active">Ativa (Comissionando)</option>
          <option value="completed">Ciclo concluído (12/12)</option>
          <option value="cancelled">Cancelada</option>
          <option value="fraud">Irregular / Bloqueada</option>
        </FilterSelect>
      </div>

      <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-[#55596A] dark:text-white/50">Carregando...</div>
        ) : sliced.length === 0 ? (
          <div className="p-12 text-center text-[#55596A] dark:text-white/50">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30 text-[#2563EB]" strokeWidth={1.75} />
            <p className="text-sm font-medium">Nenhuma indicação ainda. Compartilhe seu link com estabelecimentos da sua rota comercial!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EF] dark:border-[#232538] bg-slate-50/60 dark:bg-white/[0.02]">
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Barbearia</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Status no Ciclo</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Recorrência</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">Indicada em</th>
                  <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">1º pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EF] dark:divide-[#232538]">
                {sliced.map((r) => {
                  const s = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
                  const cyclesPaid = Number(r.cycles_paid ?? (r.status === 'active' ? 1 : 0));
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#171827] dark:text-white">
                        {r.referred_company_name || r.company_name || <span className="text-slate-400 dark:text-white/40 italic">Indicação em avaliação</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="py-3 px-4 text-[#55596A] dark:text-white/70 tabular-nums font-mono text-xs">
                        {cyclesPaid}/12 mensalidades
                      </td>
                      <td className="py-3 px-4 text-[#55596A] dark:text-white/60 tabular-nums">
                        {format(new Date(r.created_date || r.created_at || new Date()), 'dd MMM yyyy', { locale: ptBR })}
                      </td>
                      <td className="py-3 px-4 text-[#55596A] dark:text-white/60 tabular-nums">
                        {r.first_payment_at ? format(new Date(r.first_payment_at), 'dd MMM yyyy', { locale: ptBR }) : '—'}
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