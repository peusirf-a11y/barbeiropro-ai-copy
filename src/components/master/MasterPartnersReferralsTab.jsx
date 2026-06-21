// Aba "Indicações" do /master/partners — lista todas indicações da plataforma.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS = {
  pending: { label: 'Clicou', cls: 'bg-white/8 text-white/70 border-white/15' },
  converted: { label: 'Convertido (trial)', cls: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  active: { label: 'Pagando', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-rose-500/10 text-rose-200 border-rose-400/25' },
  fraud: { label: 'Fraude', cls: 'bg-rose-500/25 text-rose-200 border-rose-400/45' },
};

export default function MasterPartnersReferralsTab({ statusFilter, partners, visible, onLoadMore }) {
  const referralsQ = useQuery({
    queryKey: ['referrals', 'master', { status: statusFilter }],
    queryFn: async () => {
      const res = await base44.functions.invoke('partnerAdminAction', {
        action: 'list_referrals',
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 200,
      });
      return res?.data?.referrals || [];
    },
    staleTime: 30_000,
  });

  const referrals = referralsQ.data || [];
  const partnerById = (id) => partners.find(p => p.id === id);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-x-auto">
      {referralsQ.isLoading ? (
        <div className="p-8 text-center text-white/50">Carregando...</div>
      ) : referrals.length === 0 ? (
        <div className="p-10 text-center text-white/50">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma indicação encontrada.</p>
        </div>
      ) : (
        <table className="ds-table min-w-[860px]">
          <thead>
            <tr>
              <th>Data</th>
              <th>Parceiro</th>
              <th>Barbearia</th>
              <th>Origem</th>
              <th>Status</th>
              <th>Sinais</th>
            </tr>
          </thead>
          <tbody>
            {referrals.slice(0, visible).map((r) => {
              const s = STATUS[r.status] || STATUS.pending;
              const partner = partnerById(r.partner_id);
              return (
                <tr key={r.id}>
                  <td className="text-white/55 text-xs whitespace-nowrap">
                    {format(new Date(r.created_date), 'dd MMM yyyy', { locale: ptBR })}
                  </td>
                  <td>
                    <div className="font-semibold text-xs">{partner?.name || <span className="text-white/40">—</span>}</div>
                    {partner?.referral_code && (
                      <div className="font-mono text-[10px] text-[#93C5FD]">{partner.referral_code}</div>
                    )}
                  </td>
                  <td>
                    <div className="text-xs">{r.referred_company_name || <span className="text-white/40 italic">Pendente</span>}</div>
                    {r.referred_email && <div className="text-[11px] text-white/50">{r.referred_email}</div>}
                  </td>
                  <td>
                    <span className="ds-badge bg-white/8 text-white/65 border-white/15 capitalize">{r.attribution_type || 'link'}</span>
                  </td>
                  <td><span className={`ds-badge ${s.cls}`}>{s.label}</span></td>
                  <td className="text-xs">
                    {r.fraud_reasons?.length ? (
                      <div className="flex items-center gap-1 text-rose-300">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate max-w-[180px]" title={r.fraud_reasons.join(', ')}>
                          {r.fraud_reasons.join(', ')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-white/40">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {visible < referrals.length && (
        <div className="p-3 border-t border-white/8 text-center">
          <button onClick={onLoadMore} className="text-sm font-semibold text-[#93C5FD] hover:underline">
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}