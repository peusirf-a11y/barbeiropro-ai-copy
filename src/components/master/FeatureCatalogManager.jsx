// Aba "Funcionalidades" do Master — exibe o catálogo central de features
// agrupadas por categoria, com badge e descrição. É read-only por design:
// adicionar/remover features é feito em código (lib/featureCatalog.js) para
// evitar inconsistências entre catálogo declarado e código que consome.
//
// Esta tela serve como referência visual para o time + ponto de entrada para:
//   - editar features de cada PLANO (link → /master/configuracoes ou modal)
//   - editar overrides de cada EMPRESA (link → /master/barbearias/:id)

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FEATURE_CATALOG, FEATURE_CATEGORIES, BADGE_STYLES } from '@/lib/featureCatalog';
import { clearFeatureFlagCache } from '@/lib/featureFlags';
import { Layers, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';

const sortedCategories = Object.entries(FEATURE_CATEGORIES)
  .sort(([, a], [, b]) => (a.sort || 0) - (b.sort || 0));

export default function FeatureCatalogManager() {
  const queryClient = useQueryClient();
  const { data: flags = [] } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => base44.entities.FeatureFlag.list('-created_date', 200),
  });

  const [experimentalState, setExperimentalState] = useState(() => {
    const init = {};
    for (const f of FEATURE_CATALOG) {
      if (f.experimental || f.badge === 'experimental') {
        init[f.key] = Boolean(f.default_enabled);
      }
    }
    return init;
  });

  const isExperimentalFeatureEnabled = (feature) => {
    const matchedFlag = Array.isArray(flags)
      ? flags.find((fl) => String(fl?.key || '') === String(feature.key))
      : null;
    if (matchedFlag && matchedFlag.enabled !== undefined) {
      return Boolean(matchedFlag.enabled);
    }
    if (experimentalState[feature.key] !== undefined) {
      return Boolean(experimentalState[feature.key]);
    }
    return Boolean(feature.default_enabled);
  };

  const handleToggleExperimental = async (feature) => {
    const key = feature.key;
    const currentEnabled = isExperimentalFeatureEnabled(feature);
    const nextEnabled = !currentEnabled;

    setExperimentalState((prev) => ({
      ...prev,
      [key]: nextEnabled,
    }));

    // Atualiza imediatamente a lista de feature flags na memória do React Query
    queryClient.setQueryData(['feature-flags'], (oldFlags = []) => {
      const list = Array.isArray(oldFlags) ? oldFlags : [];
      const exists = list.some((fl) => String(fl?.key || '') === String(key));
      if (exists) {
        return list.map((fl) =>
          String(fl?.key || '') === String(key) ? { ...fl, enabled: nextEnabled } : fl
        );
      }
      return [
        {
          id: `flag-exp-${key}`,
          key,
          name: feature.label,
          description: feature.description,
          category: 'experimental',
          experimental: true,
          badge: 'Experimental',
          enabled: nextEnabled,
          scope: 'global',
          target_ids: [],
          created_date: new Date().toISOString(),
        },
        ...list,
      ];
    });

    try {
      const currentFlags = queryClient.getQueryData(['feature-flags']) || flags || [];
      const existing = Array.isArray(currentFlags)
        ? currentFlags.find((fl) => String(fl?.key || '') === String(key))
        : null;

      if (existing?.id) {
        await base44.entities.FeatureFlag.update(existing.id, {
          enabled: nextEnabled,
          key,
        });
      } else {
        await base44.entities.FeatureFlag.create({
          key,
          name: feature.label,
          description: feature.description,
          category: 'experimental',
          experimental: true,
          badge: 'Experimental',
          enabled: nextEnabled,
          scope: 'global',
          target_ids: [],
        });
      }
      clearFeatureFlagCache();
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    } catch (err) {
      console.warn('[FeatureCatalogManager] Erro ao sincronizar feature flag experimental:', err);
    }
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
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
                  Catálogo Comercial — Plano Master
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/35">
                  Cards Comerciais ({masterCommercialFeatures.length} recursos)
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-200 mt-0.5">
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
                className="rounded-xl border border-slate-200 dark:border-[#2A3352] bg-slate-50 dark:bg-[#141A2E] hover:bg-slate-100/80 dark:hover:bg-[#19223B] p-3.5 flex flex-col justify-between gap-2 transition-colors shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">{f.label}</h3>
                    <span
                      data-testid={`commercial-tag-${f.key}`}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.className}`}
                    >
                      {f.commercial_tag || badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed">{f.description}</p>
                </div>
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wider">{catLabel}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">{f.key}</span>
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
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">Catálogo de funcionalidades</h2>
            <p className="text-xs text-slate-600 dark:text-slate-200">
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
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">
                  {cat.label}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {items.map((f) => {
                    const badge = (f.badge && BADGE_STYLES[f.badge]) || BADGE_STYLES.master;
                    const isExperimental = Boolean(f.experimental || f.badge === 'experimental');
                    const isEnabled = isExperimentalFeatureEnabled(f);
                    return (
                      <div
                        key={f.key}
                        data-testid={`feature-catalog-card-${f.key}`}
                        className="border border-slate-200 dark:border-[#2A3352] rounded-xl p-3.5 bg-slate-50 dark:bg-[#141A2E] hover:bg-slate-100/80 dark:hover:bg-[#19223B] transition-colors flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
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
                                onClick={() => handleToggleExperimental(f)}
                                aria-label={`Alternar ${f.label}`}
                                data-testid={`catalog-toggle-${f.key}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                              >
                                {isEnabled ? (
                                  <>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-bold">Ativo</span>
                                    <ToggleRight className="w-6 h-6 text-emerald-500" />
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold">Inativo</span>
                                    <ToggleLeft className="w-6 h-6 text-slate-500 dark:text-slate-300" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed mb-2">{f.description}</p>
                        </div>
                        <div className="font-mono text-[10px] text-blue-600 dark:text-blue-300 pt-1.5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-1.5">
                          <span>{f.key}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-sans text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              {cat.label}
                            </span>
                            {isExperimental && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-300">
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