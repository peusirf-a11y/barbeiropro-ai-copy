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

  const masterCommercialFeatures = FEATURE_CATALOG.filter(
    (f) => !f.hidden && (f.badge === 'master' || f.badge === 'premium' || f.badge === 'core')
  );

  return (
    <div className="space-y-6">
      {/* Destaque Comercial: Recursos do Plano Master em Cards Comerciais */}
      <div
        data-testid="master-plan-feature-cards-section"
        className="bg-card rounded-2xl border border-blue-500/30 overflow-hidden shadow-[var(--shadow-sm)]"
      >
        <div className="p-4 sm:p-5 border-b border-border bg-blue-500/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-foreground text-lg tracking-tight">
                  Catálogo Comercial — Plano Master
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30">
                  Cards Comerciais ({masterCommercialFeatures.length} recursos)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cada funcionalidade comercial do Plano Master com descrição detalhada e tag comercial de posicionamento.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {masterCommercialFeatures.map((f) => {
            const badge = (f.badge && BADGE_STYLES[f.badge]) || BADGE_STYLES.master;
            const catLabel = FEATURE_CATEGORIES[f.category]?.label || f.category;
            return (
              <div
                key={`master-card-${f.key}`}
                data-testid={`master-feature-card-${f.key}`}
                className="rounded-xl border border-border bg-muted/30 hover:bg-muted/50 p-3.5 flex flex-col justify-between gap-2 transition-colors shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-sm text-foreground leading-snug">{f.label}</h3>
                    <span
                      data-testid={`commercial-tag-${f.key}`}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.className}`}
                    >
                      {f.commercial_tag || badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
                <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-semibold text-blue-500 uppercase tracking-wider">{catLabel}</span>
                  <span className="font-mono text-muted-foreground">{f.key}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Catálogo Completo por Categoria */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
        <div className="p-4 sm:p-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center">
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-foreground text-lg tracking-tight">Catálogo de funcionalidades</h2>
            <p className="text-xs text-muted-foreground">
              {FEATURE_CATALOG.length} features disponíveis no sistema (incluindo recursos Experimentais). Use Planos / Empresas ou os controles abaixo para liberar.
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {sortedCategories.map(([catKey, cat]) => {
            const items = FEATURE_CATALOG.filter((f) => f.category === catKey);
            if (items.length === 0) return null;
            return (
              <div key={catKey} className="p-4 sm:p-5">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  {cat.label}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {items.map((f) => {
                    const badge = (f.badge && BADGE_STYLES[f.badge]) || BADGE_STYLES.master;
                    const isExperimental = Boolean(f.experimental || f.badge === 'experimental');
                    const isEnabled = Boolean(experimentalState[f.key]);
                    return (
                      <div
                        key={f.key}
                        data-testid={`feature-catalog-card-${f.key}`}
                        className="border border-border rounded-xl p-3.5 bg-muted/40 hover:bg-muted/60 transition-colors flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{f.label}</span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}
                              >
                                {f.commercial_tag || badge.label}
                              </span>
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
                          <p className="text-xs text-muted-foreground leading-relaxed mb-2">{f.description}</p>
                        </div>
                        <div className="font-mono text-[10px] text-blue-500 pt-1.5 border-t border-border/60 flex items-center justify-between gap-1.5">
                          <span>{f.key}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-sans text-[10px] font-semibold text-muted-foreground">
                              {cat.label}
                            </span>
                            {isExperimental && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
                                <Sparkles className="w-2.5 h-2.5" /> experimental
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}