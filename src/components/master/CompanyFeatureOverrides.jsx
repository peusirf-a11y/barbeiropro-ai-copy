// Overrides de features por empresa (Master).
// Apresenta TODAS as features do catálogo com 3 estados:
//   - inherit: usa o que o plano define
//   - on:      força liberado (mesmo se o plano não inclui)
//   - off:     força bloqueado (mesmo se o plano inclui)
//
// Persiste em Company.feature_overrides = { enabled: [], disabled: [] }.

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import FeatureToggleGrid from './FeatureToggleGrid';
import { canonicalFeatureKey } from '@/lib/featureCatalog';
import { useToast } from '@/components/ui/use-toast';
import { Save, RotateCcw } from 'lucide-react';

export default function CompanyFeatureOverrides({ company, plan }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const initial = {
    enabled: (company?.feature_overrides?.enabled || []).map(canonicalFeatureKey),
    disabled: (company?.feature_overrides?.disabled || []).map(canonicalFeatureKey),
  };
  const [enabled, setEnabled]   = useState(initial.enabled);
  const [disabled, setDisabled] = useState(initial.disabled);

  // Reset quando troca de empresa
  useEffect(() => {
    setEnabled((company?.feature_overrides?.enabled || []).map(canonicalFeatureKey));
    setDisabled((company?.feature_overrides?.disabled || []).map(canonicalFeatureKey));
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const inheritedKeys = (plan?.features || []).map(canonicalFeatureKey);

  const dirty =
    JSON.stringify([...enabled].sort()) !== JSON.stringify([...initial.enabled].sort()) ||
    JSON.stringify([...disabled].sort()) !== JSON.stringify([...initial.disabled].sort());

  const handleTriChange = (key, state) => {
    if (state === 'on') {
      setEnabled(p => Array.from(new Set([...p, key])));
      setDisabled(p => p.filter(k => k !== key));
    } else if (state === 'off') {
      setDisabled(p => Array.from(new Set([...p, key])));
      setEnabled(p => p.filter(k => k !== key));
    } else {
      // inherit
      setEnabled(p => p.filter(k => k !== key));
      setDisabled(p => p.filter(k => k !== key));
    }
  };

  const save = useMutation({
    mutationFn: () => base44.entities.Company.update(company.id, {
      feature_overrides: { enabled, disabled },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master-companies'] });
      qc.invalidateQueries({ queryKey: ['master-company', company?.id] });
      toast({ title: 'Overrides salvos' });
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const reset = () => {
    setEnabled([]);
    setDisabled([]);
  };

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-[#111827] text-lg tracking-tight">Funcionalidades</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Plano <span className="font-semibold text-[#111827]">{plan?.name || company?.plan_name || '—'}</span> libera {inheritedKeys.length} features. Use os overrides para liberar ou bloquear individualmente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={enabled.length === 0 && disabled.length === 0}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-black/10 text-[#6B7280] hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Limpar overrides
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            className="text-xs font-semibold px-3 py-2 bg-[#2563EB] text-white rounded-xl hover:bg-[#1d4ed8] disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {save.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      <FeatureToggleGrid
        triState={{
          disabled,
          inheritedKeys,
          onTriChange: handleTriChange,
        }}
        value={enabled}
      />
    </div>
  );
}