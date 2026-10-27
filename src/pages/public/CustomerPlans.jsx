import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Scissors, ArrowLeft, Check, AlertCircle, Infinity as InfinityIcon, Sun, Moon, CreditCard } from 'lucide-react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { filterCustomerPlansVisibleToCustomer } from '@/lib/planVisibility';
import CustomerPlanPayModal from '@/components/public/CustomerPlanPayModal';

export default function CustomerPlans() {
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

  const { customer, token, loading: loadingAuth } = useCustomerAuth(company?.id);

  // IMPORTANTE: cache key inclui customer.id para evitar leak entre sessões
  // (cliente A não pode ver planos privados liberados só pro cliente B).
  // Consulta isolada estritamente pelos clubes da barbearia (.eq('company_id', companyId))
  const { data: rawPlans = [] } = useQuery({
    queryKey: ['public-plans', company?.id, customer?.id || 'anon'],
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
  // Filtra: público + private onde customer.id está em allowed_customer_ids.
  // invite_only nunca aparece sem redemção prévia.
  const plans = filterCustomerPlansVisibleToCustomer(rawPlans, customer?.id);

  const { data: existingSubs = [] } = useQuery({
    queryKey: ['customer-subscriptions-self', company?.id, customer?.id],
    queryFn: () => base44.entities.CustomerSubscription.filter({ company_id: company.id, customer_id: customer.id }),
    enabled: !!company?.id && !!customer?.id,
  });
  const hasActiveOrPaused = existingSubs.some(s => ['active', 'paused'].includes(s.status));

  const [selectedPlan, setSelectedPlan] = useState(null);

  const handleSubscribe = (plan) => {
    if (!customer) {
      navigate(`/cliente/${slug}/login?next=${encodeURIComponent(`/cliente/${slug}/planos`)}`);
      return;
    }
    setSelectedPlan(plan);
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
        <p className={`text-sm ${tw.textMuted} mb-6`}>Cortes garantidos com assinatura mensal no cartão de crédito.</p>

        {hasActiveOrPaused && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            Você já possui uma assinatura ativa. <Link to={`/cliente/${slug}`} className="font-bold underline">Ver minha conta</Link>.
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
                <button
                  type="button"
                  onClick={() => handleSubscribe(p)}
                  disabled={hasActiveOrPaused}
                  className="w-full font-bold py-3 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
                >
                  <CreditCard className="w-4 h-4" style={{ color: '#FFFFFF' }} />
                  <span style={{ color: '#FFFFFF' }}>
                    {hasActiveOrPaused ? 'Você já possui um plano' : 'Assinar este plano'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        <p className={`text-[11px] ${tw.textFaint} text-center mt-6`}>
          Pagamento mensal recorrente no cartão de crédito. Cancele a qualquer momento na sua conta.
        </p>
      </div>

      <CustomerPlanPayModal
        isOpen={Boolean(selectedPlan)}
        onClose={() => setSelectedPlan(null)}
        onPaid={async () => {
          setSelectedPlan(null);
          await queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-self'] });
          await queryClient.invalidateQueries({ queryKey: ['public-customer-subscriptions'] });
          navigate(`/cliente/${slug}`);
        }}
        companyId={company.id}
        token={token}
        plan={selectedPlan}
        primaryColor={primaryColor}
        customer={customer}
      />
    </div>
  );
}