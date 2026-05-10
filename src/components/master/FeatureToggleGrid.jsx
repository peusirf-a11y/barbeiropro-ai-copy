// Grid de toggles de features organizado por categoria.
// Reutilizável em:
//   - PlansManager (selecionar features que o plano libera)
//   - CompanyFeatureOverrides (overrides por empresa, com 3 estados)
//
// Props:
//   value: string[]                                    — keys ativas
//   onChange: (newValue: string[]) => void             — receberá array atualizado
//   triState?: { disabled: string[], onTriChange: (key, state: 'on'|'off'|'inherit') => void, inheritedKeys: string[] }
//     Quando passado, o grid mostra 3 estados (Herdado / Liberado / Bloqueado)
//     e ignora value/onChange.

import { FEATURE_CATALOG, FEATURE_CATEGORIES, BADGE_STYLES } from '@/lib/featureCatalog';
import { Check, X, ArrowUpRight } from 'lucide-react';

const sortedCategories = Object.entries(FEATURE_CATEGORIES)
  .sort(([, a], [, b]) => (a.sort || 0) - (b.sort || 0));

function FeatureCard({ feature, mode, state, onClick }) {
  // mode = 'binary' | 'tri'
  // binary state: 'on' | 'off'
  // tri state: 'on' | 'off' | 'inherit'

  const badge = feature.badge ? BADGE_STYLES[feature.badge] : null;

  const stateStyle = mode === 'tri'
    ? {
        on:      'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200',
        off:     'bg-red-50 border-red-300 ring-1 ring-red-200',
        inherit: 'bg-[#FAFBFC] border-black/10',
      }[state]
    : (state === 'on'
        ? 'bg-[#EFF6FF] border-[#2563EB]/40 ring-1 ring-[#DBEAFE]'
        : 'bg-white border-black/10 hover:border-[#2563EB]/30');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl p-3 border transition-all ${stateStyle}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-semibold text-sm text-[#111827] flex items-center gap-1.5">
          {mode === 'binary' && state === 'on' && <Check className="w-3.5 h-3.5 text-[#2563EB]" />}
          {mode === 'tri' && state === 'on' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
          {mode === 'tri' && state === 'off' && <X className="w-3.5 h-3.5 text-red-600" />}
          {mode === 'tri' && state === 'inherit' && <ArrowUpRight className="w-3.5 h-3.5 text-[#6B7280]" />}
          {feature.label}
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="text-[10px] text-[#6B7280] line-clamp-2 leading-snug">{feature.description}</div>
      {mode === 'tri' && (
        <div className="text-[10px] mt-1.5 font-medium">
          {state === 'on'      && <span className="text-emerald-700">✓ Liberado manualmente</span>}
          {state === 'off'     && <span className="text-red-700">✗ Bloqueado manualmente</span>}
          {state === 'inherit' && <span className="text-[#6B7280]">↳ Herdado do plano</span>}
        </div>
      )}
    </button>
  );
}

export default function FeatureToggleGrid({ value = [], onChange, triState = null }) {
  const isTri = !!triState;
  const inheritedSet = new Set((triState?.inheritedKeys || []));
  const enabledSet = new Set(value);
  const disabledSet = new Set((triState?.disabled || []));

  const handleBinaryClick = (key) => {
    if (enabledSet.has(key)) onChange(value.filter(k => k !== key));
    else onChange([...value, key]);
  };

  const handleTriClick = (key) => {
    // Cicla: inherit → on → off → inherit
    let next;
    if (enabledSet.has(key))      next = 'off';
    else if (disabledSet.has(key)) next = 'inherit';
    else                            next = 'on';
    triState.onTriChange(key, next);
  };

  const stateOf = (key) => {
    if (isTri) {
      if (enabledSet.has(key)) return 'on';
      if (disabledSet.has(key)) return 'off';
      return 'inherit';
    }
    return enabledSet.has(key) ? 'on' : 'off';
  };

  return (
    <div className="space-y-5">
      {sortedCategories.map(([catKey, cat]) => {
        const items = FEATURE_CATALOG.filter(f => f.category === catKey);
        if (items.length === 0) return null;
        return (
          <div key={catKey}>
            <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">{cat.label}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map(f => (
                <FeatureCard
                  key={f.key}
                  feature={f}
                  mode={isTri ? 'tri' : 'binary'}
                  state={stateOf(f.key)}
                  onClick={() => isTri ? handleTriClick(f.key) : handleBinaryClick(f.key)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {isTri && (
        <div className="text-[11px] text-[#6B7280] flex items-center gap-3 flex-wrap pt-2 border-t border-black/5">
          <span className="inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Herdado do plano</span>
          <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="w-3 h-3" /> Liberado manualmente</span>
          <span className="inline-flex items-center gap-1 text-red-700"><X className="w-3 h-3" /> Bloqueado manualmente</span>
          <span className="text-[#6B7280]">— clique para alternar</span>
        </div>
      )}
    </div>
  );
}