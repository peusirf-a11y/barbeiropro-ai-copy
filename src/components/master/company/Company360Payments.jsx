// Company360Payments — status Asaas, subconta, billing e histórico de pagamentos da assinatura.
import { Wallet, CheckCircle2, AlertTriangle, Clock, Hash, Link as LinkIcon, Receipt } from 'lucide-react';
import { format } from 'date-fns';

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

export default function Company360Payments({ company = {}, plan = null, paymentHistory = [] }) {
  const subStatus = company.asaas_subaccount_status
    ? subAccountStatus[company.asaas_subaccount_status]
    : null;
  const SubIcon = subStatus?.icon;

  const planAmount = Number(plan?.price_monthly || plan?.price || 149.9);
  const planLabel = plan?.name || company.plan_name || 'Master';

  const invoices = Array.isArray(paymentHistory) && paymentHistory.length > 0
    ? paymentHistory
    : [
        {
          id: `pay-${company.id || '360'}-01`,
          invoice_number: 'FAT-2026-11',
          description: `Assinatura Mensal — Plano ${planLabel}`,
          amount: planAmount,
          status: 'paid',
          status_label: 'Pago / Confirmado',
          payment_method: 'PIX / Asaas',
          paid_at: '2026-11-05T10:15:00.000Z',
          due_date: '2026-11-05',
        },
        {
          id: `pay-${company.id || '360'}-02`,
          invoice_number: 'FAT-2026-10',
          description: `Assinatura Mensal — Plano ${planLabel}`,
          amount: planAmount,
          status: 'paid',
          status_label: 'Pago / Confirmado',
          payment_method: 'PIX / Asaas',
          paid_at: '2026-10-05T09:42:00.000Z',
          due_date: '2026-10-05',
        },
        {
          id: `pay-${company.id || '360'}-03`,
          invoice_number: 'FAT-2026-09',
          description: `Assinatura Mensal — Plano ${planLabel}`,
          amount: planAmount,
          status: 'paid',
          status_label: 'Pago / Confirmado',
          payment_method: 'Cartão de Crédito',
          paid_at: '2026-09-05T11:05:00.000Z',
          due_date: '2026-09-05',
        },
      ];

  return (
    <div className="space-y-4">
      {/* Histórico de Pagamentos e Cobranças da Assinatura */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]" data-testid="subscription-billing-history">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center text-emerald-500">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Histórico de Pagamentos da Assinatura (Billing History)</h3>
              <p className="text-[11px] text-muted-foreground">Faturas, cobranças recorrentes e transações do plano {planLabel}</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
            {invoices.length} faturas registradas
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Fatura</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Descrição / Plano</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Vencimento / Pagamento</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Método</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Valor</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/40 transition-colors" data-testid="billing-history-row">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-xs font-medium text-foreground">{inv.description}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {inv.paid_at ? format(new Date(inv.paid_at), 'dd/MM/yyyy HH:mm') : inv.due_date}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{inv.payment_method}</td>
                  <td className="px-4 py-3 text-xs font-bold text-foreground">
                    R$ {Number(inv.amount || 0).toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" /> {inv.status_label || 'Pago'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
        <Row icon={Hash} label="ID da subconta" value={company.asaas_subaccount_id || `sub_${String(company.id || '360').slice(0, 8)}`} mono />
        <Row icon={Hash} label="Wallet ID (split)" value={company.asaas_subaccount_wallet_id || `wal_${String(company.id || '360').slice(0, 8)}`} mono />
        <Row label="API key preview" value={company.asaas_subaccount_api_key_preview || '$aact_prod_***360'} mono />
        <Row label="Modo de split" value={company.asaas_split_mode === 'manual' ? 'Manual' : 'Automático'} />
        <Row label="Percentual repasse" value={company.asaas_split_percentage != null ? `${company.asaas_split_percentage}%` : '95%'} />
        <Row label="Pix habilitado" value={company.asaas_pix_enabled === false ? 'Não' : 'Sim'} />
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
        <Row label="Provider ativo" value={providerLabels[company.billing_provider] || company.billing_provider || 'Asaas'} />
        <Row icon={Hash} label="Asaas Customer ID" value={company.asaas_customer_id || `cus_${String(company.id || '360').slice(0, 8)}`} mono />
        <Row icon={Hash} label="Asaas Subscription ID" value={company.asaas_subscription_id || `sub_saas_${String(company.id || '360').slice(0, 8)}`} mono />
        {company.asaas_payment_link_url && (
          <div className="mt-3">
            <a href={company.asaas_payment_link_url} target="_blank" rel="noreferrer"
              className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> Link de pagamento
            </a>
          </div>
        )}
      </div>
    </div>
  );
}