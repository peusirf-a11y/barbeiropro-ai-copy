// Assinaturas — gestão de planos (criar/editar preço, features, ativar/desativar)
// + painel de migração SaaS Stripe→Asaas (Etapa 4).
import PlansManager from '@/components/master/PlansManager';
import MigrationStripeAsaasPanel from '@/components/master/MigrationStripeAsaasPanel';

export default function MasterAssinaturas() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Assinaturas</h2>
        <p className="text-sm text-muted-foreground mt-1">Gerencie planos, preços e regras de cobrança.</p>
      </div>
      <PlansManager />
      <div className="border-t border-border pt-10">
        <MigrationStripeAsaasPanel />
      </div>
    </div>
  );
}