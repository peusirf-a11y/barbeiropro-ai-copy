import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Scissors, Clock, User, AlertCircle, MapPin, UserCircle2, Star, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { nextDaysRange, dateRangeFilter } from '@/lib/dateRangeQueries';
import BookingModal from '@/components/booking/BookingModal';
import AuthGateModal from '@/components/public/AuthGateModal';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useBookingSession } from '@/contexts/BookingSessionContext';

export default function PublicBooking() {
  const { slug } = useParams();
  const [activeTab, setActiveTab] = useState('servicos');
  const [bookingService, setBookingService] = useState(null); // serviço que abre o modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [bookingDone, setBookingDone] = useState(null);
  const { updateBooking } = useBookingSession();

  const { data: companies = [], isLoading: loadingCompany } = useQuery({
    queryKey: ['company-by-slug', slug],
    queryFn: () => base44.entities.Company.filter({ slug }),
    enabled: !!slug,
  });
  const company = companies[0];
  const primaryColor = company?.primary_color || '#2563EB';

  const { data: connectStatus, isLoading: loadingConnect } = useQuery({
    queryKey: ['public-connect-status', company?.id],
    queryFn: () => base44.functions.invoke('getCompanyConnectStatus', { company_id: company.id }).then(r => r.data),
    enabled: !!company?.id,
  });
  const canAcceptPayments = !!connectStatus?.can_accept_payments;

  const { customer: loggedCustomer, token: customerToken, loading: loadingCustomerAuth, logout: logoutCustomer, login } = useCustomerAuth(company?.id);
  const [isAuthenticatedCustomer, setIsAuthenticatedCustomer] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    if (!loggedCustomer || loadingCustomerAuth || isAuthenticatedCustomer) return;
    setForm({ name: loggedCustomer.name || '', phone: loggedCustomer.phone || '', email: loggedCustomer.email || '' });
    setIsAuthenticatedCustomer(true);
  }, [loggedCustomer, loadingCustomerAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: customerSubs = [] } = useQuery({
    queryKey: ['public-customer-subscriptions', company?.id, loggedCustomer?.id],
    queryFn: () => base44.entities.CustomerSubscription.filter({ company_id: company.id, customer_id: loggedCustomer.id, status: 'active' }),
    enabled: !!company?.id && !!loggedCustomer?.id,
  });
  const activeSubscription = customerSubs[0] || null;

  const { data: activePlan } = useQuery({
    queryKey: ['public-customer-plan', activeSubscription?.plan_id],
    queryFn: () => base44.entities.CustomerPlan.get(activeSubscription.plan_id),
    enabled: !!activeSubscription?.plan_id,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['public-services', company?.id],
    queryFn: () => base44.entities.Service.filter({ company_id: company.id, active: true }),
    enabled: !!company?.id,
  });

  const { data: allProfessionals = [] } = useQuery({
    queryKey: ['public-professionals', company?.id],
    queryFn: () => base44.entities.Professional.filter({ company_id: company.id, active: true }),
    enabled: !!company?.id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['public-reviews', company?.id],
    queryFn: () => base44.entities.Review.filter({ company_id: company.id, published: true }, '-created_date', 20),
    enabled: !!company?.id,
  });

  const isMultiUnit = !!company?.multi_unit_enabled;
  const { data: units = [] } = useQuery({
    queryKey: ['public-units', company?.id],
    queryFn: async () => {
      const list = await base44.entities.Unit.filter({ company_id: company.id, active: true });
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
    enabled: !!company?.id && isMultiUnit,
  });

  const bookingRange = nextDaysRange(14);
  const apptRangeFilter = dateRangeFilter('scheduled_at', bookingRange, 'datetime');

  const { data: allAppointments = [] } = useQuery({
    queryKey: ['public-appointments', company?.id],
    queryFn: () => base44.entities.Appointment.filter({ company_id: company.id, status: { $ne: 'cancelado' }, ...apptRangeFilter }, '-scheduled_at', 2000),
    enabled: !!company?.id,
    staleTime: 30_000,
  });

  const { data: allBlockedTimes = [] } = useQuery({
    queryKey: ['public-blocks', company?.id],
    queryFn: () => base44.entities.BlockedTime.filter({ company_id: company.id }, '-start_time', 200),
    enabled: !!company?.id,
    staleTime: 60_000,
  });

  const customersSharedMode = company?.customers_shared_across_units !== false;
  const scopeCustomerByUnit = isMultiUnit && !customersSharedMode;

  // Bloqueio de assinatura
  const subscriptionBlocker = (() => {
    if (!activeSubscription) return null;
    const sub = activeSubscription;
    if (new Date(sub.current_cycle_end) <= new Date()) return 'Sua assinatura está com o ciclo vencido.';
    if (sub.plan_type_snapshot !== 'unlimited' && (sub.uses_remaining ?? 0) <= 0) return 'Você já usou todos os seus cortes deste mês.';
    return null;
  })();
  const canUseSubscription = !!activeSubscription && !subscriptionBlocker;

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;

  const openBooking = (service = null) => {
    setBookingService(service);
    setShowBookingModal(true);
  };

  const handleNeedAuth = () => {
    setShowBookingModal(false);
    updateBooking({ bookingService });
    setShowAuthGate(true);
  };

  const tabs = [
    { id: 'servicos', label: 'Serviços' },
    { id: 'profissionais', label: 'Profissionais' },
    { id: 'avaliacoes', label: 'Avaliações' },
  ];

  // ─── LOADING ───
  if (loadingCompany || !slug) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <p className="text-white font-semibold">Barbearia não encontrada</p>
          <p className="text-white/40 text-sm mt-1">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  // ─── STRIPE NÃO CONFIGURADO ───
  if (!loadingConnect && !canAcceptPayments) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center max-w-sm w-full">
            <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-lg font-black text-white mb-2">Agendamento online indisponível</h2>
            <p className="text-sm text-white/50 mb-5">{company.name} ainda não está aceitando pagamentos online.</p>
            {company.whatsapp && (
              <a href={`https://wa.me/55${company.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="block w-full text-center text-white text-sm font-bold py-3 rounded-xl bg-[#25D366]">
                Falar pelo WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── AGENDAMENTO CONCLUÍDO ───
  if (bookingDone) {
    const { selected, paid_online } = bookingDone;
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center max-w-sm w-full">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Agendado!</h2>
            <p className="text-white/50 text-sm mb-6">Seu horário foi confirmado com sucesso.</p>
            <div className="bg-white/5 rounded-xl p-4 text-left space-y-2 mb-6">
              <Row label="Serviço" value={selected?.service?.name} />
              <Row label="Profissional" value={selected?.professional?.name} />
              {selected?.date && selected?.time && (
                <Row label="Data" value={`${format(selected.date, "d 'de' MMM", { locale: ptBR })} às ${selected.time}`} />
              )}
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-white/50 text-sm">Valor</span>
                <span className="text-emerald-400 font-black text-lg">R$ {selected?.service?.price?.toFixed(2)}</span>
              </div>
            </div>
            {company.whatsapp && (
              <a href={`https://wa.me/55${company.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="block w-full text-center text-white text-sm font-bold py-3 rounded-xl mb-3 bg-[#25D366]">
                Confirmar pelo WhatsApp
              </a>
            )}
            <button onClick={() => setBookingDone(null)} className="text-white/40 text-xs hover:text-white/70 underline">
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col">
      {/* ─── HERO / CAPA ─── */}
      <div className="relative">
        {company.logo_url ? (
          <div className="h-52 w-full overflow-hidden">
            <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#0f0f1a]" />
          </div>
        ) : (
          <div className="h-52 w-full" style={{ background: `linear-gradient(135deg, ${primaryColor}33, #0f0f1a)` }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Scissors className="w-20 h-20 text-white/10" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0f0f1a]" />
          </div>
        )}

        {/* Botão de login no topo direito */}
        <div className="absolute top-4 right-4">
          <Link
            to={loggedCustomer ? `/cliente/${slug}` : `/cliente/${slug}/login`}
            className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm text-white text-xs font-semibold px-3 py-2 rounded-full border border-white/20"
          >
            <UserCircle2 className="w-3.5 h-3.5" />
            {loggedCustomer ? 'Minha conta' : 'Entrar'}
          </Link>
        </div>
      </div>

      {/* ─── INFO DA BARBEARIA ─── */}
      <div className="px-5 -mt-8 relative z-10 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-14 h-14 rounded-2xl border-2 border-white/10 overflow-hidden flex-shrink-0 bg-[#1a1a2e] flex items-center justify-center"
            style={{ borderColor: primaryColor + '60' }}>
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
            ) : (
              <Scissors className="w-6 h-6" style={{ color: primaryColor }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {avgRating && (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                  <Star className="w-3 h-3 fill-amber-400" /> {avgRating}
                </span>
              )}
              <h1 className="text-white font-black text-xl truncate">{company.name}</h1>
            </div>
            {(company.address || company.phone) && (
              <p className="text-white/40 text-xs truncate">{company.address || company.phone}</p>
            )}
          </div>
        </div>

        {/* Botão principal Agendar agora */}
        {canAcceptPayments && (
          <button
            onClick={() => openBooking()}
            className="w-full py-4 rounded-2xl text-white font-black text-base shadow-lg mt-2 transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            Agendar agora
          </button>
        )}
      </div>

      {/* ─── TABS ─── */}
      <div className="border-b border-white/10 px-5 flex-shrink-0">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${activeTab === t.id ? 'text-white border-current' : 'text-white/40 border-transparent hover:text-white/60'}`}
              style={{ borderColor: activeTab === t.id ? primaryColor : undefined, color: activeTab === t.id ? 'white' : undefined }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── CONTEÚDO DAS TABS ─── */}
      <div className="flex-1 px-5 py-5">

        {/* SERVIÇOS */}
        {activeTab === 'servicos' && (
          <div className="space-y-3">
            {services.length === 0 ? (
              <div className="text-center py-12 text-white/30">Nenhum serviço disponível</div>
            ) : (
              services.map(s => (
                <div key={s.id} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-black text-base">{s.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">{s.name}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-emerald-400 font-bold text-sm">R$ {s.price.toFixed(2)}</span>
                      <span className="text-white/40 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />{s.duration_minutes} min
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => openBooking(s)}
                    className="flex-shrink-0 text-xs font-bold px-3 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Agendar
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* PROFISSIONAIS */}
        {activeTab === 'profissionais' && (
          <div className="space-y-3">
            {allProfessionals.length === 0 ? (
              <div className="text-center py-12 text-white/30">Nenhum profissional cadastrado</div>
            ) : (
              <>
                {/* "Sem preferência" */}
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white/30" />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-semibold">Sem Preferência</div>
                    <div className="text-white/40 text-xs">Primeiro disponível</div>
                  </div>
                </div>
                {allProfessionals.map(p => (
                  <div key={p.id} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                        style={{ backgroundColor: primaryColor + '40' }}>
                        {(p.name || '?')[0]}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-white font-semibold">{p.name}</div>
                      <div className="text-white/40 text-xs">{p.specialty || 'Sem observação'}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* AVALIAÇÕES */}
        {activeTab === 'avaliacoes' && (
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <div className="text-center py-12 text-white/30">Nenhuma avaliação ainda</div>
            ) : (
              reviews.map(r => (
                <div key={r.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(r.customer_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-sm">{r.customer_name || 'Cliente'}</div>
                        <div className="text-white/30 text-xs">
                          {r.submitted_at ? format(new Date(r.submitted_at), "dd/MM/yyyy HH:mm") : format(new Date(r.created_date), "dd/MM/yyyy HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < (r.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-white/20'}`} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-white/60 text-sm leading-relaxed">{r.comment}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-4 text-center border-t border-white/5">
        <p className="text-xs text-white/20">Agendamento online por <span className="font-semibold text-white/40">O CORTE</span></p>
      </div>

      {/* ─── BOOKING MODAL ─── */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        company={company}
        services={services}
        professionals={allProfessionals}
        existingAppointments={allAppointments}
        blockedTimes={allBlockedTimes}
        scopeCustomerByUnit={scopeCustomerByUnit}
        unitId={null}
        loggedCustomer={loggedCustomer}
        customerToken={customerToken}
        isAuthenticatedCustomer={isAuthenticatedCustomer}
        activeSubscription={activeSubscription}
        activePlan={activePlan}
        canUseSubscription={canUseSubscription}
        subscriptionBlocker={subscriptionBlocker}
        slug={slug}
        initialService={bookingService}
        onBookingDone={(result) => {
          setShowBookingModal(false);
          setBookingDone(result);
        }}
        onNeedAuth={handleNeedAuth}
      />

      {/* ─── AUTH GATE MODAL ─── */}
      <AuthGateModal
        isOpen={showAuthGate}
        companyId={company?.id}
        companyName={company?.name}
        primaryColor={primaryColor}
        onClose={() => setShowAuthGate(false)}
        onSuccess={(customerId, token) => {
          base44.functions.invoke('customerAuth', { action: 'me', company_id: company?.id, token })
            .then(res => {
              if (res?.data?.customer) {
                login(token, res.data.customer);
                const c = res.data.customer;
                setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '' });
                setIsAuthenticatedCustomer(true);
              }
            }).catch(() => {});
          setShowAuthGate(false);
          setTimeout(() => setShowBookingModal(true), 300);
        }}
      />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white/50 text-sm">{label}</span>
      <span className="text-white font-semibold text-sm truncate ml-2 max-w-[60%] text-right">{value}</span>
    </div>
  );
}