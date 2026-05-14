// KPIs do dashboard de auditoria
import { Shield, AlertTriangle, MessageSquare, Users, Zap, Activity } from 'lucide-react';
import { useMemo } from 'react';

const now = () => Date.now();
const H24 = 24 * 60 * 60 * 1000;

export default function AuditKpiCards({ logs = [] }) {
  const kpis = useMemo(() => {
    const cutoff = now() - H24;
    const recent = logs.filter(l => new Date(l.created_date).getTime() >= cutoff);
    return {
      total24h: recent.length,
      criticals: logs.filter(l => l.severity === 'critical').length,
      whatsappFailed: logs.filter(l => l.action === 'WHATSAPP_FAILED').length,
      impersonations: logs.filter(l =>
        l.action === 'START_IMPERSONATION' || l.action === 'IMPERSONATION_STARTED'
      ).length,
      crossTenant: logs.filter(l => l.action === 'CROSS_TENANT_ATTEMPT').length,
      permDenied: logs.filter(l => l.action === 'PERMISSION_DENIED').length,
    };
  }, [logs]);

  const cards = [
    { label: 'Ações (24h)', value: kpis.total24h, icon: Activity, color: 'bg-blue-50 text-blue-600' },
    { label: 'Críticos', value: kpis.criticals, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { label: 'Falhas WhatsApp', value: kpis.whatsappFailed, icon: MessageSquare, color: 'bg-orange-50 text-orange-600' },
    { label: 'Impersonações', value: kpis.impersonations, icon: Shield, color: 'bg-purple-50 text-purple-600' },
    { label: 'Cross-tenant', value: kpis.crossTenant, icon: Zap, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Perm. negadas', value: kpis.permDenied, icon: Users, color: 'bg-gray-50 text-gray-600' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-2xl border border-black/5 p-4 shadow-[var(--shadow-sm)]">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
            <c.icon className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-[#111827]">{c.value}</div>
          <div className="text-[11px] text-[#6B7280] mt-0.5 font-medium">{c.label}</div>
        </div>
      ))}
    </div>
  );
}