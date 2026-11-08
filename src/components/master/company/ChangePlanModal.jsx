// ChangePlanModal — altera o plano da empresa. Lê Plan.list() e faz Company.update.
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import StandardModal from '@/components/ui/standard-modal';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, Loader2 } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const FALLBACK_SAAS_PLANS = [
  { id: 'starter', name: 'Starter', price_monthly: 49, features: ['online_booking', 'whatsapp'] },
  { id: 'classico', name: 'Clássico', price_monthly: 69, features: ['online_booking', 'whatsapp', 'financial_dashboard', 'cashier'] },
  { id: 'pro', name: 'Pro', price_monthly: 99, features: ['online_booking', 'whatsapp', 'financial_dashboard', 'cashier', 'crm_retention', 'commissions'] },
  { id: 'master', name: 'Master', price_monthly: 119, features: ['online_booking', 'whatsapp', 'financial_dashboard', 'cashier', 'crm_retention', 'commissions', 'ai_growth', 'advanced_reports'] },
  { id: 'exclusivo', name: 'Exclusivo', price_monthly: 249, features: ['online_booking', 'whatsapp', 'financial_dashboard', 'cashier', 'crm_retention', 'commissions', 'ai_growth', 'advanced_reports', 'multi_units', 'custom_branding'] },
];

export default function ChangePlanModal({ open, onClose, company, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);

  const { data: fetchedPlans = [], isLoading } = useQuery({
    queryKey: ['master-plans-all'],
    queryFn: async () => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .is('company_id', null)
          .order('order_index', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.filter((p) => !p.company_id);
        }
      }
      return base44.entities.Plan.list('order_index', 100);
    },
    enabled: open,
  });

  const plans = useMemo(() => {
    const map = new Map();
    for (const p of fetchedPlans) {
      if (p?.id) map.set(String(p.id), p);
    }
    for (const fb of FALLBACK_SAAS_PLANS) {
      const hasByName = Array.from(map.values()).some(
        (x) => String(x.name || '').toLowerCase() === fb.name.toLowerCase()
      );
      if (!map.has(fb.id) && !hasByName) {
        map.set(fb.id, fb);
      }
    }
    return Array.from(map.values());
  }, [fetchedPlans]);

  useEffect(() => {
    if (open) {
      const currentMatch = plans.find(
        (p) =>
          p.id === company?.plan_id ||
          (company?.plan_name && String(p.name || '').toLowerCase() === String(company.plan_name).toLowerCase())
      );
      setSelected(currentMatch?.id || company?.plan_id || null);
    }
  }, [open, company?.plan_id, company?.plan_name, plans]);

  const change = useMutation({
    mutationFn: async () => {
      const plan = plans.find(p => p.id === selected);
      if (!plan) throw new Error('Selecione um plano.');
      const updated = await base44.entities.Company.update(company.id, {
        plan_id: plan.id,
        plan_name: plan.name,
      });
      return { updated, plan };
    },
    onSuccess: ({ plan }) => {
      // Atualiza imediatamente o cache 360 da empresa para refletir o novo plano e preço no cabeçalho e abas
      queryClient.setQueryData(['master-company-360', company.id], (old) => {
        if (!old) return old;
        return {
          ...old,
          company: {
            ...(old.company || {}),
            plan_id: plan.id,
            plan_name: plan.name,
          },
          plan: {
            ...(old.plan || {}),
            id: plan.id,
            name: plan.name,
            price_monthly: Number(plan.price_monthly || 0),
            features: Array.isArray(plan.features) ? plan.features : (old.plan?.features || []),
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ['master-companies'] });
      toast({
        title: 'Plano alterado',
        description: `Plano atualizado para ${plan.name} (${fmtMoney(plan.price_monthly)}/mês).`,
      });
      onSuccess?.();
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const isCurrentPlan = (p) =>
    company?.plan_id === p.id ||
    (company?.plan_name && String(company.plan_name).toLowerCase() === String(p.name || '').toLowerCase());

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title="Alterar plano da empresa"
      footer={
        <>
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            data-testid="confirm-change-plan-btn"
            onClick={() => change.mutate()}
            disabled={!selected || change.isPending}
            className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {change.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar alteração
          </button>
        </>
      }
    >
      <div className="space-y-2">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && plans.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum plano disponível.</div>}
        {plans.map(p => {
          const isSelected = selected === p.id;
          const isCurrent = isCurrentPlan(p);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#2563EB] bg-blue-50/40'
                  : 'border-border hover:border-[#2563EB]/40 bg-card'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-foreground flex items-center gap-2">
                    {p.name}
                    {isCurrent && <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">ATUAL</span>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {fmtMoney(p.price_monthly)}/mês
                    {p.features?.length > 0 && ` · ${p.features.length} features`}
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-[#2563EB] flex-shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
    </StandardModal>
  );
}