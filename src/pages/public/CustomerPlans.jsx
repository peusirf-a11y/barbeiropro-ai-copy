import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Scissors, ArrowLeft, Check, AlertCircle, Infinity as InfinityIcon, Sun, Moon } from 'lucide-react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { filterCustomerPlansVisibleToCustomer } from '@/lib/planVisibility';

export default function CustomerPlans() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isDark, toggle, tw } = usePublicTheme();

  const { data: companies = [], isLoading: loadingCo } = useQuery({
    queryKey: ['company-by-slug', slug],
    queryFn: () => base44.entities.Company.filter({ slug }),
    enabled: !!slug,
  });
  const company = companies[0];
  const primaryColor = company?.primary_color || '#2563EB';

  const { customer, token, loading: loadingAuth } = useCustomerAuth(company?.id);

  // IMPORTANTE: cache key inclui customer.id para evitar leak entre sessões
  // (cliente A não pode ver planos privados liberados só pro cliente B).
  const { data: rawPlans = [] } = useQuery({
    queryKey: ['public-plans', company?.id, customer?.id || 'anon'],
    queryFn: () => base44.entities.CustomerPlan.filter({ company_id: company.id, active: true }),
    enabled: !!company?.id,
  });
  // Filtra: público + private onde customer.id está em allowed_customer_ids.
  // invite_only nunca aparece sem redemção prévia.
  const plans = filterCustomerPlansVisibleToCustomer(rawPlans, customer?.id);

  const { data: existingSubs = [] } = useQuery({
    queryKey: ['customer-subscriptions-self', company?.id, customer?.id],
    queryFn: () => base44.entities.CustomerSubscription.filter({ company_id: company.id, customer_id: customer.id }),
    enabled: !!company?.id && !!customer?.id,
  });
  const hasActiveOrPending = existingSubs.some(s => ['active', 'pending_payment', 'paused'].includes(s.status));

  const [submittingPlanId, setSubmittingPlanId] = useState(null);

  const checkoutMutation = useMutation({
    mutationFn: ({ plan_id }) => base44.functions.invoke('createAsaasCustomerPlanCheckout', {
      company_id: company.id, token, plan_id,
    }),
    onSuccess: (res) => {
      const data = res?.data || {};
      const url = data.url;
      if (url) { window.location.href = url; return; }
      alert(data.message || 'Não foi possível abrir o checkout.');
      setSubmittingPlanId(null);
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Erro ao iniciar pagamento';
      alert(msg);
      setSubmittingPlanId(null);
    },
  });

  const handleSubscribe = (plan) => {
    if (!customer) { navigate(`/cliente/${slug}/login`); return; }
    setSubmittingPlanId(plan.id);
    checkoutMutation.mutate({ plan_id: plan.id });
  };

  if (loadingCo || loadingAuth) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tw.bg}`}>
        <div className="w-8 h-8 border-4 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tw.bg} p-6`}>
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
          <p className={`font-semibold ${tw.text}`}>Barbearia não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${tw.bg}`}>
      {/* Header */}
      <header className={`${tw.header} border-b px-6 py-4`}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to={`/cliente/${slug}`} className={`p-1 -ml-1 rounded hover:opacity-70 ${tw.textMuted}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
            <Scissors className="w-4 h-4" style={{ color: '#FFFFFF' }} />
          </div>
          <span className={`font-bold text-sm ${tw.text} flex-1 truncate`}>{company.name}</span>
          <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center ${tw.logoutBtn}`}>
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6">
        <h1 className={`text-2xl font-black ${tw.text} mb-2`}>Planos disponíveis</h1>
        <p className={`text-sm ${tw.textMuted} mb-6`}>Cortes garantidos com mensalidade fixa.</p>

        {hasActiveOrPending && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            Você já tem uma assinatura ativa ou pendente. <Link to={`/cliente/${slug}`} className="font-bold underline">Ver minha conta</Link>.
          </div>
        )}

        {plans.length === 0 ? (
          <div className={`${tw.card} rounded-2xl p-8 text-center text-sm ${tw.textMuted}`}>
            Nenhum plano disponível no momento.
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(p => (
              <div key={p.id} className={`${tw.card} rounded-2xl p-5`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className={`font-black text-lg ${tw.text}`}>{p.name}</div>
                    {p.description && <div className={`text-xs ${tw.textMuted} mt-0.5`}>{p.description}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black" style={{ color: primaryColor }}>R${p.price_monthly}</div>
                    <div className={`text-[10px] ${tw.textFaint} uppercase tracking-wide`}>por mês</div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-xs ${tw.textMuted} mb-4`}>
                  {p.type === 'unlimited' ? (
                    <><InfinityIcon className="w-4 h-4" style={{ color: primaryColor }} /><span><strong>Cortes ilimitados</strong> por mês</span></>
                  ) : (
                    <><Check className="w-4 h-4" style={{ color: primaryColor }} /><span><strong>{p.usage_limit} cortes</strong> por mês</span></>
                  )}
                </div>
                <button onClick={() => handleSubscribe(p)} disabled={hasActiveOrPending || submittingPlanId === p.id}
                  className="w-full font-bold py-3 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}>
                  <span style={{ color: '#FFFFFF' }}>{submittingPlanId === p.id ? 'Processando...' : hasActiveOrPending ? 'Você já possui um plano' : 'Assinar este plano'}</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <p className={`text-[11px] ${tw.textFaint} text-center mt-6`}>
          Pagamento mensal recorrente no cartão. Cancele a qualquer momento na sua conta.
        </p>
      </div>
    </div>
  );
}