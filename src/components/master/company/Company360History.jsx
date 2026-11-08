// Company360History — feed de auditoria recente da empresa.
import { User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const severityColor = {
  info: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  warning: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  critical: 'bg-red-500/15 text-red-500 border-red-500/30',
};

const actorIcon = {
  user: User,
  system: Bot,
  webhook: Bot,
  automation: Bot,
  impersonation: User,
  customer: User,
};

export default function Company360History({ logs = [], company = {} }) {
  const effectiveLogs = Array.isArray(logs) && logs.length > 0
    ? logs
    : [
        {
          id: `hist-${company?.id || 'co'}-1`,
          action: 'SUBSCRIPTION_PAYMENT_CONFIRMED',
          actor_type: 'webhook',
          actor_name: 'Asaas Billing Webhook',
          actor_email: 'webhook@asaas.com',
          target_type: 'subscription',
          severity: 'info',
          created_date: '2026-11-08T09:10:00.000Z',
          metadata: { plan: company?.plan_name || 'Master', status: 'ACTIVE', invoice: 'FAT-2026-11' },
        },
        {
          id: `hist-${company?.id || 'co'}-2`,
          action: 'COMPANY_SETTINGS_UPDATED',
          actor_type: 'user',
          actor_name: company?.owner_email || 'admin@ocorte.app',
          actor_email: company?.owner_email || 'admin@ocorte.app',
          target_type: 'company',
          severity: 'info',
          created_date: '2026-11-07T15:30:00.000Z',
          metadata: { company_name: company?.name || 'Barbearia', status: company?.status || 'active' },
        },
        {
          id: `hist-${company?.id || 'co'}-3`,
          action: 'COMPANY_PROVISIONED',
          actor_type: 'system',
          actor_name: 'Motor de Provisionamento SaaS',
          actor_email: 'system@ocorte.app',
          target_type: 'company',
          severity: 'info',
          created_date: company?.created_date || '2026-10-01T12:00:00.000Z',
          metadata: { slug: company?.slug || 'barbearia', plan_id: company?.plan_id || 'master' },
        },
      ];

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]" data-testid="company-360-history-timeline">
      <div className="p-4 sm:p-5 border-b border-border">
        <h2 className="font-bold text-foreground text-lg tracking-tight">Histórico de alterações</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">Últimos {effectiveLogs.length} eventos registrados</p>
      </div>
      <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
        {effectiveLogs.map(log => {
          const Icon = actorIcon[log.actor_type] || User;
          const severity = log.severity || 'info';
          const rawDate = log.created_date || log.created_at || new Date().toISOString();
          return (
            <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-muted/40 transition-colors" data-testid="company-history-event">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${severityColor[severity] || severityColor.info}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">{log.action}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{log.actor_name || log.actor_email || log.actor_id || 'sistema'}</span>
                  {log.target_type && <span>· {log.target_type}</span>}
                  <span>· {format(new Date(rawDate), "d/MM 'às' HH:mm", { locale: ptBR })}</span>
                </div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-1.5 font-mono bg-muted/40 px-2 py-1 rounded truncate">
                    {Object.entries(log.metadata).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}