// MasterCompanyDetail — Central de Clientes 360°.
// Header rico + barra de ações + abas (Geral · Financeiro · Pagamentos · Histórico · Funcionalidades).
// Rota: /master/barbearias/:id
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import { ArrowLeft, Building2, DollarSign, Wallet, Activity, Layers } from 'lucide-react';
import CompanyFeatureOverrides from '@/components/master/CompanyFeatureOverrides';
import Company360Header from '@/components/master/company/Company360Header';
import Company360ActionBar from '@/components/master/company/Company360ActionBar';
import Company360Overview from '@/components/master/company/Company360Overview';
import Company360Financial from '@/components/master/company/Company360Financial';
import Company360Payments from '@/components/master/company/Company360Payments';
import Company360History from '@/components/master/company/Company360History';

const TABS = [
  { key: 'overview',   label: 'Visão geral',     icon: Building2 },
  { key: 'financial',  label: 'Financeiro',      icon: DollarSign },
  { key: 'payments',   label: 'Pagamentos',      icon: Wallet },
  { key: 'history',    label: 'Histórico',       icon: Activity },
  { key: 'features',   label: 'Funcionalidades', icon: Layers },
];

export default function MasterCompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['master-company-360', id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCompany360', { company_id: id });
      return res.data;
    },
    enabled: !!id,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Carregando…</div>;
  }

  if (!data?.success || !data.company) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted-foreground text-sm">Empresa não encontrada.</div>
        <button onClick={() => navigate('/master/barbearias')} className="mt-3 text-sm text-[#2563EB] font-semibold hover:underline">
          Voltar para barbearias
        </button>
      </div>
    );
  }

  const { company, plan, counters, financial, audit_log, last_activity } = data;

  return (
    <div className="space-y-5">
      {/* Voltar */}
      <button onClick={() => navigate('/master/barbearias')} className="text-xs text-muted-foreground hover:text-[#2563EB] inline-flex items-center gap-1 font-medium">
        <ArrowLeft className="w-3.5 h-3.5" /> Barbearias
      </button>

      {/* Header rico */}
      <Company360Header
        company={company}
        plan={plan}
        counters={counters}
        financial={financial}
        lastActivity={last_activity}
      />

      {/* Action bar */}
      <Company360ActionBar company={company} onPlanChanged={refetch} />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview'  && <Company360Overview company={company} plan={plan} />}
      {tab === 'financial' && <Company360Financial company={company} plan={plan} counters={counters} financial={financial} />}
      {tab === 'payments'  && <Company360Payments company={company} />}
      {tab === 'history'   && <Company360History logs={audit_log} />}
      {tab === 'features'  && <CompanyFeatureOverrides company={company} plan={plan} />}
    </div>
  );
}