// Central única de CRM & Retenção.
// Substitui /app/retencao + as seções "CRM ciclo de vida" e "Automações de retenção"
// que ficavam em /app/configuracoes.
//
// 7 abas:
//   1. Visão geral   → KPIs + RetentionCampaignsCard + atalhos críticos
//   2. Lifecycle     → distribuição + janelas (CrmSettingsSection)
//   3. VIP           → sugestões automáticas + VIPs ativos
//   4. Automações    → 6 campanhas lifecycle (LifecycleCampaignsSection)
//   5. Campanhas     → mensagens transacionais (whatsapp_settings)
//   6. Segmentos     → atalhos para /app/clientes?filter=
//   7. Histórico     → tabela de WhatsAppMessage

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/layout/AppLayout';
import AppPageHeader from '@/components/app/AppPageHeader';
import { useCompany } from '@/hooks/useCompany';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import {
  Sparkles, Zap, AlertCircle, Loader2,
  LayoutDashboard, Activity, Crown, Send, Layers, History, Smartphone,
} from 'lucide-react';

import CRMOverviewTab from '@/components/crm/CRMOverviewTab';
import CRMLifecycleTab from '@/components/crm/CRMLifecycleTab';
import CRMVipTab from '@/components/crm/CRMVipTab';
import CRMSegmentsTab from '@/components/crm/CRMSegmentsTab';
import CRMHistoryTab from '@/components/crm/CRMHistoryTab';
import CRMTransactionalTab from '@/components/crm/CRMTransactionalTab';
import CRMWhatsAppTab from '@/components/crm/CRMWhatsAppTab';
import LifecycleCampaignsSection from '@/components/configuracoes/LifecycleCampaignsSection';
import { safeArray } from '@/lib/safeArray';

const TABS = [
  { id: 'overview',     label: 'Visão geral', icon: LayoutDashboard },
  { id: 'lifecycle',    label: 'Lifecycle',   icon: Activity },
  { id: 'vip',          label: 'VIP',         icon: Crown },
  { id: 'automations',  label: 'Automações',  icon: Zap },
  { id: 'campaigns',    label: 'Campanhas',   icon: Send },
  { id: 'segments',     label: 'Segmentos',   icon: Layers },
  { id: 'history',      label: 'Histórico',   icon: History },
  { id: 'whatsapp',    label: 'WhatsApp',    icon: Smartphone },
];

export default function AppCRM() {
  const { company, isLoading: loadingCompany } = useCompany();
  const { activeUnitId } = useActiveUnit();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [tab, setTab] = useState(TABS.some(t => t.id === initialTab) ? initialTab : 'overview');

  // BFF Fase 4: WhatsAppMessage via listWhatsAppMessages (tenant + unit scope server-side).
  // O unit scope é aplicado no servidor — não precisamos mais do filtro manual abaixo.
  const { data: messagesRaw } = useQuery({
    queryKey: ['whatsapp-messages', company?.id, activeUnitId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listWhatsAppMessages', {
        active_unit_id: activeUnitId,
        limit: 500,
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
          <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout>
        <div className="p-8 max-w-xl mx-auto text-center">
          <div className="bg-white rounded-2xl border border-black/8 p-8">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-[#1B1C1E] mb-2">Nenhuma empresa configurada</h2>
            <p className="text-sm text-gray-500">Complete o onboarding para acessar o CRM.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="CRM & Retenção"
          subtitle="Lifecycle, VIP, automações e campanhas — tudo em um só lugar"
          icon={Sparkles}
        />

        {/* Tabs — scroll horizontal no mobile, sem quebrar */}
        <div className="flex gap-1 mb-6 border-b border-black/5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`px-3 sm:px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                  active ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-gray-500 hover:text-gray-800'
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
        {tab === 'vip' && (
          <CRMVipTab companyId={company.id} customers={customers} />
        )}
        {tab === 'automations' && (
          <LifecycleCampaignsSection company={company} />
        )}
        {tab === 'campaigns' && (
          <CRMTransactionalTab company={company} />
        )}
        {tab === 'segments' && (
          <CRMSegmentsTab customers={customers} />
        )}
        {tab === 'history' && (
          <CRMHistoryTab messages={messages} />
        )}
        {tab === 'whatsapp' && (
          <CRMWhatsAppTab />
        )}
      </div>
    </AppLayout>
  );
}