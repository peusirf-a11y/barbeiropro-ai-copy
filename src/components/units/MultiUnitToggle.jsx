// MultiUnitToggle — liga/desliga o recurso multi-unidade da barbearia.
// Quando ligado pela primeira vez, dispara o backfill (cria a Matriz e migra os registros).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function MultiUnitToggle({ company }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const enabled = !!company?.multi_unit_enabled;

  const updateM = useMutation({
    mutationFn: async (value) => {
      await base44.entities.Company.update(company.id, { multi_unit_enabled: value });
      // Garante backfill na 1ª ativação (idempotente no backend)
      if (value) {
        try { await base44.functions.invoke('backfillUnits', {}); } catch { /* ignore */ }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-company'] });
      qc.invalidateQueries({ queryKey: ['units', company.id] });
      toast({ title: enabled ? 'Multi-unidade desativado' : 'Multi-unidade ativado!' });
    },
    onError: (err) => {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    },
  });

  return (
    <div className={`rounded-2xl p-5 mb-6 border transition-all ${
      enabled
        ? 'bg-gradient-to-br from-[#EFF6FF] to-white border-[#DBEAFE]'
        : 'bg-white border-black/5 shadow-[var(--shadow-sm)]'
    }`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            enabled ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]' : 'bg-gray-100 text-gray-500'
          }`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-[#111827] text-sm">Recurso multi-unidade</h3>
            <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
              {enabled
                ? 'Ativo. O seletor de unidade aparece no topo do app e cada unidade tem agenda, financeiro e equipe próprios.'
                : 'Ative para gerenciar mais de uma unidade da barbearia. Recomendado quando você tem 2+ filiais.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => updateM.mutate(!enabled)}
          disabled={updateM.isPending}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-[#2563EB]' : 'bg-gray-300'
          } disabled:opacity-50`}
          aria-label="Alternar multi-unidade"
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          {updateM.isPending && (
            <Loader2 className="absolute -right-6 w-4 h-4 animate-spin text-[#2563EB]" />
          )}
        </button>
      </div>
    </div>
  );
}