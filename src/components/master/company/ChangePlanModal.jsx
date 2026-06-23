// ChangePlanModal — altera o plano da empresa. Lê Plan.list() e faz Company.update.
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StandardModal from '@/components/ui/standard-modal';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, Loader2 } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export default function ChangePlanModal({ open, onClose, company, onSuccess }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['master-plans-all'],
    queryFn: () => base44.entities.Plan.list('sort_order', 100),
    enabled: open,
  });

  useEffect(() => {
    if (open) setSelected(company?.plan_id || null);
  }, [open, company?.plan_id]);

  const change = useMutation({
    mutationFn: async () => {
      const plan = plans.find(p => p.id === selected);
      if (!plan) throw new Error('Selecione um plano.');
      return base44.entities.Company.update(company.id, {
        plan_id: plan.id,
        plan_name: plan.name,
      });
    },
    onSuccess: () => {
      toast({ title: 'Plano alterado', description: 'Empresa atualizada com sucesso.' });
      onSuccess?.();
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return (
    <StandardModal
      open={open}
      onClose={onClose}
      title="Alterar plano da empresa"
      footer={
        <>
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => change.mutate()}
            disabled={!selected || selected === company?.plan_id || change.isPending}
            className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors"
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
          const isCurrent = company?.plan_id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
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