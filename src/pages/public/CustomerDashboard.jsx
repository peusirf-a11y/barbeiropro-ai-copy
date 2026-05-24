import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Scissors, CreditCard, LogOut, ChevronRight, AlertCircle, Pause, Play, X, Plus, Shield, Sun, Moon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import CustomerConsentSection from '@/components/public/CustomerConsentSection';
import { usePublicTheme } from '@/hooks/usePublicTheme';

export default function CustomerDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark, toggle, tw } = usePublicTheme();

  const { data: companies = [], isLoading: loadingCo } = useQuery({
    queryKey: ['company-by-slug', slug],
    queryFn: () => base44.entities.Company.filter({ slug }),
    enabled: !!slug,
  });
  const company = companies[0];
  const primaryColor = company?.primary_color || '#2563EB';

  const { customer, token, loading: loadingAuth, logout } = useCustomerAuth(company?.id);

  useEffect(() => {
    if (!loadingCo && !loadingAuth && company && !customer) {
      navigate(`/cliente/${slug}/login`, { replace: true });
    }
  }, [loadingCo, loadingAuth, company, customer, navigate, slug]);

  const { data: appointments = [] } = useQuery({
    queryKey: ['customer-appointments', company?.id, customer?.id],
    queryFn: () => base44.entities.Appointment.filter(
      { company_id: company.id, customer_id: customer.id }, '-scheduled_at', 50,
    ),
    enabled: !!company?.id && !!customer?.id,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['customer-subscriptions-self', company?.id, customer?.id],
    queryFn: () => base44.entities.CustomerSubscription.filter(
      { company_id: company.id, customer_id: customer.id }, '-created_date', 20,
    ),
    enabled: !!company?.id && !!customer?.id,
  });

  const subActionMutation = useMutation({
    mutationFn: ({ action, subscription_id }) => base44.functions.invoke('customerSubscriptionAction', {
      action, company_id: company.id, token, subscription_id,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-self'] }),
    onError: (err) => alert(err?.response?.data?.error || err?.message || 'Erro ao executar ação'),
  });

  // Retoma o checkout de uma assinatura pending_payment existente (não cria nova).
  // Asaas exige CPF/CNPJ — pedimos via prompt antes de chamar a função.
  const resumeCheckoutMutation = useMutation({
    mutationFn: ({ plan_id, subscription_id }) => {
      const raw = window.prompt('Para finalizar o pagamento, informe seu CPF (apenas números):');
      const cpf = String(raw || '').replace(/\D+/g, '');
      if (cpf.length !== 11 && cpf.length !== 14) {
        return Promise.reject(new Error('CPF inválido. Tente novamente.'));
      }
      return base44.functions.invoke('createAsaasCustomerPlanCheckout', {
        company_id: company.id, token, plan_id, subscription_id, customer_cpf: cpf,
      });
    },
    onSuccess: (res) => {
      const url = res?.data?.invoice_url || res?.data?.url;
      if (url) { window.location.href = url; }
      else { alert('Não foi possível abrir o checkout.'); }
    },
    onError: (err) => alert(err?.response?.data?.error || err?.message || 'Erro ao abrir o checkout'),
  });

  if (loadingCo || loadingAuth || !customer) {
    return (
      <div className={`min-h-screen ${tw.bg} flex items-center justify-center`}>
        <div className="w-8 h-8 border-4 border-white/10 border-t-white/50 rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className={`min-h-screen ${tw.bg} flex items-center justify-center p-6`}>
        <div className="text-center">
          <AlertCircle className={`w-10 h-10 ${tw.textFaint} mx-auto mb-3`} />
          <p className={`font-semibold ${tw.text}`}>Barbearia não encontrada</p>
        </div>
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
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className={`font-bold text-sm ${tw.text} truncate`}>{company.name}</div>
              <div className={`text-xs ${tw.textMuted} truncate`}>Olá, {customer.name?.split(' ')[0]}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${tw.logoutBtn}`}
              title={isDark ? 'Tema claro' : 'Tema escuro'}>
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => { logout(); navigate(`/agendar/${slug}`); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${tw.logoutBtn}`}
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
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: primaryColor }}>
              <Plus className="w-5 h-5" />
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
          ) : pendingSub ? (
            <button
              type="button"
              disabled={resumeCheckoutMutation.isPending}
              onClick={() => resumeCheckoutMutation.mutate({ plan_id: pendingSub.plan_id, subscription_id: pendingSub.id })}
              className="w-full text-left block bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 hover:bg-amber-500/15 transition-colors disabled:opacity-60 disabled:cursor-wait">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-1">
                <AlertCircle className="w-4 h-4" />
                {resumeCheckoutMutation.isPending ? 'Abrindo pagamento...' : 'Finalize o pagamento do seu plano'}
              </div>
              <p className="text-xs text-amber-400/70">{pendingSub.plan_name_snapshot} — R${pendingSub.plan_price_snapshot}/mês · Toque para pagar agora</p>
            </button>
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
            <CustomerConsentSection companyId={company.id} customerId={customer.id} token={token} isDark={isDark} tw={tw} />
          </div>
        </section>

        <div className="pb-4" />
      </div>
    </div>
  );
}

function SubscriptionCard({ sub, primaryColor, tw, onPause, onCancel, isPending }) {
  const cycleEnd = sub.current_cycle_end ? new Date(sub.current_cycle_end) : null;
  const isUnlimited = sub.plan_type_snapshot === 'unlimited';
  return (
    <div className={`${tw.card} rounded-2xl p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: primaryColor }}>Plano ativo</div>
          <div className={`font-black text-lg ${tw.text}`}>{sub.plan_name_snapshot}</div>
          <div className={`text-xs ${tw.textMuted}`}>R${sub.plan_price_snapshot}/mês</div>
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
      {cycleEnd && (
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
      <div className={`font-bold ${tw.text}`}>{sub.plan_name_snapshot}</div>
      <button onClick={() => onResume(sub.id)} disabled={isPending}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white py-2.5 rounded-xl disabled:opacity-50 transition-all"
        style={{ backgroundColor: primaryColor }}>
        <Play className="w-3.5 h-3.5" /> Retomar plano
      </button>
    </div>
  );
}

function AppointmentCard({ appt, primaryColor, tw, muted }) {
  const date = new Date(appt.scheduled_at);
  const statusLabel = {
    agendado: 'Agendado', confirmado: 'Confirmado', em_atendimento: 'Em atendimento',
    concluido: 'Concluído', cancelado: 'Cancelado', faltou: 'Não compareceu',
    aguardando_pagamento: 'Aguardando pagamento',
  }[appt.status] || appt.status;

  const statusColor = {
    agendado: 'text-blue-400', confirmado: 'text-emerald-400', concluido: tw.textFaint,
    cancelado: 'text-red-400', faltou: 'text-red-400', em_atendimento: 'text-amber-400',
    aguardando_pagamento: 'text-amber-400',
  }[appt.status] || tw.textFaint;

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
        {appt.payment_method === 'subscription' && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tw.iconBg} ${tw.textMuted} mt-1 block`}>PLANO</span>
        )}
      </div>
    </div>
  );
}