// Assinaturas — gestão de planos (criar/editar preço, features, ativar/desativar).
import PlansManager from '@/components/master/PlansManager';

export default function MasterAssinaturas() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#111827] tracking-tight">Assinaturas</h2>
        <p className="text-sm text-[#6B7280] mt-1">Gerencie planos, preços e regras de cobrança.</p>
      </div>
      <PlansManager />
    </div>
  );
}