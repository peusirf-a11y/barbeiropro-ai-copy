import AppLayout from '@/components/layout/AppLayout';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Company } from '@/api/entities';
import { resolveCompanyId } from '@/api/functions';
import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { CreditCard, CheckCircle, ExternalLink, Calendar, Zap, AlertTriangle } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useImpersonation } from '@/hooks/useImpersonation';
import ImpersonationLockNotice from '@/components/ImpersonationLockNotice';
import UpgradePlanCard from '@/components/billing/UpgradePlanCard';
import SaasPaymentModal from '@/components/billing/SaasPaymentModal';

const STATUS_LABEL = {
  trialing: { label: 'Em período grátis', color: 'bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/30' },
  active: { label: 'Ativa', color: 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30' },
  past_due: { label: 'Pagamento atrasado', color: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30' },
  overdue: { label: 'Pagamento atrasado', color: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30' },
  canceled: { label: 'Cancelada', color: 'bg-red-400/15 text-red-300 ring-1 ring-red-400/30' },
  unpaid: { label: 'Não paga', color: 'bg-red-400/15 text-red-300 ring-1 ring-red-400/30' },
  incomplete: { label: 'Incompleta', color: 'bg-white/10 text-white/70 ring-1 ring-white/15' },
};

function enrichCompanyBillingFields(rawCompany) {
  if (!rawCompany) return null;
  const out = { ...rawCompany };
  const billingMeta = out.business_hours?._billing || out.opening_hours?._billing || {};

  let localCheckout = null;
  if (typeof window !== 'undefined') {
    try {
      const rawLocal = localStorage.getItem('barberpass_checkout_data');
      if (rawLocal) localCheckout = JSON.parse(rawLocal);
    } catch (_) {}
  }

  const matchesLocal =
    localCheckout &&
    (!localCheckout.email ||
      !out.owner_email ||
      localCheckout.email.toLowerCase() === out.owner_email.toLowerCase() ||
      localCheckout.company_id === out.id);

  out.card_last_digits =
    out.card_last_digits ||
    out.card_last4 ||
    billingMeta.card_last_digits ||
    (matchesLocal ? localCheckout?.card_last_digits : '') ||
    '';

  out.card_brand =
    out.card_brand ||
    billingMeta.card_brand ||
    (matchesLocal ? localCheckout?.card_brand : '') ||
    '';

  out.asaas_subscription_id =
    out.asaas_subscription_id ||
    billingMeta.asaas_subscription_id ||
    (matchesLocal ? localCheckout?.asaas_subscription_id : null) ||
    null;

  out.asaas_customer_id =
    out.asaas_customer_id ||
    billingMeta.asaas_customer_id ||
    (matchesLocal ? localCheckout?.asaas_customer_id : null) ||
    null;

  out.plan_name =
    out.plan_name ||
    billingMeta.plan_name ||
    (matchesLocal && localCheckout?.plan
      ? String(localCheckout.plan).charAt(0).toUpperCase() + String(localCheckout.plan).slice(1)
      : null) ||
    'Starter';

  out.trial_ends_at =
    out.trial_ends_at ||
    billingMeta.trial_ends_at ||
    (matchesLocal ? localCheckout?.trial_ends_at : null) ||
    null;

  if ((!out.subscription_status || out.subscription_status === 'trialing') && billingMeta.subscription_status) {
    out.subscription_status = billingMeta.subscription_status;
  }
  if (!out.billing_status && billingMeta.billing_status) {
    out.billing_status = billingMeta.billing_status;
  }
  if (!out.current_period_end && billingMeta.current_period_end) {
    out.current_period_end = billingMeta.current_period_end;
  }
  if (!out.asaas_payment_link_url && billingMeta.asaas_payment_link_url) {
    out.asaas_payment_link_url = billingMeta.asaas_payment_link_url;
  }
  out._billingMeta = billingMeta;

  return out;
}

export default function AppAssinatura() {
  const { user } = useAuth();
  const { company: activeCompany, companyId: activeCompanyId } = useCompany();
  const [loading] = useState(false);
  const [error, setError] = useState('');
  const [showUpdateCardModal, setShowUpdateCardModal] = useState(false);
  const { isImpersonating } = useImpersonation();
  const location = useLocation();
  const showUpgradeHighlight = new URLSearchParams(location.search).get('upgrade') === '1';

  const { data: fetchedCompany } = useQuery({
    queryKey: ['subscription-company-details', activeCompanyId, user?.email],
    queryFn: async () => {
      const resolvedId =
        (activeCompanyId && activeCompanyId !== 'comp_demo_01' ? activeCompanyId : null) ||
        (await resolveCompanyId({ company_id: activeCompanyId }));

      let baseCompany = null;

      if (isSupabaseConfigured && supabase) {
        if (resolvedId && resolvedId !== 'comp_demo_01') {
          const explicitRes = await supabase
            .from('companies')
            .select('id, name, card_last_digits, card_brand, trial_ends_at, asaas_subscription_id, asaas_customer_id, plan_name, subscription_status, billing_status, current_period_end, asaas_payment_link_url, owner_email, business_hours, created_at')
            .eq('id', resolvedId)
            .maybeSingle();

          if (!explicitRes.error && explicitRes.data) {
            baseCompany = enrichCompanyBillingFields(explicitRes.data);
          } else {
            const baseRes = await supabase
              .from('companies')
              .select('id, name, slug, logo_url, phone, owner_email, business_hours, created_at')
              .eq('id', resolvedId)
              .maybeSingle();

            if (!baseRes.error && baseRes.data) {
              baseCompany = enrichCompanyBillingFields(baseRes.data);
            }
          }
        }

        if (!baseCompany) {
          const { data: allRows } = await supabase
            .from('companies')
            .select('id, name, slug, logo_url, phone, owner_email, business_hours, created_at')
            .order('created_at', { ascending: false });

          if (Array.isArray(allRows) && allRows.length > 0) {
            const normalizedRows = allRows.map(enrichCompanyBillingFields);
            const byEmail =
              user?.email &&
              normalizedRows.find((c) => c.owner_email?.toLowerCase() === user.email.toLowerCase());
            const withSub = normalizedRows.find((c) => c.asaas_subscription_id || c.card_last_digits);
            baseCompany = byEmail || withSub || normalizedRows[0];
          }
        }
      }

      if (!baseCompany) {
        const list = await Company.list();
        const normalizedList = list.map(enrichCompanyBillingFields);
        baseCompany =
          normalizedList.find((c) => user?.email && c.owner_email?.toLowerCase() === user.email.toLowerCase()) ||
          normalizedList.find((c) => c.id === resolvedId) ||
          normalizedList.find((c) => c.asaas_subscription_id || c.card_last_digits) ||
          normalizedList[0] ||
          null;
      }

      // Sincroniza em tempo real com a API do Asaas se houver assinatura vinculada
      if (baseCompany && (baseCompany.asaas_subscription_id || baseCompany.id)) {
        try {
          const syncRes = await fetch('/api/asaas/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'sync',
              company_id: baseCompany.id,
              subscription_id: baseCompany.asaas_subscription_id,
              email: baseCompany.owner_email || user?.email,
            }),
          });
          if (syncRes.ok) {
            const syncJson = await syncRes.json().catch(() => null);
            if (syncJson?.company) {
              baseCompany = enrichCompanyBillingFields({
                ...baseCompany,
                ...syncJson.company,
              });
            }
          }
        } catch (_) {}
      }

      return baseCompany;
    },
  });

  const company = enrichCompanyBillingFields(fetchedCompany || activeCompany) || {};
  const planName = company.plan_name || 'Starter';
  const rawStatus = company.subscription_status || 'trialing';
  const billingStatus = String(company.billing_status || '').toUpperCase();
  const subStatusUpper = String(company.subscription_status || '').toUpperCase();

  // Verificação preventiva D+2 de falha de pagamento / OVERDUE
  const isOverdueOrFailed =
    billingStatus === 'OVERDUE' ||
    subStatusUpper === 'OVERDUE' ||
    rawStatus === 'past_due' ||
    rawStatus === 'unpaid' ||
    billingStatus === 'PAST_DUE' ||
    billingStatus === 'PAYMENT_FAILED';

  const hasCardOrSubscription = Boolean(company.card_last_digits || company.asaas_subscription_id);

  const getTrialEndDate = () => {
    if (company?.trial_ends_at) {
      const parsed = new Date(company.trial_ends_at);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (company?.created_at) {
      const created = new Date(company.created_at);
      if (!Number.isNaN(created.getTime())) {
        return new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }
    return null;
  };

  const trialEndDate = getTrialEndDate();

  const calculateDaysLeft = () => {
    const targetEnd = company?.trial_ends_at || (trialEndDate ? trialEndDate.toISOString() : null);
    if (!targetEnd) return null;
    const today = new Date();
    const end = new Date(targetEnd);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysLeft = calculateDaysLeft();

  // Se o período de teste já encerrou (daysLeft <= 0) e a barbearia possui cartão/assinatura ativa sem atraso,
  // ou se o status já foi atualizado para 'active' pela cobrança no cartão, a assinatura está ATIVA e paga.
  const isPaidOrRenewed =
    !isOverdueOrFailed &&
    (rawStatus === 'active' ||
      Boolean(company._billingMeta?.last_payment_id) ||
      (hasCardOrSubscription && daysLeft !== null && daysLeft <= 0));

  const isTrialActive =
    !isOverdueOrFailed &&
    !isPaidOrRenewed &&
    (rawStatus === 'trialing' || Boolean(company.trial_ends_at)) &&
    (daysLeft === null || daysLeft > 0);

  const formattedTrialEndDate = trialEndDate
    ? format(trialEndDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '';

  const getNextBillingDate = () => {
    if (company?.current_period_end) {
      const parsed = new Date(company.current_period_end);
      if (!Number.isNaN(parsed.getTime())) {
        // Se current_period_end era apenas a data do fim do trial que já passou e o plano já renovou, soma 1 mês
        if (isPaidOrRenewed && trialEndDate && Math.abs(parsed.getTime() - trialEndDate.getTime()) < 86400000) {
          const next = new Date(parsed);
          next.setMonth(next.getMonth() + 1);
          return next;
        }
        return parsed;
      }
    }
    if (isPaidOrRenewed && trialEndDate) {
      const next = new Date(trialEndDate);
      next.setMonth(next.getMonth() + 1);
      return next;
    }
    return null;
  };

  const nextBillingDate = getNextBillingDate();

  const getBadgeConfig = () => {
    if (isOverdueOrFailed) {
      return STATUS_LABEL.overdue;
    }
    if (isPaidOrRenewed) {
      return STATUS_LABEL.active;
    }
    if (isTrialActive && daysLeft !== null && daysLeft > 0) {
      return {
        label: `${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} de teste restantes`,
        color: 'bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/30',
      };
    }
    if (!hasCardOrSubscription && daysLeft !== null && daysLeft <= 0) {
      return {
        label: 'Teste expirado',
        color: 'bg-red-500/15 text-red-300 ring-1 ring-red-400/35',
      };
    }
    return STATUS_LABEL[rawStatus] || STATUS_LABEL.active;
  };

  const statusInfo = getBadgeConfig();

  const handleOpenInvoice = () => {
    if (company?.asaas_payment_link_url) {
      window.open(company.asaas_payment_link_url, '_blank', 'noopener');
    } else {
      setError('Fatura ainda não foi gerada. Verifique seu email ou aguarde a próxima cobrança automática no cartão.');
    }
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-3xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Assinatura"
          subtitle="Gerencie seu plano, cartão e faturas"
          icon={CreditCard}
        />

        {/* 4. Banner Preventivo de Falha de Pagamento (D+2) */}
        {isOverdueOrFailed && (
          <div className="rounded-2xl border border-amber-400/35 bg-amber-500/15 backdrop-blur-xl p-4 sm:p-5 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_8px_24px_rgba(245,158,11,0.18)]">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/35 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              </div>
              <p className="text-xs sm:text-sm text-amber-100 leading-relaxed font-medium">
                Não conseguimos processar a mensalidade no seu cartão registado. Atualize os dados do seu cartão para evitar pausas no agendamento online.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUpdateCardModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs whitespace-nowrap transition-all cursor-pointer self-start sm:self-center shadow-md"
            >
              Atualizar Cartão
            </button>
          </div>
        )}

        {/* Plan card */}
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 sm:p-6 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#2563EB]/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative flex items-start justify-between mb-4 gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1">Plano atual</div>
              <div className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                {planName}
              </div>
            </div>
            <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${statusInfo.color} whitespace-nowrap`}>
              {statusInfo.label}
            </span>
          </div>

          {/* 3. Card de Aviso de Cartão e Status da Assinatura */}
          {hasCardOrSubscription ? (
            <div className="space-y-3 mb-4">
              {isTrialActive && formattedTrialEndDate && (
                <div className="relative rounded-xl p-3.5 border text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 bg-blue-500/10 border-blue-400/25 text-blue-100/90">
                  <Zap className="w-4 h-4 text-[#60A5FA] flex-shrink-0 mt-0.5" />
                  <span>
                    O seu período de teste de 7 dias termina em{' '}
                    <strong className="text-white font-semibold">{formattedTrialEndDate}</strong>. A partir desta data, a renovação do plano será efetuada automaticamente no cartão indicado.
                  </span>
                </div>
              )}

              {isPaidOrRenewed && (
                <div className="relative rounded-xl p-3.5 border text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 bg-emerald-500/10 border-emerald-400/25 text-emerald-100/90">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Assinatura ativa e pagamento confirmado no cartão de crédito.
                    {nextBillingDate && (
                      <>
                        {' '}A próxima renovação automática ocorrerá em{' '}
                        <strong className="text-white font-semibold">
                          {format(nextBillingDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </strong>.
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Indicador visual do cartão registado */}
              <div className="relative flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 border border-emerald-400/25 px-3.5 py-3 text-xs sm:text-sm text-emerald-100 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-emerald-300" />
                  </div>
                  <span className="font-medium leading-snug">
                    Cartão de Crédito registado:{' '}
                    <strong className="text-white font-bold">
                      {company.card_brand || 'Cartão'}
                    </strong>{' '}
                    terminado em{' '}
                    <strong className="text-white font-bold">
                      {company.card_last_digits || '••••'}
                    </strong>{' '}
                    <span className="text-emerald-300 font-semibold">(Cobrança automática ativa)</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUpdateCardModal(true)}
                  className="text-xs font-bold text-[#93C5FD] hover:text-white underline cursor-pointer"
                >
                  Alterar cartão
                </button>
              </div>
            </div>
          ) : (
            <div className="relative rounded-xl p-3.5 mb-4 border bg-amber-500/10 border-amber-400/25 text-amber-100 text-xs sm:text-sm leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
              <span>
                Nenhum cartão cadastrado. Escolha um plano abaixo para manter o acesso.
              </span>
            </div>
          )}

          <div className="relative grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/8">
            {nextBillingDate && (
              <InfoRow
                icon={Calendar}
                label="Próxima cobrança"
                value={format(nextBillingDate, "d 'de' MMM, yyyy", { locale: ptBR })}
              />
            )}
            <InfoRow
              icon={CreditCard}
              label="Email de cobrança"
              value={company?.owner_email || user?.email}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-400/10 border border-red-400/30 text-red-300 text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {isImpersonating && (
          <div className="mb-4">
            <ImpersonationLockNotice message="Alterações de billing só podem ser feitas pelo dono da empresa." />
          </div>
        )}

        {/* 1. Card Próxima fatura (Sem menção a boleto no plano mensal) */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 sm:p-6 mb-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <h2 className="font-bold text-white mb-2">Próxima fatura</h2>
          <p className="text-sm text-white/55 mb-4 leading-relaxed">
            A sua assinatura é renovada de forma automática e segura no seu cartão de crédito através do Asaas, garantindo acesso contínuo aos seus agendamentos sem necessidade de emissão de boletos.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenInvoice}
              disabled={loading || !company?.asaas_payment_link_url || isImpersonating}
              className="inline-flex items-center gap-2 bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white font-bold py-3 px-5 rounded-xl text-sm ring-1 ring-white/15 transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:brightness-110 hover:shadow-[0_12px_32px_rgba(37,99,235,0.55)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:brightness-75"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir comprovante Asaas
            </button>

            <button
              type="button"
              onClick={() => setShowUpdateCardModal(true)}
              disabled={isImpersonating}
              className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 text-white font-bold py-3 px-5 rounded-xl text-sm transition-all cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-[#93C5FD]" />
              Atualizar Cartão
            </button>
          </div>
        </div>

        {/* 2. Destaque e Incentivo ao Plano Anual / Outros Planos */}
        {company?.id && (
          <div className="mb-4">
            <UpgradePlanCard currentPlanId={company.plan_id || planName.toLowerCase()} companyId={company.id} highlight={showUpgradeHighlight} />
          </div>
        )}

        {/* Sobre sua cobrança (Sem boleto) */}
        <div className="relative rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-transparent backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(37,99,235,0.15)] overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#60A5FA]/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative">
            <div className="text-[11px] font-semibold text-[#93C5FD] uppercase tracking-wider mb-3">Sobre sua cobrança</div>
            <div className="space-y-2">
              {[
                'Renovação mensal automática no cartão de crédito via Asaas',
                'Plano Anual com 20% OFF em até 12x no cartão ou à vista via Pix',
                'Recibos e comprovantes enviados automaticamente por email',
                'Trocar de plano ou cancelar: fale com o suporte a qualquer momento',
              ].map(t => (
                <div key={t} className="flex items-center gap-2 text-sm text-white/80">
                  <CheckCircle className="w-4 h-4 text-[#60A5FA] flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showUpdateCardModal && (
        <SaasPaymentModal
          isOpen={showUpdateCardModal}
          onClose={() => setShowUpdateCardModal(false)}
          plan={{
            id: company.plan_id || 'starter',
            name: planName,
            price_monthly: 49,
          }}
          cycle="monthly"
          companyId={company.id}
          onSuccess={() => {
            setTimeout(() => window.location.reload(), 800);
          }}
        />
      )}
    </AppLayout>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 bg-blue-400/12 ring-1 ring-blue-400/25 rounded-xl flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[#93C5FD]" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-white/50 font-semibold uppercase tracking-wider">{label}</div>
        <div className="text-sm font-semibold text-white truncate">{value}</div>
      </div>
    </div>
  );
}