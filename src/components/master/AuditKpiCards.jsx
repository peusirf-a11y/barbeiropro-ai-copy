// KPIs de Incidentes (24h) do Dashboard de Auditoria
import { Shield, AlertTriangle, MessageSquare, Users, Zap, Activity } from 'lucide-react';
import { useMemo } from 'react';

const H24 = 24 * 60 * 60 * 1000;

export default function AuditKpiCards({ logs = [], kpis: serverKpis = null, activeFilters = {}, onQuickFilter }) {
  const computedKpis = useMemo(() => {
    if (serverKpis && typeof serverKpis.total24h === 'number') {
      return serverKpis;
    }
    const cutoff = Date.now() - H24;
    const recent = logs.filter((l) => {
      const rawDate = l.created_at || l.created_date;
      const t = rawDate ? new Date(rawDate).getTime() : NaN;
      return !Number.isNaN(t) && t >= cutoff;
    });
    return {
      total24h: recent.length,
      criticals: logs.filter((l) => l.severity === 'critical').length,
      whatsappFailed: logs.filter((l) => l.action === 'WHATSAPP_FAILED').length,
      impersonations: logs.filter(
        (l) =>
          l.action === 'START_IMPERSONATION' ||
          l.action === 'END_IMPERSONATION' ||
          l.action === 'IMPERSONATION_STARTED'
      ).length,
      crossTenant: logs.filter((l) => l.action === 'CROSS_TENANT_ATTEMPT').length,
      permDenied: logs.filter((l) => l.action === 'PERMISSION_DENIED').length,
    };
  }, [logs, serverKpis]);

  const cards = [
    {
      key: 'all24h',
      label: 'Ações (24h)',
      value: computedKpis.total24h,
      icon: Activity,
      color: 'bg-blue-500/15 text-blue-500',
      isActive: false,
      onClick: () => onQuickFilter && onQuickFilter({}),
    },
    {
      key: 'critical',
      label: 'Críticos',
      value: computedKpis.criticals,
      icon: AlertTriangle,
      color: 'bg-red-500/15 text-red-500',
      isActive: activeFilters.severity === 'critical',
      onClick: () =>
        onQuickFilter &&
        onQuickFilter({
          ...activeFilters,
          severity: activeFilters.severity === 'critical' ? '' : 'critical',
        }),
    },
    {
      key: 'whatsapp',
      label: 'Falhas WhatsApp',
      value: computedKpis.whatsappFailed,
      icon: MessageSquare,
      color: 'bg-orange-500/15 text-orange-500',
      isActive: activeFilters.action === 'WHATSAPP_FAILED',
      onClick: () =>
        onQuickFilter &&
        onQuickFilter({
          ...activeFilters,
          action: activeFilters.action === 'WHATSAPP_FAILED' ? '' : 'WHATSAPP_FAILED',
        }),
    },
    {
      key: 'impersonation',
      label: 'Impersonações',
      value: computedKpis.impersonations,
      icon: Shield,
      color: 'bg-purple-500/15 text-purple-500',
      isActive: activeFilters.action === 'START_IMPERSONATION',
      onClick: () =>
        onQuickFilter &&
        onQuickFilter({
          ...activeFilters,
          action: activeFilters.action === 'START_IMPERSONATION' ? '' : 'START_IMPERSONATION',
        }),
    },
    {
      key: 'crosstenant',
      label: 'Cross-tenant',
      value: computedKpis.crossTenant,
      icon: Zap,
      color: 'bg-yellow-500/15 text-yellow-500',
      isActive: activeFilters.action === 'CROSS_TENANT_ATTEMPT',
      onClick: () =>
        onQuickFilter &&
        onQuickFilter({
          ...activeFilters,
          action: activeFilters.action === 'CROSS_TENANT_ATTEMPT' ? '' : 'CROSS_TENANT_ATTEMPT',
        }),
    },
    {
      key: 'permdenied',
      label: 'Perm. negadas',
      value: computedKpis.permDenied,
      icon: Users,
      color: 'bg-muted text-muted-foreground',
      isActive: activeFilters.action === 'PERMISSION_DENIED',
      onClick: () =>
        onQuickFilter &&
        onQuickFilter({
          ...activeFilters,
          action: activeFilters.action === 'PERMISSION_DENIED' ? '' : 'PERMISSION_DENIED',
        }),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onClick}
          className={`text-left bg-card rounded-2xl border p-4 shadow-[var(--shadow-sm)] transition-all cursor-pointer hover:border-[#2563EB]/50 ${
            c.isActive ? 'border-[#2563EB] ring-1 ring-[#2563EB]/30' : 'border-border'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
            <c.icon className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-foreground">{c.value}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">{c.label}</div>
        </button>
      ))}
    </div>
  );
}