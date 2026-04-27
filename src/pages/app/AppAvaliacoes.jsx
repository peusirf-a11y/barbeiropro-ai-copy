import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { Star, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmptyState from '@/components/EmptyState';

export default function AppAvaliacoes() {
  const { companyId, isLoading: loadingCompany } = useCompany();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', companyId],
    queryFn: () => base44.entities.Review.filter({ company_id: companyId }, '-created_date', 200),
    enabled: !!companyId,
  });

  if (loadingCompany || isLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map(n => ({
    n,
    count: reviews.filter(r => r.rating === n).length,
    pct: reviews.length ? (reviews.filter(r => r.rating === n).length / reviews.length) * 100 : 0,
  }));

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#0F172A]">Avaliações</h1>
          <p className="text-gray-500 text-sm mt-1">Notas e comentários enviados pelos clientes</p>
        </div>

        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/8">
            <EmptyState
              icon={Star}
              title="Ainda sem avaliações"
              description="Avaliações são enviadas automaticamente pelo WhatsApp ~2h após o atendimento ser concluído. O cliente clica no link e dá uma nota de 1 a 5 estrelas."
            />
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-black/8 p-6 mb-5 grid sm:grid-cols-2 gap-6 items-center">
              <div className="text-center">
                <div className="text-5xl font-black text-[#0F172A]">{avg.toFixed(1)}</div>
                <div className="flex justify-center gap-1 my-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`w-5 h-5 ${n <= Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                  ))}
                </div>
                <div className="text-xs text-gray-400">{reviews.length} avaliaç{reviews.length > 1 ? 'ões' : 'ão'}</div>
              </div>
              <div className="space-y-1.5">
                {dist.map(d => (
                  <div key={d.n} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-gray-500 font-semibold">{d.n}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-gray-400">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
              <div className="px-5 py-3 border-b border-black/5 text-xs font-bold uppercase tracking-wide text-gray-500">Comentários recentes</div>
              <div className="divide-y divide-black/5">
                {reviews.map(r => (
                  <div key={r.id} className="p-5">
                    <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={`w-4 h-4 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                        ))}
                        <span className="text-sm font-bold text-[#0F172A] ml-1">{r.customer_name || 'Cliente'}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {format(new Date(r.created_date), "d MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {r.service_name}{r.professional_name ? ` · ${r.professional_name}` : ''}
                    </div>
                    {r.comment && (
                      <div className="flex gap-2 text-sm text-gray-700 italic">
                        <MessageCircle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-1" />
                        "{r.comment}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}