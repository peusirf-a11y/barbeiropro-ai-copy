// Aba "Funcionalidades" do Master — mostra o catálogo central + flags
// experimentais. Edição por plano vai em Configurações > Planos. Edição por
// empresa vai em /master/barbearias/:id.

import FeatureCatalogManager from '@/components/master/FeatureCatalogManager';
import FeatureFlagsManager from '@/components/master/FeatureFlagsManager';

export default function MasterFuncionalidades() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#111827] tracking-tight">Funcionalidades</h2>
        <p className="text-sm text-[#6B7280] mt-1">
          Catálogo central de features do produto. Para liberar/bloquear features em planos, vá em <strong>Configurações &gt; Planos</strong>. Para overrides individuais, abra a barbearia em <strong>Barbearias</strong>.
        </p>
      </div>

      <FeatureCatalogManager />

      <div>
        <h3 className="text-base font-bold text-[#111827] tracking-tight mb-2">Flags experimentais</h3>
        <p className="text-xs text-[#6B7280] mb-3">
          Para rollout/A-B testing — independente do catálogo de features comerciais.
        </p>
        <FeatureFlagsManager />
      </div>
    </div>
  );
}