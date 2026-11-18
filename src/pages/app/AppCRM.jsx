// Central de CRM & Retenção (/app/crm).
// Estrutura limpa com exatamente 2 abas:
//   1. Visão geral → KPIs de retenção + resumo dos últimos 7 dias + segmentos críticos
//   2. Lifecycle   → Distribuição atual + prazos de risco, inatividade e perda (CrmSettingsSection)

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/layout/AppLayout';
import AppPageHeader from '@/components/app/AppPageHeader';
import { useCompany } from '@/hooks/useCompany';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import {
  Sparkles,
  AlertCircle,
  Loader2,
  LayoutDashboard,
  Activity,
} from 'lucide-react';
import CRMOverviewTab from '@/components/crm/CRMOverviewTab';
import CRMLifecycleTab from '@/components/crm/CRMLifecycleTab';
import { safeArray } from '@/lib/safeArray';
import { useImpersonationPatch } from '@/hooks/useImpersonationToken';

const TABS = [
  { id: 'overview',  label: 'Visão geral', icon: LayoutDashboard },
  { id: 'lifecycle', label: 'Lifecycle',   icon: Activity },
];

// Redirecionamentos de compatibilidade para links antigos de ?tab=
const LEGACY_AUTOMATION_TABS = {
  automations: '/app/automacoes',
  campaigns:   '/app/automacoes',
  whatsapp:    '/app/automacoes?tab=whatsapp',
  history:     '/app/automacoes?tab=historico',
};

export default function AppCRM() {
  const { company, isLoading: loadingCompany } = useCompany();
  const { activeUnitId } = useActiveUnit();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const impPatch = useImpersonationPatch();

  const rawTabParam = searchParams.get('tab') || 'overview';

  useEffect(() => {
    if (LEGACY_AUTOMATION_TABS[rawTabParam]) {
      navigate(LEGACY_AUTOMATION_TABS[rawTabParam], { replace: true });
    }
  }, [rawTabParam, navigate]);

  const initialTab = TABS.some((t) => t.id === rawTabParam) ? rawTabParam : 'overview';
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (TABS.some((t) => t.id === rawTabParam) && rawTabParam !== tab) {
      setTab(rawTabParam);
    }
  }, [rawTabParam, tab]);

  const { data: messagesRaw } = useQuery({
    queryKey: ['whatsapp-messages', company?.id, activeUnitId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listWhatsAppMessages', {
        active_unit_id: activeUnitId,
        limit: 500,
        ...impPatch,
      });
      return res?.data?.messages ?? res?.data ?? [];
    },
    enabled: !!company?.id,
  });

  const { data: customersRaw } = useQuery({
    queryKey: ['customers-crm', company?.id, activeUnitId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listCustomers', {
        active_unit_id: activeUnitId,
        sort: '-last_appointment_at',
        limit: 1000,
        ...impPatch,
      });
      return res?.data?.customers ?? res?.data ?? [];
    },
    enabled: !!company?.id,
  });

  const messages = safeArray(messagesRaw);
  const customers = safeArray(customersRaw);

  const handleTabChange = (id) => {
    setTab(id);
    setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true });
  };

  if (loadingCompany) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout>
        <div className="p-8 max-w-xl mx-auto text-center">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.025] backdrop-blur-md p-8 shadow-sm">
            <AlertCircle className="w-10 h-10 text-amber-500 dark:text-amber-300 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Nenhuma empresa configurada</h2>
            <p className="text-sm text-slate-600 dark:text-white/60">Complete o onboarding para acessar o CRM.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto animate-fade-in">
        <AppPageHeader
          title="CRM & Retenção"
          subtitle="Visão geral dos retornos e configuração de prazos do ciclo de vida dos clientes"
          icon={Sparkles}
        />

        {/* Apenas 2 abas: Visão geral e Lifecycle */}
        <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-white/10 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabChange(t.id)}
                className={`px-3.5 sm:px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                  active
                    ? 'border-[#2563EB] dark:border-[#60A5FA] text-[#2563EB] dark:text-[#93C5FD]'
                    : 'border-transparent text-slate-500 dark:text-white/55 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'overview' && (
          <CRMOverviewTab companyId={company.id} customers={customers} messages={messages} />
        )}
        {tab === 'lifecycle' && (
          <CRMLifecycleTab company={company} customers={customers} />
        )}
      </div>
    </AppLayout>
  );
}