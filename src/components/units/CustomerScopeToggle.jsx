// CustomerScopeToggle — controla o flag Company.customers_shared_across_units.
// Renderiza um cartão com 2 opções (radio): clientes globais x por unidade.
// Só faz sentido quando a empresa tem multi_unit_enabled=true.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Building2, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function CustomerScopeToggle({ company }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  // Default true (compatibilidade)
  const isShared = company?.customers_shared_across_units !== false;
  const [confirmingValue, setConfirmingValue] = useState(null);

  const updateM = useMutation({
    mutationFn: (value) => base44.entities.Company.update(company.id, { customers_shared_across_units: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-company'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customers-retencao'] });
      toast({ title: 'Modo de clientes atualizado' });
      setConfirmingValue(null);
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar', description: err?.message, variant: 'destructive' });
      setConfirmingValue(null);
    },
  });

  const handleSelect = (newValue) => {
    if (newValue === isShared) return;
    // Mudar de shared->unit (false) é destrutivo do ponto de vista de visibilidade — confirma.
    if (newValue === false) {
      setConfirmingValue(false);
    } else {
      // Mudar para shared volta ao comportamento global — não destrutivo.
      updateM.mutate(true);
    }
  };

  const Option = ({ value, icon: Icon, title, description }) => {
    const selected = isShared === value;
    return (
      <button
        type="button"
        onClick={() => handleSelect(value)}
        disabled={updateM.isPending}
        className={`relative text-left p-4 rounded-xl border-2 transition-all ${
          selected
            ? 'border-[#2563EB] bg-[#EFF6FF] shadow-[0_4px_12px_rgba(37,99,235,0.12)]'
            : 'border-black/10 bg-white hover:border-[#2563EB]/40'
        } disabled:opacity-50`}
      >
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
          selected ? 'bg-[#2563EB] text-white' : 'bg-gray-100 text-gray-500'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="font-bold text-sm text-[#111827] mb-1">{title}</div>
        <div className="text-xs text-[#6B7280] leading-relaxed">{description}</div>
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <h2 className="font-bold text-[#111827]">Modo de clientes</h2>
        {updateM.isPending && (
          <span className="inline-flex items-center gap-1 text-xs text-[#2563EB] font-semibold">
            <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
          </span>
        )}
      </div>
      <p className="text-sm text-[#6B7280] mb-4">
        Defina como os clientes são organizados entre as unidades.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <Option
          value={true}
          icon={Users}
          title="Compartilhados (recomendado)"
          description="Clientes pertencem à barbearia inteira e podem agendar em qualquer unidade. Histórico e estatísticas são unificados."
        />
        <Option
          value={false}
          icon={Building2}
          title="Separados por unidade"
          description="Cada cliente fica vinculado a uma unidade. Mesmo telefone pode existir em unidades diferentes (cadastros independentes)."
        />
      </div>

      {/* Modal de confirmação para mudança destrutiva */}
      {confirmingValue === false && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirmingValue(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#111827] mb-2">Separar clientes por unidade?</h3>
            <p className="text-sm text-[#6B7280] mb-4">
              A partir de agora, novos clientes ficarão vinculados à unidade onde forem cadastrados. Os clientes existentes (sem unidade definida) continuarão visíveis em todas as unidades como "compartilhados".
              <br /><br />
              Você pode voltar a unificar os clientes a qualquer momento.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingValue(null)}
                className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => updateM.mutate(false)}
                disabled={updateM.isPending}
                className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {updateM.isPending ? 'Aplicando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}