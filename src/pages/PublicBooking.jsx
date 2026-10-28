import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Scissors, Clock, User, AlertCircle, UserCircle2, Star, Check, Sun, Moon, Calendar } from 'lucide-react';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { nextDaysRange, dateRangeFilter } from '@/lib/dateRangeQueries';
import BookingModal from '@/components/booking/BookingModal';
import AuthGateModal from '@/components/public/AuthGateModal';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useBookingSession } from '@/contexts/BookingSessionContext';
import { normalizeBusinessHours } from '@/lib/businessHours';
import { sanitizeHexColor, getThemeAccent } from '@/lib/colorUtils';

import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export default function PublicBooking() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const { isDark, toggle, tw } = usePublicTheme();
  const [activeTab, setActiveTab] = useState('servicos');
  const [bookingService, setBookingService] = useState(null); // serviço que abre o modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [bookingDone, setBookingDone] = useState(null);
  const { updateBooking } = useBookingSession();

  useEffect(() => {
    if (slug) {
      localStorage.setItem('bt_last_slug', slug);
    }
  }, [slug]);

  // Proteção Multi-Tenant: seleciona estritamente campos públicos da barbearia (NUNCA SELECT * nem asaas_api_key)
  const { data: companies = [], isLoading: loadingCompany } = useQuery({
    queryKey: ['company-by-slug', slug],
    queryFn: async () => {
      if (isSupabaseConfigured && supabase) {
        const { data: publicRow, error: publicErr } = await supabase
          .from('companies')
          .select('id, name, slug, logo_url, phone, whatsapp, address, primary_color, business_hours')
          .eq('slug', slug)
          .maybeSingle();

        if (!publicErr && publicRow) {
          return [publicRow];
        }

        const { data: colorRow, error: colorErr } = await supabase
          .from('companies')
          .select('id, name, slug, logo_url, phone, primary_color, business_hours')
          .eq('slug', slug)
          .maybeSingle();

        if (!colorErr && colorRow) {
          return [colorRow];
        }

        const { data: strictRow } = await supabase
          .from('companies')
          .select('id, name, slug, logo_url, phone, business_hours')
          .eq('slug', slug)
          .maybeSingle();

        if (strictRow) {
          return [strictRow];
        }
      }
      return base44.entities.Company.filter({ slug });
    },
    enabled: !!slug,
  });
  const rawCompany = companies[0] || null;
  const company = rawCompany
    ? (() => {
        let localMatch = null;
        try {
          const localList = JSON.parse(localStorage.getItem('barberpass_local_companies') || '[]');
          localMatch = localList.find(
            c => (rawCompany.id && c.id === rawCompany.id) || (rawCompany.slug && c.slug === rawCompany.slug)
          );
        } catch (_) {}
        const brandingMeta = rawCompany.business_hours?._branding || localMatch?.business_hours?._branding || {};
        const resolvedColor = sanitizeHexColor(
          rawCompany.primary_color || brandingMeta.primary_color || localMatch?.primary_color,
          '#2563EB'
        );
        return {
          ...rawCompany,
          primary_color: resolvedColor,
          whatsapp: rawCompany.whatsapp || brandingMeta.whatsapp || localMatch?.whatsapp || '',
          address: rawCompany.address || brandingMeta.address || localMatch?.address || '',
          logo_url: rawCompany.logo_url || brandingMeta.logo_url || localMatch?.logo_url || '',
          business_hours: normalizeBusinessHours(rawCompany),
        };
      })()
    : null;
  const primaryColor = sanitizeHexColor(company?.primary_color, '#2563EB');
  const accent = getThemeAccent(primaryColor, isDark);

  // Modelo A: A barbearia aceita pagamentos online (validação da chave ocorre exclusivamente no backend)
  const loadingConnect = false;
  const canAcceptPayments = company?.asaas_pix_enabled !== false;

  const { customer: loggedCustomer, token: customerToken, loading: loadingCustomerAuth, logout: logoutCustomer, login } = useCustomerAuth(company?.id);
  const [isAuthenticatedCustomer, setIsAuthenticatedCustomer] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    if (!loggedCustomer || loadingCustomerAuth || isAuthenticatedCustomer) return;
    setForm({ name: loggedCustomer.name || '', phone: loggedCustomer.phone || '', email: loggedCustomer.email || '' });
    setIsAuthenticatedCustomer(true);
  }, [loggedCustomer, loadingCustomerAuth]);  

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
    queryFn: async () => {
      const list = await base44.entities.Service.filter({ company_id: company.id });
      return list
        .filter(s => (s.is_active ?? s.active ?? true) !== false)
        .map(s => ({
          ...s,
          active: Boolean(s.is_active ?? s.active ?? true),
          is_active: Boolean(s.is_active ?? s.active ?? true),
          featured: Boolean(s.is_featured ?? s.featured ?? false),
          is_featured: Boolean(s.is_featured ?? s.featured ?? false),
          price: Number(s.price ?? 0),
          duration_minutes: Number(s.duration_minutes ?? 30),
        }));
    },
    enabled: !!company?.id,
  });

  const { data: activePlans = [] } = useQuery({
    queryKey: ['public-active-plans', company?.id],
    queryFn: async () => {
      const companyId = company?.id;
      if (!companyId) return [];
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .eq('company_id', companyId);

        if (!error && Array.isArray(data)) {
          return data
            .filter((p) => Boolean(p.company_id) && String(p.company_id) === String(companyId) && p.active !== false)
            .map((p) => base44.entities.CustomerPlan._normalizeRow(p));
        }
      }
      return base44.entities.CustomerPlan.filter({ company_id: companyId, active: true });
    },
    enabled: !!company?.id,
  });
  const hasActivePlans = activePlans.length > 0;

  const effectiveActivePlan =
    activePlan ||
    activePlans.find(
      p =>
        (activeSubscription?.plan_id && String(p.id) === String(activeSubscription.plan_id)) ||
        (activeSubscription &&
          String(p.name || '').trim().toLowerCase() ===
            String(activeSubscription.plan_name || activeSubscription.plan_name_snapshot || '')
              .trim()
              .toLowerCase())
    ) ||
    null;

  const { data: allProfessionals = [] } = useQuery({
    queryKey: ['public-professionals', company?.id],
    queryFn: async () => {
      const list = await base44.entities.Professional.filter({ company_id: company.id });
      return list.filter(p => (p.is_active ?? p.active ?? true) !== false);
    },
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
    const periodEnd = sub.current_period_end || sub.current_cycle_end;
    if (periodEnd && new Date(periodEnd) <= new Date()) return 'Sua assinatura está com o ciclo vencido.';
    if (sub.plan_type_snapshot && sub.plan_type_snapshot !== 'unlimited' && (sub.uses_remaining ?? 1) <= 0) return 'Você já usou todos os seus cortes deste mês.';
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
      <div className={`min-h-screen ${tw.bg} flex items-center justify-center`}>
        <div className="w-8 h-8 border-4 border-white/10 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className={`min-h-screen ${tw.bg} flex items-center justify-center p-6`}>
        <div className="text-center">
          <AlertCircle className={`w-12 h-12 ${tw.textFaint} mx-auto mb-4`} />
          <p className={`${tw.text} font-semibold`}>Barbearia não encontrada</p>
          <p className={`${tw.textMuted} text-sm mt-1`}>Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  // ─── PAGAMENTOS NÃO CONFIGURADOS ───
  if (!loadingConnect && !canAcceptPayments) {
    return (
      <div className={`min-h-screen ${tw.bg} flex flex-col`}>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className={`${tw.card} rounded-3xl p-8 text-center max-w-sm w-full`}>
            <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className={`text-lg font-black ${tw.text} mb-2`}>Agendamento online indisponível</h2>
            <p className={`text-sm ${tw.textMuted} mb-5`}>{company.name} ainda não está aceitando pagamentos online.</p>
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
    const { selected } = bookingDone;
    return (
      <div className={`min-h-screen ${tw.bg} flex flex-col`}>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className={`${tw.card} rounded-3xl p-10 text-center max-w-sm w-full`}>
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className={`text-2xl font-black ${tw.text} mb-2`}>Agendado!</h2>
            <p className={`${tw.textMuted} text-sm mb-6`}>Seu horário foi confirmado com sucesso no sistema.</p>
            <div className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4 text-left space-y-2 mb-6`}>
              <Row label="Serviço" value={selected?.service?.name} tw={tw} />
              <Row label="Profissional" value={selected?.professional?.name} tw={tw} />
              {selected?.date && selected?.time && (
                <Row label="Data" value={`${format(selected.date, "d 'de' MMM", { locale: ptBR })} às ${selected.time}`} tw={tw} />
              )}
              <div className={`flex justify-between items-center pt-2 border-t ${tw.divider}`}>
                <span className={`${tw.textMuted} text-sm`}>Valor</span>
                <span className="text-emerald-400 font-black text-lg">R$ {selected?.service?.price?.toFixed(2)}</span>
              </div>
            </div>
            <Link
              to={`/cliente/${slug}`}
              className="block w-full text-center text-sm font-bold py-3 rounded-xl mb-3 shadow-md transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent.bg, color: accent.fg }}
            >
              <span style={{ color: accent.fg }}>Ver meus agendamentos</span>
            </Link>
            {company.whatsapp && (
              <a href={`https://wa.me/55${company.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="block w-full text-center text-white text-sm font-bold py-3 rounded-xl mb-3 bg-[#25D366]">
                Confirmar pelo WhatsApp
              </a>
            )}
            <button onClick={() => setBookingDone(null)} className={`${tw.textMuted} text-xs hover:opacity-70 underline`}>
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Agendamentos confirmados do cliente para exibição direta na tela pública
  const myConfirmedAppointments = (() => {
    let savedIds = [];
    try {
      savedIds = JSON.parse(localStorage.getItem(`bt_my_appointments_${company?.id}`) || '[]');
    } catch (_) {}
    const custEmail = String(loggedCustomer?.email || '').trim().toLowerCase();
    const custPhone = String(loggedCustomer?.phone || '').replace(/\D/g, '');

    return (allAppointments || []).filter((a) => {
      if (['cancelado', 'faltou', 'pending_payment'].includes(a.status)) return false;
      if (new Date(a.scheduled_at) < new Date(Date.now() - 2 * 60 * 60 * 1000)) return false;
      if (loggedCustomer?.id && a.customer_id === loggedCustomer.id) return true;
      if (savedIds.includes(a.id)) return true;
      if (custEmail && String(a.customer_email || '').trim().toLowerCase() === custEmail) return true;
      if (custPhone && custPhone.length >= 10 && String(a.customer_phone || '').replace(/\D/g, '') === custPhone) return true;
      return false;
    });
  })();

  const heroBg = isDark
    ? `linear-gradient(135deg, ${primaryColor}33, #0f0f1a)`
    : `linear-gradient(135deg, ${primaryColor}22, #F7F8FB)`;
  const heroOverlay = isDark ? 'to-[#0f0f1a]' : 'to-[#F7F8FB]';

  return (
    <div className={`min-h-screen ${tw.bg} ${tw.scope} flex flex-col`}>
      {/* ─── HERO / CAPA ─── */}
      <div className="relative">
        {company.logo_url ? (
          <div className="h-52 w-full overflow-hidden">
            <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
            <div className={`absolute inset-0 bg-gradient-to-b from-black/20 via-transparent ${heroOverlay}`} />
          </div>
        ) : (
          <div className="h-52 w-full" style={{ background: heroBg }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Scissors className={`w-20 h-20 ${isDark ? 'text-[#FFFFFF]/10' : 'text-black/5'}`} />
            </div>
            <div className={`absolute inset-0 bg-gradient-to-b from-transparent ${heroOverlay}`} />
          </div>
        )}

        {/* Topo direito: login + toggle tema */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center border transition-all shadow-lg"
            style={{
              backgroundColor: isDark ? 'rgba(15, 15, 26, 0.78)' : 'rgba(255, 255, 255, 0.88)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.12)',
              color: isDark ? '#FFFFFF' : '#1F2937',
            }}
            title={isDark ? 'Tema claro' : 'Tema escuro'}
          >
            {isDark ? (
              <Sun className="w-4 h-4" style={{ color: '#FBBF24' }} />
            ) : (
              <Moon className="w-4 h-4" style={{ color: '#1F2937' }} />
            )}
          </button>
          <Link
            to={loggedCustomer ? `/cliente/${slug}` : `/cliente/${slug}/login`}
            className="flex items-center gap-1.5 backdrop-blur-md text-xs font-bold px-3.5 py-2 rounded-full border transition-all shadow-lg"
            style={{
              backgroundColor: isDark ? 'rgba(15, 15, 26, 0.78)' : 'rgba(255, 255, 255, 0.88)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.12)',
              color: isDark ? '#FFFFFF' : '#1F2937',
            }}
          >
            <UserCircle2 className="w-4 h-4" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }} />
            <span style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
              {loggedCustomer ? 'Minha conta' : 'Entrar'}
            </span>
          </Link>
        </div>
      </div>

      {/* ─── INFO DA BARBEARIA ─── */}
      <div className="px-5 -mt-8 relative z-10 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-14 h-14 rounded-2xl border-2 overflow-hidden flex-shrink-0 ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'} flex items-center justify-center`}
            style={{ borderColor: accent.bg + '60' }}>
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
            ) : (
              <Scissors className="w-6 h-6" style={{ color: accent.bg }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {avgRating && (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                  <Star className="w-3 h-3 fill-amber-400" /> {avgRating}
                </span>
              )}
              <h1 className={`${tw.text} font-black text-xl truncate`}>{company.name}</h1>
            </div>
            {(company.address || company.phone) && (
              <p className={`${tw.textMuted} text-xs truncate`}>{company.address || company.phone}</p>
            )}
          </div>
        </div>

        {/* Banner de agendamentos confirmados do cliente */}
        {myConfirmedAppointments.length > 0 && (
          <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Seu horário agendado
              </span>
              <Link to={`/cliente/${slug}`} className="text-[11px] font-bold text-emerald-300 underline">
                Ver detalhes
              </Link>
            </div>
            <div className="space-y-1.5">
              {myConfirmedAppointments.slice(0, 2).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className={`${tw.text} font-semibold truncate`}>
                    {a.service_name || 'Corte'} · {a.professional_name || 'Profissional'}
                  </span>
                  <span className="text-emerald-400 font-bold ml-2 flex-shrink-0">
                    {format(new Date(a.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── TABS ─── */}
      <div className={`border-b ${tw.tabBorder} px-5 flex-shrink-0`}>
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${activeTab === t.id ? `${tw.tabActive} border-current` : `${tw.tabInactive} border-transparent`}`}
              style={{ borderColor: activeTab === t.id ? accent.bg : undefined }}
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
              <div className={`text-center py-12 ${tw.textMuted}`}>Nenhum serviço disponível</div>
            ) : (
              services.map(s => (
                <div key={s.id} className={`flex items-center gap-4 ${tw.card} rounded-2xl p-4`}>
                  <div className={`w-12 h-12 rounded-xl ${tw.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <span className={`${tw.text} font-black text-base`}>{s.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`${tw.text} font-semibold truncate`}>{s.name}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-emerald-500 font-bold text-sm">R$ {s.price.toFixed(2)}</span>
                      <span className={`${tw.textMuted} text-xs flex items-center gap-1`}>
                        <Clock className="w-3 h-3" />{s.duration_minutes} min
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => openBooking(s)}
                    className="flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl transition-opacity hover:opacity-90 shadow-sm"
                    style={{ backgroundColor: accent.bg, color: accent.fg }}
                  >
                    <span style={{ color: accent.fg }}>Agendar</span>
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
              <div className={`text-center py-12 ${tw.textMuted}`}>Nenhum profissional cadastrado</div>
            ) : (
              <>
                <div className={`flex items-center gap-4 ${tw.card} rounded-2xl p-4`}>
                  <div className={`w-12 h-12 rounded-full ${tw.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <User className={`w-5 h-5 ${tw.iconText}`} />
                  </div>
                  <div className="flex-1">
                    <div className={`${tw.text} font-semibold`}>Sem Preferência</div>
                    <div className={`${tw.textMuted} text-xs`}>Primeiro disponível</div>
                  </div>
                </div>
                {allProfessionals.map(p => (
                  <div key={p.id} className={`flex items-center gap-4 ${tw.card} rounded-2xl p-4`}>
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                        style={{ backgroundColor: accent.bg, color: accent.fg }}
                      >
                        <span style={{ color: accent.fg }}>{(p.name || '?')[0]}</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className={`${tw.text} font-semibold`}>{p.name}</div>
                      <div className={`${tw.textMuted} text-xs`}>{p.specialty || 'Sem observação'}</div>
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
              <div className={`text-center py-12 ${tw.textMuted}`}>Nenhuma avaliação ainda</div>
            ) : (
              reviews.map(r => (
                <div key={r.id} className={`${tw.card} rounded-2xl p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${tw.iconBg} flex items-center justify-center ${tw.text} font-bold text-sm flex-shrink-0`}>
                        {(r.customer_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className={`${tw.text} font-semibold text-sm`}>{r.customer_name || 'Cliente'}</div>
                        <div className={`${tw.textFaint} text-xs`}>
                          {r.submitted_at ? format(new Date(r.submitted_at), "dd/MM/yyyy HH:mm") : format(new Date(r.created_date), "dd/MM/yyyy HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < (r.rating || 0) ? 'fill-amber-400 text-amber-400' : tw.textFaint}`} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className={`${tw.textMuted} text-sm leading-relaxed`}>{r.comment}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`py-4 text-center border-t ${tw.divider}`}>
        <p className={`text-xs ${tw.textFaint}`}>Agendamento online por <span className={`font-semibold ${tw.textMuted}`}>O CORTE</span></p>
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
        activePlan={effectiveActivePlan}
        canUseSubscription={canUseSubscription}
        subscriptionBlocker={subscriptionBlocker}
        slug={slug}
        initialService={bookingService}
        hasActivePlans={hasActivePlans}
        onBookingDone={(result) => {
          setShowBookingModal(false);
          setBookingDone(result);
          queryClient.invalidateQueries({ queryKey: ['public-appointments'] });
          queryClient.invalidateQueries({ queryKey: ['customer-appointments'] });
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
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
        onSuccess={async (customerId, token) => {
          // Fase 6: aguarda hidratar `useCustomerAuth` ANTES de reabrir o BookingModal —
          // caso contrário o modal reabre sem loggedCustomer e o passo de confirmação
          // dispara o AuthGate de novo, criando loop visual.
          try {
            const res = await base44.functions.invoke('customerAuth', {
              action: 'me', company_id: company?.id, token,
            });
            if (res?.data?.customer) {
              login(token, res.data.customer);
              const c = res.data.customer;
              setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '' });
              setIsAuthenticatedCustomer(true);
            }
          } catch { /* segue mesmo assim — useCustomerAuth refaz o me() no próximo render */ }
          setShowAuthGate(false);
          setShowBookingModal(true);
        }}
      />
    </div>
  );
}

function Row({ label, value, tw }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`${tw?.textMuted || 'text-white/50'} text-sm`}>{label}</span>
      <span className={`${tw?.text || 'text-white'} font-semibold text-sm truncate ml-2 max-w-[60%] text-right`}>{value}</span>
    </div>
  );
}