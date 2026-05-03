import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Scissors, ArrowLeft, Check, AlertCircle, Infinity as InfinityIcon } from 'lucide-react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

export default function CustomerPlans() {
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

  const { customer, token, loading: loadingAuth } = useCustomerAuth(company?.id);

  const { data: plans = [] } = useQuery({
    queryKey: ['public-plans', company?.id],
    queryFn: () => base44.entities.CustomerPlan.filter({ company_id: company.id, active: true }),
    enabled: !!company?.id,
  });

  const { data: existingSubs = [] } = useQuery({
    queryKey: ['customer-subscriptions-self', company?.id, customer?.id],
    queryFn: () => base44.entities.CustomerSubscription.filter({ company_id: company.id, customer_id: customer.id }),
    enabled: !!company?.id && !!customer?.id,
  });
  const hasActiveOrPending = existingSubs.some(s => ['active', 'pending_payment', 'paused'].includes(s.status));

  const [submittingPlanId, setSubmittingPlanId] = useState(null);
  const [done, setDone] = useState(false);

  const subscribeMutation = useMutation({
    mutationFn: ({ plan_id }) => base44.functions.invoke('customerSubscriptionAction', {
      action: 'subscribe',
      company_id: company.id,
      token,
      plan_id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-self'] });
      setDone(true);
    },
    onError: (err) => {
      alert(err?.response?.data?.error || err?.message || 'Erro ao assinar o plano');
      setSubmittingPlanId(null);
    },
  });

  const handleSubscribe = (plan) => {
    if (!customer) {
      navigate(`/cliente/${slug}/login`);
      return;
    }
    setSubmittingPlanId(plan.id);
    subscribeMutation.mutate({ plan_id: plan.id });
  };

  if (loadingCo || loadingAuth) {
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

  if (done) {
    return (
      <div className="min-h-screen bg-[#F8F7F3] flex flex-col">
        <SimpleHeader company={company} primaryColor={primaryColor} slug={slug} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl border border-black/8 p-8 text-center max-w-sm shadow-lg">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-black text-[#1B1C1E] mb-2">Pedido recebido!</h2>
            <p className="text-sm text-gray-500 mb-5">
              Seu plano está aguardando confirmação de pagamento. A barbearia entrará em contato pelo WhatsApp para finalizar.
            </p>
            <button onClick={() => navigate(`/cliente/${slug}`)}
              className="w-full text-white font-bold py-3 rounded-xl text-sm hover:opacity-90"
              style={{ backgroundColor: primaryColor }}>
              Ir para minha conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F3]">
      <SimpleHeader company={company} primaryColor={primaryColor} slug={slug} />

      <div className="max-w-2xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-black text-[#1B1C1E] mb-2">Planos disponíveis</h1>
        <p className="text-sm text-gray-500 mb-6">Cortes garantidos com mensalidade fixa.</p>

        {hasActiveOrPending && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            Você já tem uma assinatura ativa ou pendente. <Link to={`/cliente/${slug}`} className="font-bold underline">Ver minha conta</Link>.
          </div>
        )}

        {plans.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/8 p-8 text-center text-gray-500 text-sm">
            Nenhum plano disponível no momento.
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-black/8 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-black text-lg text-[#1B1C1E]">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-500 mt-0.5">{p.description}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black" style={{ color: primaryColor }}>R${p.price_monthly}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">por mês</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
                  {p.type === 'unlimited' ? (
                    <>
                      <InfinityIcon className="w-4 h-4" style={{ color: primaryColor }} />
                      <span><strong>Cortes ilimitados</strong> por mês</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" style={{ color: primaryColor }} />
                      <span><strong>{p.usage_limit} cortes</strong> por mês</span>
                    </>
                  )}
                </div>
                <button onClick={() => handleSubscribe(p)} disabled={hasActiveOrPending || submittingPlanId === p.id}
                  className="w-full text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: primaryColor }}>
                  {submittingPlanId === p.id ? 'Processando...' : hasActiveOrPending ? 'Você já possui um plano' : 'Assinar este plano'}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center mt-6">
          Pagamento via PIX ou na barbearia. A confirmação é feita pelo estabelecimento.
        </p>
      </div>
    </div>
  );
}

function SimpleHeader({ company, primaryColor, slug }) {
  return (
    <header className="bg-white border-b border-black/10 px-6 py-4">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <Link to={`/cliente/${slug}`} className="p-1 -ml-1 rounded hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
          <Scissors className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-sm text-[#1B1C1E]">{company.name}</span>
      </div>
    </header>
  );
}