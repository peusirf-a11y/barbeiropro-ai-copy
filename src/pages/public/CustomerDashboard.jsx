import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Scissors, Calendar, CreditCard, LogOut, ChevronRight, AlertCircle, Pause, Play, X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

export default function CustomerDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading: loadingCo } = useQuery({
    queryKey: ['company-by-slug', slug],
    queryFn: () => base44.entities.Company.filter({ slug }),
    enabled: !!slug,
  });
  const company = companies[0];
  const primaryColor = company?.primary_color || '#2563EB';

  const { customer, token, loading: loadingAuth, logout } = useCustomerAuth(company?.id);

  // Redireciona para login se não estiver autenticado
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
      action,
      company_id: company.id,
      token,
      subscription_id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-self'] });
    },
    onError: (err) => alert(err?.response?.data?.error || err?.message || 'Erro ao executar ação'),
  });

  if (loadingCo || loadingAuth || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F3]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F3] p-6">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Barbearia não encontrada</p>
        </div>
      </div>
    );
  }

  const upcomingAppts = appointments.filter(a =>
    new Date(a.scheduled_at) >= new Date() && !['cancelado', 'faltou'].includes(a.status),
  );
  const pastAppts = appointments.filter(a =>
    new Date(a.scheduled_at) < new Date() || ['cancelado', 'faltou', 'concluido'].includes(a.status),
  ).slice(0, 5);

  const activeSub = subscriptions.find(s => s.status === 'active');
  const pendingSub = subscriptions.find(s => s.status === 'pending_payment');

  return (
    <div className="min-h-screen bg-[#F8F7F3]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor }}>
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-[#1B1C1E] truncate">{company.name}</div>
              <div className="text-xs text-gray-400 truncate">Olá, {customer.name?.split(' ')[0]}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate(`/agendar/${slug}`); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {/* Quick action: novo agendamento */}
        <Link to={`/agendar/${slug}`}
          className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-black/8 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[#1B1C1E]">Agendar novo horário</div>
              <div className="text-xs text-gray-500">Escolha serviço, profissional e data</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </Link>

        {/* Plano ativo / pendente / CTA */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Meu plano</h2>
          {activeSub ? (
            <SubscriptionCard sub={activeSub} primaryColor={primaryColor}
              onPause={() => subActionMutation.mutate({ action: 'pause', subscription_id: activeSub.id })}
              onCancel={() => {
                if (confirm('Tem certeza que deseja cancelar sua assinatura?')) {
                  subActionMutation.mutate({ action: 'cancel', subscription_id: activeSub.id });
                }
              }}
              isPending={subActionMutation.isPending} />
          ) : pendingSub ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-1">
                <AlertCircle className="w-4 h-4" />
                Aguardando confirmação de pagamento
              </div>
              <div className="text-xs text-amber-800 mb-2">{pendingSub.plan_name_snapshot} — R${pendingSub.plan_price_snapshot}/mês</div>
              <p className="text-xs text-amber-700">A barbearia confirmará seu plano assim que receber o pagamento.</p>
            </div>
          ) : subscriptions.find(s => s.status === 'paused') ? (
            <PausedCard sub={subscriptions.find(s => s.status === 'paused')}
              onResume={(id) => subActionMutation.mutate({ action: 'resume', subscription_id: id })}
              isPending={subActionMutation.isPending} />
          ) : (
            <Link to={`/cliente/${slug}/planos`}
              className="block bg-white rounded-2xl border border-dashed border-black/15 p-5 text-center hover:border-[#2563EB] hover:bg-[#2563EB]/5 transition-all">
              <CreditCard className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <div className="font-bold text-[#1B1C1E] text-sm">Conheça nossos planos</div>
              <div className="text-xs text-gray-500 mt-0.5">Cortes garantidos por uma mensalidade fixa</div>
            </Link>
          )}
        </section>

        {/* Próximos agendamentos */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Próximos agendamentos</h2>
          {upcomingAppts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/8 p-6 text-center text-sm text-gray-500">
              Nenhum horário marcado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAppts.map(a => <AppointmentCard key={a.id} appt={a} primaryColor={primaryColor} />)}
            </div>
          )}
        </section>

        {/* Histórico */}
        {pastAppts.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Histórico</h2>
            <div className="space-y-2">
              {pastAppts.map(a => <AppointmentCard key={a.id} appt={a} primaryColor={primaryColor} muted />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SubscriptionCard({ sub, primaryColor, onPause, onCancel, isPending }) {
  const cycleEnd = sub.current_cycle_end ? new Date(sub.current_cycle_end) : null;
  const isUnlimited = sub.plan_type_snapshot === 'unlimited';
  return (
    <div className="bg-white rounded-2xl border border-black/8 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: primaryColor }}>Plano ativo</div>
          <div className="font-black text-lg text-[#1B1C1E] mt-1">{sub.plan_name_snapshot}</div>
          <div className="text-xs text-gray-500">R${sub.plan_price_snapshot}/mês</div>
        </div>
        <div className="text-right">
          {isUnlimited ? (
            <div className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-[#2563EB]">Ilimitado</div>
          ) : (
            <>
              <div className="text-2xl font-black" style={{ color: primaryColor }}>{sub.uses_remaining ?? 0}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">restantes</div>
            </>
          )}
        </div>
      </div>
      {cycleEnd && (
        <div className="text-xs text-gray-500 border-t border-black/5 pt-3">
          Renova em {format(cycleEnd, "d 'de' MMM", { locale: ptBR })}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button onClick={onPause} disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg disabled:opacity-50">
          <Pause className="w-3.5 h-3.5" /> Pausar
        </button>
        <button onClick={onCancel} disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg disabled:opacity-50">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}

function PausedCard({ sub, onResume, isPending }) {
  return (
    <div className="bg-white rounded-2xl border border-black/8 p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Plano pausado</div>
      <div className="font-bold text-[#1B1C1E] mt-1">{sub.plan_name_snapshot}</div>
      <button onClick={() => onResume(sub.id)} disabled={isPending}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg disabled:opacity-50">
        <Play className="w-3.5 h-3.5" /> Retomar plano
      </button>
    </div>
  );
}

function AppointmentCard({ appt, primaryColor, muted }) {
  const date = new Date(appt.scheduled_at);
  const statusLabel = {
    agendado: 'Agendado', confirmado: 'Confirmado', em_atendimento: 'Em atendimento',
    concluido: 'Concluído', cancelado: 'Cancelado', faltou: 'Não compareceu',
  }[appt.status] || appt.status;
  return (
    <div className={`bg-white rounded-2xl border border-black/8 p-4 flex items-center gap-4 ${muted ? 'opacity-70' : ''}`}>
      <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: primaryColor }}>
        <span className="text-[10px] uppercase tracking-wide opacity-80">{format(date, 'MMM', { locale: ptBR })}</span>
        <span className="text-lg font-black leading-none">{format(date, 'd')}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-[#1B1C1E] truncate">{appt.service_name || 'Serviço'}</div>
        <div className="text-xs text-gray-500 truncate">
          {format(date, "HH:mm")} · {appt.professional_name || 'Profissional'}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{statusLabel}</div>
        {appt.payment_method === 'subscription' && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-[#2563EB]">PLANO</span>
        )}
      </div>
    </div>
  );
}