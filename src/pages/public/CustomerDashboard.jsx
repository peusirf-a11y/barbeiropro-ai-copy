import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Scissors, CreditCard, LogOut, ChevronRight, AlertCircle, Pause, Play, X, Plus, Shield, Sun, Moon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import CustomerConsentSection from '@/components/public/CustomerConsentSection';
import CustomerPlanPayModal from '@/components/public/CustomerPlanPayModal';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { resolvePlanAllowedWeekdays, formatAllowedWeekdaysError } from '@/lib/businessHours';

export default function CustomerDashboard() {
  const params = useParams();
  const slug = params.slug || localStorage.getItem('bt_last_slug') || 'teste';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark, toggle, tw } = usePublicTheme();

  useEffect(() => {
    if (slug) {
      localStorage.setItem('bt_last_slug', slug);
    }
  }, [slug]);

  const { data: companies = [], isLoading: loadingCo } = useQuery({
    queryKey: ['company-by-slug', slug],
    queryFn: () => base44.entities.Company.filter({ slug }),
    enabled: !!slug,
  });
  const dbCompany = companies[0];

  const mockCompany = {
    id: 'mock-company-id',
    name: slug ? `Barbearia ${slug.charAt(0).toUpperCase() + slug.slice(1)}` : 'Barbearia Modelo',
    slug: slug || 'teste',
    phone: '(11) 99999-9999',
    whatsapp: '11999999999',
    address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    primary_color: '#2563EB',
    asaas_pix_enabled: true,
  };

  const company = dbCompany || mockCompany;
  const primaryColor = company?.primary_color || '#2563EB';

  const { customer, token, loading: loadingAuth, logout } = useCustomerAuth(company?.id);

  // Safety timeout: garante que o carregamento termina em no máximo 2 segundos para evitar spinner infinito
  const [forceLoad, setForceLoad] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceLoad(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const isReady = (loadingCo === false && loadingAuth === false) || forceLoad;

  // Fallback para perfil de demonstração em preview se não houver cliente logado
  const activeCustomer = customer || {
    id: 'mock-customer-id',
    name: 'Cliente Teste',
    email: 'cliente@teste.com',
    phone: '(11) 98888-7777',
  };
  const isMockCustomer = activeCustomer.id === 'mock-customer-id';

  const { data: appointments = [] } = useQuery({
    queryKey: ['customer-appointments', company?.id, activeCustomer?.id],
    queryFn: async () => {
      if (isMockCustomer) {
        return [
          {
            id: 'mock-appt-1',
            service_name: 'Corte Clássico & Degradê',
            professional_name: 'Carlos Barbeiro',
            scheduled_at: new Date(Date.now() + 86400000).toISOString(),
            status: 'agendado',
            price: 50,
          },
        ];
      }
      const allForCompany = await base44.entities.Appointment.filter(
        { company_id: company?.id },
        '-scheduled_at',
        100
      );
      let savedApptIds = [];
      try {
        savedApptIds = JSON.parse(localStorage.getItem(`bt_my_appointments_${company?.id}`) || '[]');
      } catch (_) {}

      const custEmail = String(activeCustomer?.email || '').trim().toLowerCase();
      const custPhone = String(activeCustomer?.phone || '').replace(/\D/g, '');

      const matched = allForCompany.filter((a) => {
        if (a.customer_id && a.customer_id === activeCustomer.id) return true;
        if (savedApptIds.includes(a.id)) return true;
        if (custEmail && String(a.customer_email || '').trim().toLowerCase() === custEmail) return true;
        if (custPhone && custPhone.length >= 10 && String(a.customer_phone || '').replace(/\D/g, '') === custPhone) return true;
        if (!a.customer_id && (a.asaas_payment_id || a.payment_id)) return true;
        return false;
      });

      // Vincula automaticamente agendamentos pagos que ainda estavam sem customer_id
      for (const appt of matched) {
        if (!appt.customer_id && activeCustomer?.id && activeCustomer.id !== 'mock-customer-id') {
          base44.entities.Appointment.update(appt.id, {
            customer_id: activeCustomer.id,
            customer_name: activeCustomer.name || appt.customer_name || 'Cliente',
            customer_phone: activeCustomer.phone || appt.customer_phone || '',
            customer_email: activeCustomer.email || appt.customer_email || null,
          }).catch(() => {});
        }
      }

      return matched;
    },
    enabled: !!company?.id && !!activeCustomer?.id,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['customer-subscriptions-self', company?.id, activeCustomer?.id],
    queryFn: () => isMockCustomer ? Promise.resolve([
      {
        id: 'mock-sub-1',
        status: 'active',
        plan_name: 'Plano Mensal Ilimitado',
        plan_type_snapshot: 'unlimited',
        uses_remaining: 2,
        current_cycle_end: new Date(Date.now() + 2592000000).toISOString(),
      }
    ]) : base44.entities.CustomerSubscription.filter(
      { company_id: company?.id, customer_id: activeCustomer.id }, '-created_date', 20,
    ),
    enabled: !!company?.id && !!activeCustomer?.id,
  });

  const subActionMutation = useMutation({
    mutationFn: ({ action, subscription_id }) => base44.functions.invoke('customerSubscriptionAction', {
      action, company_id: company?.id, token, subscription_id,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-self'] }),
    onError: (err) => alert(err?.response?.data?.error || err?.message || 'Erro ao executar ação'),
  });

  const [payModalOpen, setPayModalOpen] = useState(false);

  if (!isReady) {
    return (
      <div className={`min-h-screen ${tw.bg} flex items-center justify-center`}>
        <div className="w-8 h-8 border-4 border-white/10 border-t-white/50 rounded-full animate-spin" />
      </div>
    );
  }

  const upcomingAppts = appointments.filter(a =>
    new Date(a.scheduled_at) >= new Date() && !['cancelado', 'faltou'].includes(a.status),
  );
  const pastAppts = appointments.filter(a =>
    new Date(a.scheduled_at) < new Date() || ['cancelado', 'faltou', 'concluido'].includes(a.status),
  ).slice(0, 10);

  const activeSub = subscriptions.find(s => s.status === 'active');
  const pendingSub = subscriptions.find(s => s.status === 'pending_payment');
  const pausedSub = subscriptions.find(s => s.status === 'paused');

  return (
    <div className={`min-h-screen ${tw.bg}`}>
      {/* Header */}
      <header className={`${tw.header} border-b px-5 py-4 sticky top-0 z-10`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor }}>
              <Scissors className="w-4 h-4" style={{ color: '#FFFFFF' }} />
            </div>
            <div className="min-w-0">
              <div className={`font-bold text-sm ${tw.text} truncate`}>{company.name}</div>
              <div className={`text-xs ${tw.textMuted} truncate`}>Olá, {activeCustomer.name?.split(' ')[0]}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/agendar/${slug}`}
              className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm"
              style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
            >
              Voltar para agendamento
            </Link>
            <button onClick={toggle}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${tw.logoutBtn}`}
              title={isDark ? 'Tema claro' : 'Tema escuro'}>
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => { logout(); navigate(`/agendar/${slug}`); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${tw.logoutBtn}`}
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-6">

        {/* Quick action: novo agendamento */}
        <Link to={`/agendar/${slug}`}
          className={`flex items-center justify-between gap-4 ${tw.card} rounded-2xl p-4 ${tw.cardHover} transition-all`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor }}>
              <Plus className="w-5 h-5" style={{ color: '#FFFFFF' }} />
            </div>
            <div>
              <div className={`font-bold ${tw.text}`}>Agendar novo horário</div>
              <div className={`text-xs ${tw.textMuted}`}>Escolha serviço, profissional e data</div>
            </div>
          </div>
          <ChevronRight className={`w-5 h-5 ${tw.textFaint}`} />
        </Link>

        {/* Plano */}
        <section>
          <h2 className={`text-[11px] font-bold uppercase tracking-widest ${tw.sectionLabel} mb-3`}>Meu Plano</h2>
          {activeSub ? (
            <SubscriptionCard sub={activeSub} primaryColor={primaryColor} tw={tw}
              onPause={() => subActionMutation.mutate({ action: 'pause', subscription_id: activeSub.id })}
              onCancel={() => { if (confirm('Tem certeza que deseja cancelar sua assinatura?')) subActionMutation.mutate({ action: 'cancel', subscription_id: activeSub.id }); }}
              isPending={subActionMutation.isPending}
            />
          ) : pausedSub ? (
            <PausedCard sub={pausedSub} primaryColor={primaryColor} tw={tw}
              onResume={(id) => subActionMutation.mutate({ action: 'resume', subscription_id: id })}
              isPending={subActionMutation.isPending}
            />
          ) : (
            <Link to={`/cliente/${slug}/planos`}
              className={`flex items-center justify-between gap-3 ${tw.card} border-dashed! rounded-2xl p-4 ${tw.cardHover} transition-all`}
              style={{ borderStyle: 'dashed' }}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${tw.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <CreditCard className={`w-5 h-5 ${tw.iconText}`} />
                </div>
                <div>
                  <div className={`font-bold ${tw.text} text-sm`}>Conheça nossos planos</div>
                  <div className={`text-xs ${tw.textMuted}`}>Cortes garantidos por mensalidade</div>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 ${tw.textFaint}`} />
            </Link>
          )}
        </section>

        {/* Próximos agendamentos */}
        <section>
          <h2 className={`text-[11px] font-bold uppercase tracking-widest ${tw.sectionLabel} mb-3`}>Próximos Agendamentos</h2>
          {upcomingAppts.length === 0 ? (
            <div className={`${tw.card} rounded-2xl p-6 text-center text-sm ${tw.textMuted}`}>
              Nenhum horário marcado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAppts.map(a => <AppointmentCard key={a.id} appt={a} primaryColor={primaryColor} tw={tw} />)}
            </div>
          )}
        </section>

        {/* Histórico */}
        {pastAppts.length > 0 && (
          <section>
            <h2 className={`text-[11px] font-bold uppercase tracking-widest ${tw.sectionLabel} mb-3`}>Histórico</h2>
            <div className="space-y-2">
              {pastAppts.map(a => <AppointmentCard key={a.id} appt={a} primaryColor={primaryColor} tw={tw} muted />)}
            </div>
          </section>
        )}

        {/* Privacidade */}
        <section>
          <h2 className={`text-[11px] font-bold uppercase tracking-widest ${tw.sectionLabel} mb-3 flex items-center gap-1.5`}>
            <Shield className="w-3 h-3" /> Privacidade {'&'} Comunicações
          </h2>
          <div className={`${tw.card} rounded-2xl p-4`}>
            <CustomerConsentSection companyId={company.id} customerId={activeCustomer.id} token={token} isDark={isDark} tw={tw} />
          </div>
        </section>

        <div className="pb-4" />
      </div>

      <CustomerPlanPayModal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        onPaid={() => {
          setPayModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-self'] });
        }}
        companyId={company.id}
        token={token}
        subscription={pendingSub}
        primaryColor={primaryColor}
        customer={activeCustomer}
      />
    </div>
  );
}

