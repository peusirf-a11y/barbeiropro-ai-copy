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
        on:      'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20',
        off:     'bg-red-500/10 border-red-500/40 ring-1 ring-red-500/20',
        inherit: 'bg-muted/40 border-border',
      }[state]
    : (state === 'on'
        ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/20'
        : 'bg-muted/30 border-border hover:border-blue-500/40');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl p-3 border transition-all ${stateStyle}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
          {mode === 'binary' && state === 'on' && <Check className="w-3.5 h-3.5 text-blue-500" />}
          {mode === 'tri' && state === 'on' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
          {mode === 'tri' && state === 'off' && <X className="w-3.5 h-3.5 text-red-500" />}
          {mode === 'tri' && state === 'inherit' && <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />}
          {feature.label}
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">{feature.description}</div>
      {mode === 'tri' && (
        <div className="text-[10px] mt-1.5 font-medium">
          {state === 'on'      && <span className="text-emerald-500">✓ Liberado manualmente</span>}
          {state === 'off'     && <span className="text-red-500">✗ Bloqueado manualmente</span>}
          {state === 'inherit' && <span className="text-muted-foreground">↳ Herdado do plano</span>}
        </div>
      )}
    </button>
  );
}

export default function FeatureToggleGrid({ value = [], onChange, triState = null, includeHidden = false }) {
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
        const items = FEATURE_CATALOG.filter(f => f.category === catKey && (includeHidden || !f.hidden));
        if (items.length === 0) return null;
        return (
          <div key={catKey}>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{cat.label}</div>
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
        <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap pt-2 border-t border-border">
          <span className="inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Herdado do plano</span>
          <span className="inline-flex items-center gap-1 text-emerald-500"><Check className="w-3 h-3" /> Liberado manualmente</span>
          <span className="inline-flex items-center gap-1 text-red-500"><X className="w-3 h-3" /> Bloqueado manualmente</span>
          <span className="text-muted-foreground">— clique para alternar</span>
        </div>
      )}
    </div>
  );
}