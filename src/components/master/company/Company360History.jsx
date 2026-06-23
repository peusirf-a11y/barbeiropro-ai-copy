// Company360History — feed de auditoria recente da empresa.
import { Activity, User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const severityColor = {
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const actorIcon = {
  user: User,
  system: Bot,
  webhook: Bot,
  automation: Bot,
  impersonation: User,
  customer: User,
};

export default function Company360History({ logs = [] }) {
  if (logs.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-[var(--shadow-sm)]">
        <Activity className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <div className="text-sm font-semibold text-foreground">Nenhum evento registrado</div>
        <div className="text-xs text-muted-foreground mt-1">As últimas ações da empresa aparecem aqui.</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-border">
        <h2 className="font-bold text-foreground text-lg tracking-tight">Histórico de alterações</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">Últimos {logs.length} eventos registrados</p>
      </div>
      <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
        {logs.map(log => {
          const Icon = actorIcon[log.actor_type] || User;
          const severity = log.severity || 'info';
          return (
            <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-muted/40 transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${severityColor[severity] || severityColor.info}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">{log.action}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{log.actor_name || log.actor_email || log.actor_id || 'sistema'}</span>
                  {log.target_type && <span>· {log.target_type}</span>}
                  <span>· {format(new Date(log.created_date), "d/MM 'às' HH:mm", { locale: ptBR })}</span>
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