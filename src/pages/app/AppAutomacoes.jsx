// Central unificada de Automações & Campanhas de WhatsApp (/app/automacoes).
// Concentra exclusivamente:
//   - Ativação das campanhas de disparo (boas-vindas, reativação, VIP, fidelização) e modelos
//   - Parâmetros centralizados de envio (janela de envio, link de avaliação) + mensagens transacionais
//   - Conexão WhatsApp (Evolution API) e Histórico de envios

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/layout/AppLayout';
import AppPageHeader from '@/components/app/AppPageHeader';
import { useCompany } from '@/hooks/useCompany';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { useFeatures } from '@/hooks/useFeatures';
import { useImpersonationPatch } from '@/hooks/useImpersonationToken';
import { safeArray } from '@/lib/safeArray';
import {
  Send,
  Smartphone,
  History,
  AlertCircle,
  Loader2,
  Activity,
  ArrowRight,
} from 'lucide-react';
import LifecycleCampaignsSection from '@/components/configuracoes/LifecycleCampaignsSection';
import CRMTransactionalTab from '@/components/crm/CRMTransactionalTab';
import CRMWhatsAppTab from '@/components/crm/CRMWhatsAppTab';
import CRMHistoryTab from '@/components/crm/CRMHistoryTab';

const TABS = [
  { id: 'campanhas', label: 'Campanhas & Modelos', icon: Send },
  { id: 'whatsapp', label: 'Conexão WhatsApp', icon: Smartphone },
  { id: 'historico', label: 'Histórico de Envios', icon: History },
];

export default function AppAutomacoes() {
  const { company, isLoading: loadingCompany } = useCompany();
  const { activeUnitId } = useActiveUnit();
  const { has } = useFeatures();
  const [searchParams, setSearchParams] = useSearchParams();
  const impPatch = useImpersonationPatch();

  const initialTab = searchParams.get('tab') || 'campanhas';
  const [tab, setTab] = useState(TABS.some((t) => t.id === initialTab) ? initialTab : 'campanhas');

  useEffect(() => {
    const paramTab = searchParams.get('tab');
    if (paramTab && TABS.some((t) => t.id === paramTab) && paramTab !== tab) {
      setTab(paramTab);
    }
  }, [searchParams, tab]);

  const hasLifecycleCampaigns = has('lifecycle_automation') || has('crm_retention');

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
    enabled: !!company?.id && tab === 'historico',
  });

  const messages = safeArray(messagesRaw);

  const handleTabChange = (id) => {
    setTab(id);
    setSearchParams(id === 'campanhas' ? {} : { tab: id }, { replace: true });
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
            <p className="text-sm text-slate-600 dark:text-white/60">Complete o onboarding para configurar campanhas de WhatsApp.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Automações & Campanhas de WhatsApp"
          subtitle="Ative campanhas de disparo (boas-vindas, reativação, VIP), modelos e parâmetros centralizados de envio"
          icon={Send}
          action={
            hasLifecycleCampaigns && (
              <Link
                to="/app/crm?tab=lifecycle"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-white/80 transition-colors shadow-sm"
              >
                <Activity className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                <span>Prazos de Lifecycle</span>
                <ArrowRight className="w-3 h-3 text-slate-400 dark:text-white/40" />
              </Link>
            )
          }
        />

        {/* Abas enxutas e diretas */}
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

        {tab === 'campanhas' && (
          <div className="space-y-6">
            {/* 1. Parâmetros centralizados (janela de envio, link de avaliação) + Mensagens Transacionais */}
            <CRMTransactionalTab company={company} hasLifecycleLink={hasLifecycleCampaigns} />

            {/* 2. Campanhas de Disparo por Ciclo de Vida (boas-vindas, reativação, VIP, fidelização) */}
            {hasLifecycleCampaigns && (
              <LifecycleCampaignsSection
                company={company}
                title="Campanhas de Disparo Automático (Boas-vindas, Reativação & VIP)"
                subtitle="Ative e personalize os modelos de mensagem disparados conforme o ciclo de vida do cliente."
              />
            )}
          </div>
        )}

        {tab === 'whatsapp' && <CRMWhatsAppTab company={company} />}
        {tab === 'historico' && <CRMHistoryTab messages={messages} />}
      </div>
    </AppLayout>
  );
}
