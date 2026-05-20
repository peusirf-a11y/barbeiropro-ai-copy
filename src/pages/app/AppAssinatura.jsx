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
  trialing: { label: 'Em período grátis', color: 'bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/30' },
  active: { label: 'Ativa', color: 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30' },
  past_due: { label: 'Pagamento atrasado', color: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30' },
  canceled: { label: 'Cancelada', color: 'bg-red-400/15 text-red-300 ring-1 ring-red-400/30' },
  unpaid: { label: 'Não paga', color: 'bg-red-400/15 text-red-300 ring-1 ring-red-400/30' },
  incomplete: { label: 'Incompleta', color: 'bg-white/10 text-white/70 ring-1 ring-white/15' },
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
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 sm:p-6 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#2563EB]/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative flex items-start justify-between mb-4 gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1">Plano atual</div>
              <div className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{company?.plan_name || 'Starter'}</div>
            </div>
            <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${statusInfo.color} whitespace-nowrap`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="relative grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/8">
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
          <div className="bg-red-400/10 border border-red-400/30 text-red-300 text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {isImpersonating && (
          <div className="mb-4">
            <ImpersonationLockNotice message="Alterações de billing (cartão, plano, cancelamento) só podem ser feitas pelo dono da empresa via portal Stripe." />
          </div>
        )}

        {/* Action card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 sm:p-6 mb-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <h2 className="font-bold text-white mb-2">Gerenciar assinatura</h2>
          <p className="text-sm text-white/55 mb-4 leading-relaxed">
            Acesse o portal seguro do Stripe para atualizar seu cartão, baixar faturas, mudar de plano ou cancelar a assinatura.
          </p>

          <button
            onClick={handleOpenPortal}
            disabled={loading || !company?.stripe_customer_id || isImpersonating}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white font-bold py-3 px-5 rounded-xl text-sm ring-1 ring-white/15 transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:brightness-110 hover:shadow-[0_12px_32px_rgba(37,99,235,0.55)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:brightness-75"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {loading ? 'Abrindo...' : 'Gerenciar assinatura'}
          </button>

          {!company?.stripe_customer_id && (
            <p className="text-xs text-white/50 mt-3">
              Sua conta ainda não está vinculada a um plano pago. Adquira um plano para gerenciar pelo portal.
            </p>
          )}
        </div>

        {/* Upgrade / outros planos */}
        {company?.id && (
          <div className="mb-4">
            <UpgradePlanCard currentPlanId={company.plan_id} companyId={company.id} highlight={showUpgradeHighlight} />
          </div>
        )}

        {/* What you can do */}
        <div className="relative rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-transparent backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(37,99,235,0.15)] overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#60A5FA]/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative">
            <div className="text-[11px] font-semibold text-[#93C5FD] uppercase tracking-wider mb-3">No portal você pode</div>
            <div className="space-y-2">
              {[
                'Atualizar cartão de crédito',
                'Ver e baixar todas as faturas',
                'Mudar de plano (upgrade ou downgrade)',
                'Cancelar a assinatura quando quiser',
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