import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/lib/AuthContext';
import { useState } from 'react';
import { Star, MessageCircle, Eye, EyeOff, Trash2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmptyState from '@/components/EmptyState';
import { SkeletonPage } from '@/components/Skeletons';
import AppPageHeader from '@/components/app/AppPageHeader';

const TABS = [
  { id: 'pending', label: 'Pendentes', filter: (r) => !r.published },
  { id: 'published', label: 'Publicadas', filter: (r) => r.published },
  { id: 'all', label: 'Todas', filter: () => true },
];

export default function AppAvaliacoes() {
  const { companyId, isLoading: loadingCompany } = useCompany();
  const { user } = useAuth();
  const [tab, setTab] = useState('pending');
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', companyId],
    queryFn: () => base44.entities.Review.filter({ company_id: companyId }, '-created_date', 200),
    enabled: !!companyId,
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, published }) =>
      base44.entities.Review.update(id, { published, moderated_at: new Date().toISOString(), moderated_by: user?.email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews', companyId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Review.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews', companyId] }),
  });

  if (loadingCompany || isLoading) {
    return <AppLayout><SkeletonPage /></AppLayout>;
  }

  const activeTab = TABS.find(t => t.id === tab);
  const filtered = reviews.filter(activeTab.filter);

  // Estatísticas só sobre publicadas (o que o público enxerga)
  const published = reviews.filter(r => r.published);
  const avg = published.length > 0 ? published.reduce((s, r) => s + (r.rating || 0), 0) / published.length : 0;
  const dist = [5, 4, 3, 2, 1].map(n => ({
    n,
    count: published.filter(r => r.rating === n).length,
    pct: published.length ? (published.filter(r => r.rating === n).length / published.length) * 100 : 0,
  }));
  const pendingCount = reviews.filter(r => !r.published).length;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Avaliações"
          subtitle="Aprove avaliações antes que elas fiquem visíveis publicamente"
          icon={Star}
        />

        {published.length > 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-6 mb-5 grid sm:grid-cols-2 gap-6 items-center shadow-[var(--shadow-sm)]">
            <div className="text-center">
              <div className="text-5xl font-black text-[#111827] tracking-tight">{avg.toFixed(1)}</div>
              <div className="flex justify-center gap-1 my-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} className={`w-5 h-5 ${n <= Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
              <div className="text-xs text-[#6B7280]">{published.length} avaliação{published.length > 1 ? 'ões' : ''} publicada{published.length > 1 ? 's' : ''}</div>
            </div>
            <div className="space-y-1.5">
              {dist.map(d => (
                <div key={d.n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-[#6B7280] font-semibold">{d.n}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-[#6B7280]">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TABS.map(t => {
            const count = reviews.filter(t.filter).length;
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  isActive ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]' : 'bg-white border border-black/10 text-gray-600 hover:border-[#2563EB] hover:text-[#2563EB]'
                }`}>
                {t.label}
                <span className={`text-xs font-bold ${isActive ? 'text-white/80' : 'text-gray-400'}`}>({count})</span>
                {t.id === 'pending' && pendingCount > 0 && !isActive && (
                  <span className="w-2 h-2 bg-amber-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 shadow-[var(--shadow-sm)]">
            <EmptyState
              icon={Star}
              title={tab === 'pending' ? 'Nenhuma avaliação pendente' : 'Sem avaliações aqui'}
              description={tab === 'pending'
                ? 'As avaliações novas aparecem aqui para você aprovar antes de ficarem públicas.'
                : 'Avaliações são enviadas automaticamente pelo WhatsApp ~2h após o atendimento ser concluído.'}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="divide-y divide-black/5">
              {filtered.map(r => (
                <div key={r.id} className="p-5 hover:bg-[#FAFBFC] transition-colors">
                  <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className={`w-4 h-4 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                      ))}
                      <span className="text-sm font-bold text-[#111827] ml-1">{r.customer_name || 'Cliente'}</span>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${r.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {r.published ? 'Publicada' : 'Pendente'}
                      </span>
                    </div>
                    <span className="text-xs text-[#6B7280]">
                      {format(new Date(r.created_date), "d MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="text-xs text-[#6B7280] mb-2">
                    {r.service_name}{r.professional_name ? ` · ${r.professional_name}` : ''}
                  </div>
                  {r.comment && (
                    <div className="flex gap-2 text-sm text-gray-700 italic mb-3">
                      <MessageCircle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-1" />
                      "{r.comment}"
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {!r.published ? (
                      <button onClick={() => moderateMutation.mutate({ id: r.id, published: true })}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Aprovar e publicar
                      </button>
                    ) : (
                      <button onClick={() => moderateMutation.mutate({ id: r.id, published: false })}
                        className="bg-white border border-black/10 hover:border-amber-400 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <EyeOff className="w-3.5 h-3.5" /> Despublicar
                      </button>
                    )}
                    <button onClick={() => { if (confirm('Excluir esta avaliação? Essa ação não pode ser desfeita.')) deleteMutation.mutate(r.id); }}
                      className="text-gray-400 hover:text-red-500 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}