// Company360Payments — status Asaas, subconta, billing.
import { Wallet, CheckCircle2, AlertTriangle, Clock, Hash, Link as LinkIcon } from 'lucide-react';

const subAccountStatus = {
  pending:           { label: 'Aguardando aprovação', icon: Clock, color: 'text-amber-700 bg-amber-50 ring-amber-100' },
  active:            { label: 'Subconta ativa', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 ring-emerald-100' },
  rejected:          { label: 'Subconta rejeitada', icon: AlertTriangle, color: 'text-red-700 bg-red-50 ring-red-100' },
  not_available_pf:  { label: 'Modo manual (PF/CPF)', icon: AlertTriangle, color: 'text-gray-700 bg-gray-100 ring-gray-200' },
};

const providerLabels = {
  asaas: 'Asaas',
  stripe: 'Stripe (legado)',
  asaas_pending: 'Asaas (em ativação)',
};

function Row({ label, value, mono, icon: Icon }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </div>
      <div className={`text-sm font-semibold text-foreground text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </div>
    </div>
  );
}

export default function Company360Payments({ company }) {
  const subStatus = company.asaas_subaccount_status
    ? subAccountStatus[company.asaas_subaccount_status]
    : null;
  const SubIcon = subStatus?.icon;

  return (
    <div className="space-y-4">
      {/* Subconta Asaas */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 ring-1 ring-blue-100 flex items-center justify-center text-blue-700">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Subconta Asaas (split)</div>
            <div className="text-[11px] text-muted-foreground">Recebimento automático da barbearia</div>
          </div>
          {subStatus && (
            <span className={`ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full ring-1 inline-flex items-center gap-1 ${subStatus.color}`}>
              {SubIcon && <SubIcon className="w-3 h-3" />} {subStatus.label}
            </span>
          )}
        </div>
        <Row icon={Hash} label="ID da subconta" value={company.asaas_subaccount_id} mono />
        <Row icon={Hash} label="Wallet ID (split)" value={company.asaas_subaccount_wallet_id} mono />
        <Row label="API key preview" value={company.asaas_subaccount_api_key_preview} mono />
        <Row label="Modo de split" value={company.asaas_split_mode === 'automatic' ? 'Automático' : company.asaas_split_mode === 'manual' ? 'Manual' : '—'} />
        <Row label="Percentual repasse" value={company.asaas_split_percentage != null ? `${company.asaas_split_percentage}%` : '—'} />
        <Row label="Pix habilitado" value={company.asaas_pix_enabled ? 'Sim' : 'Não'} />
        {company.asaas_subaccount_onboarding_url && (
          <div className="mt-3">
            <a href={company.asaas_subaccount_onboarding_url} target="_blank" rel="noreferrer"
              className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> Abrir onboarding Asaas
            </a>
          </div>
        )}
      </div>

      {/* Cobrança SaaS */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center text-emerald-700">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Cobrança da assinatura SaaS</div>
            <div className="text-[11px] text-muted-foreground">Pagamento do plano O CORTE pela barbearia</div>
          </div>
        </div>
        <Row label="Provider ativo" value={providerLabels[company.billing_provider] || company.billing_provider} />
        <Row icon={Hash} label="Asaas Customer ID" value={company.asaas_customer_id} mono />
        <Row icon={Hash} label="Asaas Subscription ID" value={company.asaas_subscription_id} mono />
        {company.asaas_payment_link_url && (
          <div className="mt-3">
            <a href={company.asaas_payment_link_url} target="_blank" rel="noreferrer"
              className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> Link de pagamento
            </a>
          </div>
        )}
        {company.stripe_customer_id && (
          <>
            <Row icon={Hash} label="Stripe Customer (legado)" value={company.stripe_customer_id} mono />
            <Row icon={Hash} label="Stripe Subscription (legado)" value={company.stripe_subscription_id} mono />
          </>
        )}
      </div>
    </div>
  );
}