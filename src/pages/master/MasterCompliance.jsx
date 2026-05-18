// MasterCompliance — Centro de Governança, LGPD, Auditoria e Compliance do SaaS.
// Exclusivo do Super Admin. Visual enterprise (Stripe/Vercel/Datadog style).

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ComplianceDashboard from '@/components/master/compliance/ComplianceDashboard';
import ComplianceConsents from '@/components/master/compliance/ComplianceConsents';
import ComplianceAudit from '@/components/master/compliance/ComplianceAudit';
import ComplianceExports from '@/components/master/compliance/ComplianceExports';
import ComplianceAnonymizations from '@/components/master/compliance/ComplianceAnonymizations';
import ComplianceImpersonations from '@/components/master/compliance/ComplianceImpersonations';
import ComplianceSecurity from '@/components/master/compliance/ComplianceSecurity';
import ComplianceRetention from '@/components/master/compliance/ComplianceRetention';
import {
  LayoutDashboard, Users, Activity, Download, UserX,
  UserCog, ShieldCheck, Database, Cookie, AlertOctagon,
} from 'lucide-react';

const TABS = [
  { key: 'dashboard',      label: 'Dashboard',        icon: LayoutDashboard },
  { key: 'consents',       label: 'Consentimentos',   icon: Users },
  { key: 'audit',          label: 'Auditoria',        icon: Activity },
  { key: 'exports',        label: 'Exportações',      icon: Download },
  { key: 'anonymizations', label: 'Anonimizações',    icon: UserX },
  { key: 'impersonations', label: 'Impersonações',    icon: UserCog },
  { key: 'security',       label: 'Segurança',        icon: ShieldCheck },
  { key: 'retention',      label: 'Retenção de Dados',icon: Database },
];

export default function MasterCompliance() {
  const [tab, setTab] = useState('dashboard');

  // Dados base compartilhados entre abas
  const { data: companies = [] } = useQuery({
    queryKey: ['mc-companies'],
    queryFn: () => base44.entities.Company.list('-created_date', 500),
    staleTime: 5 * 60_000,
  });

  const { data: privacyLogs = [], isLoading: loadingPrivacy } = useQuery({
    queryKey: ['mc-privacy-logs'],
    queryFn: () => base44.entities.PrivacyAuditLog.list('-created_date', 500),
    staleTime: 60_000,
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ['mc-audit-logs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 500),
    staleTime: 60_000,
  });

  const { data: consents = [], isLoading: loadingConsents } = useQuery({
    queryKey: ['mc-consents'],
    queryFn: () => base44.entities.CustomerConsent.list('-created_date', 1000),
    staleTime: 60_000,
  });

  const { data: cookieLogs = [] } = useQuery({
    queryKey: ['mc-cookie-logs'],
    queryFn: () => base44.entities.CookieConsentLog.list('-created_date', 500),
    staleTime: 60_000,
  });

  const shared = { companies, privacyLogs, auditLogs, consents, cookieLogs, loadingPrivacy, loadingAudit, loadingConsents };

  const ActiveTab = {
    dashboard:      <ComplianceDashboard {...shared} />,
    consents:       <ComplianceConsents {...shared} />,
    audit:          <ComplianceAudit {...shared} />,
    exports:        <ComplianceExports {...shared} />,
    anonymizations: <ComplianceAnonymizations {...shared} />,
    impersonations: <ComplianceImpersonations {...shared} />,
    security:       <ComplianceSecurity {...shared} />,
    retention:      <ComplianceRetention {...shared} />,
  }[tab];

  return (
    <div className="space-y-0 animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center shadow-md">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Compliance & LGPD</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Governança · Auditoria · Privacidade · Segurança · Rastreabilidade</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 overflow-x-auto pb-0 mb-6 border-b border-border scrollbar-hide">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
              tab === t.key
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>{ActiveTab}</div>
    </div>
  );
}