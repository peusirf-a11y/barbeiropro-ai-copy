// ============================================================================
// <FeatureGate /> — gate declarativo para qualquer trecho de UI.
// ============================================================================
// Uso:
//   <FeatureGate feature="crm_retention">
//     <CRMSection />
//   </FeatureGate>
//
//   <FeatureGate feature="ai_growth" fallback={<UpgradeCTA />}>
//     <AIInsights />
//   </FeatureGate>
//
//   <FeatureGate feature="multi_units" hideWhileLoading>...</FeatureGate>
//
// Props:
//   feature           string  — key do FEATURE_REGISTRY (aceita legacy)
//   children          node    — conteúdo renderizado quando liberado
//   fallback          node?   — renderizado quando bloqueado (default: null)
//   hideWhileLoading  bool?   — se true, retorna null enquanto carrega plano
//   invert            bool?   — inverte: renderiza children quando NÃO tem feature
// ============================================================================

import { useFeatures } from '@/hooks/useFeatures';

export default function FeatureGate({
  feature,
  children,
  fallback = null,
  hideWhileLoading = false,
  invert = false,
}) {
  const { has, isLoading } = useFeatures();

  if (isLoading) {
    return hideWhileLoading ? null : (fallback ?? null);
  }

  const allowed = has(feature);
  const shouldRender = invert ? !allowed : allowed;

  return shouldRender ? <>{children}</> : fallback;
}