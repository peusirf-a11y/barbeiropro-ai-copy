import AppLayout from '@/components/layout/AppLayout';
import AppPageHeader from '@/components/app/AppPageHeader';
import PrimaryButton from '@/components/app/PrimaryButton';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useState } from 'react';
import { Package, AlertCircle, Sparkles } from 'lucide-react';
import PlanCard from '@/components/planos/PlanCard';
import PlanFormModal from '@/components/planos/PlanFormModal';
import PlanSuggestionsModal from '@/components/planos/PlanSuggestionsModal';
import PlanImpactDashboard from '@/components/planos/PlanImpactDashboard';
import PlanConversionMetrics from '@/components/planos/PlanConversionMetrics';
import PendingSubscriptionsBanner from '@/components/planos/PendingSubscriptionsBanner';

export default function AppPlanos() {
  const { companyId, company } = useCompany();
  const isMultiUnit = !!company?.multi_unit_enabled;
  const [editingPlan, setEditingPlan] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['customer-plans', companyId],
    queryFn: () => base44.entities.CustomerPlan.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', companyId],
    queryFn: () => base44.entities.Service.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', companyId],
    queryFn: () => base44.entities.Unit.filter({ company_id: companyId, active: true }),
    enabled: !!companyId && isMultiUnit,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['customer-subscriptions', companyId],
    queryFn: () => base44.entities.CustomerSubscription.filter({ company_id: companyId, status: 'active' }),
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => editingPlan
      ? base44.entities.CustomerPlan.update(editingPlan.id, payload)
      : base44.entities.CustomerPlan.create({ ...payload, company_id: companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-plans', companyId] });
      setShowForm(false);
      setEditingPlan(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (plan) => base44.entities.CustomerPlan.update(plan.id, { active: !plan.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-plans', companyId] }),
  });

  const subscribersByPlan = subscriptions.reduce((acc, s) => {
    acc[s.plan_id] = (acc[s.plan_id] || 0) + 1;
    return acc;
  }, {});

  const totalSubscribers = subscriptions.length;
  const mrr = subscriptions.reduce((sum, s) => sum + (s.plan_price_snapshot || 0), 0);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <AppPageHeader
          title="Planos de assinatura"
          subtitle="Crie planos mensais para fidelizar seus clientes e ter receita recorrente."
          icon={Package}
        >
          <button
            onClick={() => setShowSuggestions(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#2563EB] bg-white border border-[#2563EB]/30 hover:bg-blue-50 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Gerar planos automaticamente
          </button>
          <PrimaryButton onClick={() => { setEditingPlan(null); setShowForm(true); }}>
            Novo plano
          </PrimaryButton>
        </AppPageHeader>

        {/* Banner: assinaturas pendentes de pagamento (link público) */}
        {companyId && <PendingSubscriptionsBanner companyId={companyId} companyName={company?.name} />}

        {/* Dashboard de impacto: avulso vs recorrente, MRR projetado, ocupação */}
        {companyId && (
          <PlanImpactDashboard
            companyId={companyId}
            currentMRR={subscriptions.reduce((sum, s) => sum + (s.plan_price_snapshot || 0), 0)}
            totalSubscribers={subscriptions.length}
            plansCount={plans.length}
          />
        )}

        {/* Métrica crítica: % elegíveis, % convertidos, receita potencial */}
        {companyId && plans.length > 0 && (
          <PlanConversionMetrics
            companyId={companyId}
            plans={plans}
            subscriptions={subscriptions}
          />
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <div className="text-xs text-gray-500 mb-1">Planos ativos</div>
            <div className="text-2xl font-black text-[#111827]">{plans.filter(p => p.active).length}</div>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <div className="text-xs text-gray-500 mb-1">Assinantes</div>
            <div className="text-2xl font-black text-[#111827]">{totalSubscribers}</div>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <div className="text-xs text-gray-500 mb-1">MRR (recorrente)</div>
            <div className="text-2xl font-black text-emerald-600">R${mrr.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <div className="text-xs text-gray-500 mb-1">ARR projetado</div>
            <div className="text-2xl font-black text-[#111827]">R${(mrr * 12).toFixed(0)}</div>
          </div>
        </div>

        {/* Aviso Stripe Connect (Fase 2) */}
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <strong>Cobrança recorrente automática</strong> via Stripe Connect estará disponível em breve.
            Por enquanto, você registra a cobrança manualmente no perfil de cada assinante e o sistema controla os usos automaticamente.
          </div>
        </div>

        {/* Lista de planos */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-[#111827] mb-1">Nenhum plano criado ainda</p>
            <p className="text-sm text-gray-500 mb-4">Crie seu primeiro plano e comece a fidelizar clientes.</p>
            <PrimaryButton onClick={() => { setEditingPlan(null); setShowForm(true); }}>Criar primeiro plano</PrimaryButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                subscribersCount={subscribersByPlan[plan.id] || 0}
                onEdit={(p) => { setEditingPlan(p); setShowForm(true); }}
                onToggleActive={(p) => toggleMutation.mutate(p)}
              />
            ))}
          </div>
        )}

        {showForm && (
          <PlanFormModal
            plan={editingPlan}
            services={services}
            units={units}
            isMultiUnit={isMultiUnit}
            onSave={(payload) => saveMutation.mutate(payload)}
            onClose={() => { setShowForm(false); setEditingPlan(null); }}
            isSaving={saveMutation.isPending}
          />
        )}

        {showSuggestions && (
          <PlanSuggestionsModal
            companyId={companyId}
            onClose={() => setShowSuggestions(false)}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ['customer-plans', companyId] })}
          />
        )}
      </div>
    </AppLayout>
  );
}