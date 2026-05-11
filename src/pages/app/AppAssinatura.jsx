import AppLayout from '@/components/layout/AppLayout';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { CreditCard, CheckCircle, Loader2, ExternalLink, Calendar, Zap } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useImpersonation } from '@/hooks/useImpersonation';
import ImpersonationLockNotice from '@/components/ImpersonationLockNotice';
import UpgradePlanCard from '@/components/billing/UpgradePlanCard';

const STATUS_LABEL = {
  trialing: { label: 'Em período grátis', color: 'bg-blue-50 text-blue-700' },
  active: { label: 'Ativa', color: 'bg-emerald-50 text-emerald-700' },
  past_due: { label: 'Pagamento atrasado', color: 'bg-amber-50 text-amber-700' },
  canceled: { label: 'Cancelada', color: 'bg-red-50 text-red-700' },
  unpaid: { label: 'Não paga', color: 'bg-red-50 text-red-700' },
  incomplete: { label: 'Incompleta', color: 'bg-gray-100 text-gray-700' },
};

export default function AppAssinatura() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isImpersonating } = useImpersonation();
  const location = useLocation();
  const showUpgradeHighlight = new URLSearchParams(location.search).get('upgrade') === '1';

  const { data: companies = [] } = useQuery({
    queryKey: ['my-companies', user?.email],
    queryFn: () => base44.entities.Company.list(),
    enabled: !!user?.email,
  });

  const company = companies.find(c => c.owner_email === user?.email) || companies[0];
  const status = company?.subscription_status || 'trialing';
  const statusInfo = STATUS_LABEL[status] || STATUS_LABEL.trialing;

  const handleOpenPortal = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('createCustomerPortalSession', {
        return_url: `${window.location.origin}/app/configuracoes/assinatura`,
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError(data?.error || 'Erro ao abrir portal');
        setLoading(false);
      }
    } catch (err) {
      // Axios joga 4xx em catch — pega o payload do backend.
      const payload = err?.response?.data;
      setError(payload?.error || err.message || 'Erro ao abrir portal');
      setLoading(false);
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

        {/* Plan card */}
        <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 mb-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Plano atual</div>
              <div className="text-2xl font-black text-[#111827] tracking-tight">{company?.plan_name || 'Starter'}</div>
            </div>
            <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${statusInfo.color} whitespace-nowrap`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-black/5">
            {company?.trial_ends_at && status === 'trialing' && (
              <InfoRow
                icon={Zap}
                label="Trial termina em"
                value={format(new Date(company.trial_ends_at), "d 'de' MMM", { locale: ptBR })}
              />
            )}
            {company?.current_period_end && (
              <InfoRow
                icon={Calendar}
                label="Próxima cobrança"
                value={format(new Date(company.current_period_end), "d 'de' MMM, yyyy", { locale: ptBR })}
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
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {isImpersonating && (
          <div className="mb-4">
            <ImpersonationLockNotice message="Alterações de billing (cartão, plano, cancelamento) só podem ser feitas pelo dono da empresa via portal Stripe." />
          </div>
        )}

        {/* Action card */}
        <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 mb-4 shadow-[var(--shadow-sm)]">
          <h2 className="font-bold text-[#111827] mb-2">Gerenciar assinatura</h2>
          <p className="text-sm text-[#6B7280] mb-4 leading-relaxed">
            Acesse o portal seguro do Stripe para atualizar seu cartão, baixar faturas, mudar de plano ou cancelar a assinatura.
          </p>

          <button
            onClick={handleOpenPortal}
            disabled={loading || !company?.stripe_customer_id || isImpersonating}
            className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold py-3 px-5 rounded-xl text-sm transition-all shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {loading ? 'Abrindo...' : 'Gerenciar assinatura'}
          </button>

          {!company?.stripe_customer_id && (
            <p className="text-xs text-[#6B7280] mt-3">
              Sua conta ainda não está vinculada a um plano pago. Adquira um plano para gerenciar pelo portal.
            </p>
          )}
        </div>

        {/* Upgrade / outros planos */}
        {company?.id && (
          <div className="mb-4">
            <UpgradePlanCard currentPlanId={company.plan_id} highlight={showUpgradeHighlight} />
          </div>
        )}

        {/* What you can do */}
        <div className="bg-gradient-to-br from-[#EFF6FF] to-white border border-[#DBEAFE] rounded-2xl p-5 shadow-[var(--shadow-sm)]">
          <div className="text-[11px] font-semibold text-[#2563EB] uppercase tracking-wider mb-3">No portal você pode</div>
          <div className="space-y-2">
            {[
              'Atualizar cartão de crédito',
              'Ver e baixar todas as faturas',
              'Mudar de plano (upgrade ou downgrade)',
              'Cancelar a assinatura quando quiser',
            ].map(t => (
              <div key={t} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 bg-[#EFF6FF] ring-1 ring-[#DBEAFE] rounded-xl flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[#2563EB]" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-[#6B7280] font-semibold uppercase tracking-wider">{label}</div>
        <div className="text-sm font-semibold text-[#111827] truncate">{value}</div>
      </div>
    </div>
  );
}