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
import WhatsAppButton from '@/components/whatsapp/WhatsAppButton';
import { interpolateTemplate } from '@/lib/whatsappCompose';

const TABS = [
  { id: 'pending', label: 'Pendentes', filter: (r) => !r.published },
  { id: 'published', label: 'Publicadas', filter: (r) => r.published },
  { id: 'all', label: 'Todas', filter: () => true },
];

// Mensagem manual de agradecimento — usada quando o dono quer responder
// individualmente uma avaliação. Curto e cordial; nada de promoção.
function buildThankYouMessage({ company, review }) {
  const first = (review?.customer_name || '').split(' ')[0] || '';
  return interpolateTemplate(
    'Olá {nome} 🙌\n\nMuito obrigado pela sua avaliação na {barbearia}! Sua opinião faz a gente melhorar todo dia. Te esperamos em breve ✂️',
    { nome: first, barbearia: company?.name || '' }
  );
}

export default function AppAvaliacoes() {
  const { company, companyId, isLoading: loadingCompany } = useCompany();
  const { user } = useAuth();
  const [tab, setTab] = useState('pending');
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', companyId],
    queryFn: () => base44.entities.Review.filter({ company_id: companyId }, '-created_date', 200),
    enabled: !!companyId,
  });

  // Carregamos clientes só para conseguir o telefone na ação manual de "Agradecer".
  // Review não guarda telefone, então fazemos lookup por customer_id.
  const { data: customersData } = useQuery({
    queryKey: ['customers-for-reviews', companyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listCustomers', { limit: 500 });
      return res?.data || { customers: [] };
    },
    enabled: !!companyId,
  });
  const phoneByCustomerId = (customersData?.customers || []).reduce((acc, c) => {
    if (c.id && c.phone) acc[c.id] = c.phone;
    return acc;
  }, {});

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
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-6 mb-5 grid sm:grid-cols-2 gap-6 items-center">
            <div className="text-center">
              <div className="text-5xl font-black tracking-tight bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">{avg.toFixed(1)}</div>
              <div className="flex justify-center gap-1 my-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} className={`w-5 h-5 ${n <= Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-white/15'}`} />
                ))}
              </div>
              <div className="text-xs text-white/55">{published.length} avaliação{published.length > 1 ? 'ões' : ''} publicada{published.length > 1 ? 's' : ''}</div>
            </div>
            <div className="space-y-1.5">
              {dist.map(d => (
                <div key={d.n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-white/55 font-semibold">{d.n}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-white/55">{d.count}</span>
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
                  isActive
                    ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15'
                    : 'bg-white/[0.04] border border-white/10 text-white/70 hover:border-blue-400/40 hover:text-[#93C5FD] hover:bg-white/[0.08]'
                }`}>
                {t.label}
                <span className={`text-xs font-bold ${isActive ? 'text-white/80' : 'text-white/40'}`}>({count})</span>
                {t.id === 'pending' && pendingCount > 0 && !isActive && (
                  <span className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md">
            <EmptyState
              icon={Star}
              title={tab === 'pending' ? 'Nenhuma avaliação pendente' : 'Sem avaliações aqui'}
              description={tab === 'pending'
                ? 'As avaliações novas aparecem aqui para você aprovar antes de ficarem públicas.'
                : 'Avaliações são enviadas automaticamente pelo WhatsApp ~2h após o atendimento ser concluído.'}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
            <div className="divide-y divide-white/5">
              {filtered.map(r => (
                <div key={r.id} className="p-5 hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className={`w-4 h-4 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-white/15'}`} />
                      ))}
                      <span className="text-sm font-bold text-white ml-1">{r.customer_name || 'Cliente'}</span>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${r.published ? 'bg-emerald-400/[0.12] text-emerald-200 border-emerald-400/30' : 'bg-amber-400/[0.12] text-amber-200 border-amber-400/30'}`}>
                        {r.published ? 'Publicada' : 'Pendente'}
                      </span>
                    </div>
                    <span className="text-xs text-white/45">
                      {format(new Date(r.created_date), "d MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="text-xs text-white/55 mb-2">
                    {r.service_name}{r.professional_name ? ` · ${r.professional_name}` : ''}
                  </div>
                  {r.comment && (
                    <div className="flex gap-2 text-sm text-white/80 italic mb-3">
                      <MessageCircle className="w-3.5 h-3.5 text-white/25 flex-shrink-0 mt-1" />
                      "{r.comment}"
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {!r.published ? (
                      <button onClick={() => moderateMutation.mutate({ id: r.id, published: true })}
                        className="bg-emerald-400/[0.14] hover:bg-emerald-400/[0.22] text-emerald-200 border border-emerald-400/30 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                        <Check className="w-3.5 h-3.5" /> Aprovar e publicar
                      </button>
                    ) : (
                      <button onClick={() => moderateMutation.mutate({ id: r.id, published: false })}
                        className="bg-white/[0.04] border border-white/10 hover:border-amber-400/40 hover:bg-white/[0.08] text-white/80 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                        <EyeOff className="w-3.5 h-3.5" /> Despublicar
                      </button>
                    )}
                    <WhatsAppButton
                      phone={r.customer_phone || phoneByCustomerId[r.customer_id]}
                      message={buildThankYouMessage({ company, review: r })}
                      variant="inline"
                      label="Agradecer"
                      title="Mandar mensagem de agradecimento"
                    />
                    <button onClick={() => { if (confirm('Excluir esta avaliação? Essa ação não pode ser desfeita.')) deleteMutation.mutate(r.id); }}
                      className="text-white/45 hover:text-rose-300 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
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