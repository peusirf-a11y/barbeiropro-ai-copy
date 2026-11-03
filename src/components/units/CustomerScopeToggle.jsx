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
            ? 'border-[#2563EB] bg-blue-500/15 shadow-[0_8px_20px_rgba(37,99,235,0.2)]'
            : 'border-white/10 bg-white/[0.02] hover:border-blue-400/40 hover:bg-white/[0.04]'
        } disabled:opacity-50`}
      >
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
          selected ? 'bg-[#2563EB] text-white' : 'bg-white/10 text-white/50'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="font-bold text-sm text-white mb-1">{title}</div>
        <div className="text-xs text-white/60 leading-relaxed">{description}</div>
      </button>
    );
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <h2 className="font-bold text-white">Modo de clientes</h2>
        {updateM.isPending && (
          <span className="inline-flex items-center gap-1 text-xs text-[#60A5FA] font-semibold">
            <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
          </span>
        )}
      </div>
      <p className="text-sm text-white/60 mb-4">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmingValue(null)}>
          <div className="bg-[#0B1020] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 text-white" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-2">Separar clientes por unidade?</h3>
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              A partir de agora, novos clientes ficarão vinculados à unidade onde forem cadastrados. Os clientes existentes (sem unidade definida) continuarão visíveis em todas as unidades como "compartilhados".
              <br /><br />
              Você pode voltar a unificar os clientes a qualquer momento.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingValue(null)}
                className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-sm font-medium hover:bg-white/10 text-white/80"
              >
                Cancelar
              </button>
              <button
                onClick={() => updateM.mutate(false)}
                disabled={updateM.isPending}
                className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50"
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