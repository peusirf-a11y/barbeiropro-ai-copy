// Aba "Funcionalidades" do Master — exibe o catálogo central de features
// agrupadas por categoria, com badge e descrição. É read-only por design:
// adicionar/remover features é feito em código (lib/featureCatalog.js) para
// evitar inconsistências entre catálogo declarado e código que consome.
//
// Esta tela serve como referência visual para o time + ponto de entrada para:
//   - editar features de cada PLANO (link → /master/configuracoes ou modal)
//   - editar overrides de cada EMPRESA (link → /master/barbearias/:id)

import { useState } from 'react';
import { FEATURE_CATALOG, FEATURE_CATEGORIES, BADGE_STYLES } from '@/lib/featureCatalog';
import { Layers, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';

const sortedCategories = Object.entries(FEATURE_CATEGORIES)
  .sort(([, a], [, b]) => (a.sort || 0) - (b.sort || 0));

export default function FeatureCatalogManager() {
  const [experimentalState, setExperimentalState] = useState(() => {
    const init = {};
    for (const f of FEATURE_CATALOG) {
      if (f.experimental || f.badge === 'experimental') {
        init[f.key] = Boolean(f.default_enabled);
      }
    }
    return init;
  });

  const handleToggleExperimental = (key) => {
    setExperimentalState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center">
          <Layers className="w-4 h-4 text-blue-500" />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-foreground text-lg tracking-tight">Catálogo de funcionalidades</h2>
          <p className="text-xs text-muted-foreground">{FEATURE_CATALOG.length} features disponíveis no sistema (incluindo recursos Experimentais). Use Planos / Empresas ou os controles abaixo para liberar.</p>
        </div>
      </div>

      <div className="divide-y divide-border">
        {sortedCategories.map(([catKey, cat]) => {
          const items = FEATURE_CATALOG.filter(f => f.category === catKey);
          if (items.length === 0) return null;
          return (
            <div key={catKey} className="p-4 sm:p-5">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">{cat.label}</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {items.map(f => {
                  const badge = f.badge ? BADGE_STYLES[f.badge] : null;
                  const isExperimental = Boolean(f.experimental || f.badge === 'experimental');
                  const isEnabled = Boolean(experimentalState[f.key]);
                  return (
                    <div key={f.key} className="border border-border rounded-xl p-3 bg-muted/40 hover:bg-muted/60 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{f.label}</span>
                          {badge && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        {isExperimental && (
                          <button
                            type="button"
                            onClick={() => handleToggleExperimental(f.key)}
                            aria-label={`Alternar ${f.label}`}
                            data-testid={`catalog-toggle-${f.key}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                          >
                            {isEnabled ? (
                              <>
                                <span className="text-[10px] text-emerald-500 font-bold">Ativo</span>
                                <ToggleRight className="w-6 h-6 text-emerald-500" />
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] text-muted-foreground font-bold">Inativo</span>
                                <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-blue-500 mb-1 flex items-center gap-1.5">
                        <span>{f.key}</span>
                        {isExperimental && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
                            <Sparkles className="w-2.5 h-2.5" /> experimental
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground leading-snug">{f.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}