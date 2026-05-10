// Configurações do Master — gestão de Planos do SaaS.
// Flags experimentais e catálogo de features ficam em /master/funcionalidades.

import PlansManager from '@/components/master/PlansManager';

export default function MasterConfiguracoes() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#111827] tracking-tight">Configurações</h2>
        <p className="text-sm text-[#6B7280] mt-1">Gerencie os planos do SaaS e as features que cada plano libera.</p>
      </div>
      <PlansManager />
    </div>
  );
}