function SubscriptionCard({ sub, primaryColor, tw, onPause, onCancel, isPending }) {
  const periodEndRaw = sub.current_period_end || sub.current_cycle_end;
  const cycleEnd = periodEndRaw ? new Date(periodEndRaw) : null;
  const isUnlimited = !sub.plan_type_snapshot || sub.plan_type_snapshot === 'unlimited';
  const planName = sub.plan_name || sub.plan_name_snapshot || 'Plano Ativo';
  const planPrice = sub.plan_price_snapshot ?? sub.price;
  const allowedDays = resolvePlanAllowedWeekdays(null, sub);
  return (
    <div className={`${tw.card} rounded-2xl p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: primaryColor }}>Plano ativo</div>
          <div className={`font-black text-lg ${tw.text}`}>{planName}</div>
          {planPrice !== undefined && planPrice !== null && (
            <div className={`text-xs ${tw.textMuted}`}>R${planPrice}/mês</div>
          )}
          {sub.card_last_digits && (
            <div className={`text-[11px] ${tw.textMuted} mt-1 flex items-center gap-1.5`}>
              <CreditCard className="w-3.5 h-3.5" />
              <span>{sub.card_brand ? `${sub.card_brand} ` : ''}•••• {sub.card_last_digits}</span>
            </div>
          )}
          {allowedDays && allowedDays.length > 0 && allowedDays.length < 7 && (
            <div className="text-[11px] text-amber-400 font-medium mt-1.5">
              {formatAllowedWeekdaysError(allowedDays)}
            </div>
          )}
        </div>
        <div className="text-right">
          {isUnlimited ? (
            <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${tw.iconBg} ${tw.textMuted}`}>Ilimitado</div>
          ) : (
            <>
              <div className={`text-3xl font-black ${tw.text}`}>{sub.uses_remaining ?? 0}</div>
              <div className={`text-[10px] ${tw.textMuted} uppercase tracking-wide`}>restantes</div>
            </>
          )}
        </div>
      </div>
      {cycleEnd && !Number.isNaN(cycleEnd.getTime()) && (
        <div className={`text-xs ${tw.textFaint} border-t ${tw.divider} pt-3 mb-3`}>
          Renova em {format(cycleEnd, "d 'de' MMM", { locale: ptBR })}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onPause} disabled={isPending}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold ${tw.textMuted} ${tw.iconBg} hover:opacity-80 border ${tw.divider} px-3 py-2.5 rounded-xl disabled:opacity-50 transition-all`}>
          <Pause className="w-3.5 h-3.5" /> Pausar
        </button>
        <button onClick={onCancel} disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-2.5 rounded-xl disabled:opacity-50 transition-all">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}

function PausedCard({ sub, onResume, isPending, primaryColor, tw }) {
  return (
    <div className={`${tw.card} rounded-2xl p-5`}>
      <div className={`text-[11px] font-bold uppercase tracking-widest ${tw.sectionLabel} mb-1`}>Plano pausado</div>
      <div className={`font-bold ${tw.text}`}>{sub.plan_name || sub.plan_name_snapshot || 'Plano'}</div>
      <button onClick={() => onResume(sub.id)} disabled={isPending}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl disabled:opacity-50 transition-all"
        style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}>
        <Play className="w-3.5 h-3.5" style={{ color: '#FFFFFF' }} /> <span style={{ color: '#FFFFFF' }}>Retomar plano</span>
      </button>
    </div>
  );
}

function AppointmentCard({ appt, primaryColor, tw, muted }) {
  const date = new Date(appt.scheduled_at);
  const statusLabel = {
    agendado: 'Agendado', confirmado: 'Confirmado', confirmed: 'Confirmado', em_atendimento: 'Em atendimento',
    concluido: 'Concluído', cancelado: 'Cancelado', faltou: 'Não compareceu',
    aguardando_pagamento: 'Aguardando pagamento',
  }[appt.status] || appt.status;

  const statusColor = {
    agendado: 'text-blue-400', confirmado: 'text-emerald-400', confirmed: 'text-emerald-400', concluido: tw.textFaint,
    cancelado: 'text-red-400', faltou: 'text-red-400', em_atendimento: 'text-amber-400',
    aguardando_pagamento: 'text-amber-400',
  }[appt.status] || tw.textFaint;

  const isPaidOnline =
    appt.paid_online ||
    appt.paid ||
    appt.payment_status === 'confirmed' ||
    appt.payment_status === 'confirmed_card' ||
    Boolean(appt.asaas_payment_id);

  const isCardPayment =
    appt.payment_status === 'confirmed_card' ||
    appt.payment_status === 'paid_card' ||
    appt.payment_method === 'credit_card' ||
    appt.payment_method === 'card' ||
    appt.payment_method === 'CREDIT_CARD';

  return (
    <div className={`flex items-center gap-4 ${tw.card} rounded-2xl p-4 transition-all ${muted ? 'opacity-50' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${tw.iconBg}`}>
        <span className={`text-[10px] uppercase tracking-wide ${tw.textMuted}`}>{format(date, 'MMM', { locale: ptBR })}</span>
        <span className={`text-lg font-black ${tw.text} leading-none`}>{format(date, 'd')}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm ${tw.text} truncate`}>{appt.service_name || 'Serviço'}</div>
        <div className={`text-xs ${tw.textMuted} truncate`}>
          {format(date, "HH:mm")} · {appt.professional_name || 'Profissional'}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className={`text-[10px] uppercase tracking-wide font-semibold ${statusColor}`}>{statusLabel}</div>
        {isPaidOnline && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-1 inline-block">
            {isCardPayment ? 'PAGO CARTÃO' : 'PAGO PIX'}
          </span>
        )}
        {appt.payment_method === 'subscription' && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tw.iconBg} ${tw.textMuted} mt-1 block`}>PLANO</span>
        )}
      </div>
    </div>
  );
}