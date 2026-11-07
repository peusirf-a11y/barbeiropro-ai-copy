// Toggle para ativar/desativar o modo Multi-Unidade na empresa.
// Quando ativado pela primeira vez, garante que a unidade "Matriz" exista (via backfillUnits).

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function MultiUnitToggle({ company }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [optimisticEnabled, setOptimisticEnabled] = useState(null);

  useEffect(() => {
    if (company?.multi_unit_enabled !== undefined) {
      setOptimisticEnabled(Boolean(company.multi_unit_enabled));
    }
  }, [company?.multi_unit_enabled]);

  const enabled = optimisticEnabled !== null ? optimisticEnabled : !!company?.multi_unit_enabled;

  const mutation = useMutation({
    mutationFn: async (value) => {
      setOptimisticEnabled(value);
      await base44.entities.Company.update(company.id, { multi_unit_enabled: value });
      if (value) {
        try { await base44.functions.invoke('backfillUnits', { company_id: company.id }); } catch { /* ignore */ }
      }
      return value;
    },
    onSuccess: (value) => {
      setOptimisticEnabled(value);
      queryClient.setQueriesData({ queryKey: ['my-company'] }, (old) => {
        if (!old || typeof old !== 'object') return old;
        if (old.company) {
          return {
            ...old,
            company: { ...old.company, multi_unit_enabled: value },
          };
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['units', company.id] });
      toast({
        title: value ? 'Multi-unidade ativado!' : 'Multi-unidade desativado',
        description: value
          ? 'Agora você pode cadastrar filiais e filtrar dados por unidade.'
          : 'O sistema voltou a operar como unidade única.',
      });
    },
    onError: (err) => {
      setOptimisticEnabled(!!company?.multi_unit_enabled);
      toast({
        title: 'Erro ao atualizar modo Multi-unidade',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  if (!company) return null;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center flex-shrink-0 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
          <span className="absolute inset-0 rounded-xl bg-[#60A5FA]/30 blur-md opacity-60" aria-hidden="true" />
          <Building2 className="relative w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-sm">Modo Multi-Unidade</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              enabled
                ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
                : 'bg-white/[0.05] text-white/55 border-white/15'
            }`}>
              {enabled ? 'Ativo' : 'Desativado'}
            </span>
          </div>
          <p className="text-xs text-white/55 mt-0.5">
            Ative se a sua barbearia tem mais de uma unidade física (Matriz + Filiais). Se tem apenas uma, mantenha desligado para uma experiência mais simples.
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Modo Multi-Unidade"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(!enabled)}
        className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
          enabled ? 'bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] shadow-[0_4px_12px_rgba(37,99,235,0.4)]' : 'bg-white/15'
        } ${mutation.isPending ? 'opacity-60' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform flex items-center justify-center ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        >
          {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-[#60A5FA]" />}
        </span>
      </button>
    </div>
  );
}