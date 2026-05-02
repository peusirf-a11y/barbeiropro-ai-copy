// Configurações — feature flags globais e regras gerais do sistema.
import FeatureFlagsManager from '@/components/master/FeatureFlagsManager';

export default function MasterConfiguracoes() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#111827] tracking-tight">Configurações</h2>
        <p className="text-sm text-[#6B7280] mt-1">Flags e regras globais do sistema.</p>
      </div>
      <FeatureFlagsManager />
    </div>
  );
}