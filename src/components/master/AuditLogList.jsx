// Lista enxuta de ações recentes do Master (audit trail) — versão BFF.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const SEVERITY_BADGE = {
  critical: 'text-red-500 bg-red-500/15 border border-red-500/30',
  warning: 'text-amber-500 bg-amber-500/15 border border-amber-500/30',
  info: 'text-blue-500 bg-blue-500/15 border border-blue-500/30',
};

const ACTION_LABELS = {
  BLOCK_COMPANY: 'Bloqueou empresa',
  ACTIVATE_COMPANY: 'Ativou empresa',
  START_IMPERSONATION: 'Iniciou impersonação',
  END_IMPERSONATION: 'Encerrou impersonação',
  IMPERSONATION_STARTED: 'Iniciou impersonação',
  IMPERSONATION_ENDED: 'Encerrou impersonação',
  CROSS_TENANT_ATTEMPT: 'Tentativa cross-tenant',
  PERMISSION_DENIED: 'Permissão negada',
  STRIPE_ENV_MISMATCH: 'Stripe env mismatch',
  DELETE_COMPANY: 'Deletou empresa',
  WHATSAPP_FAILED: 'Falha WhatsApp',
};

export default function AuditLogList() {
  const { data, isLoading } = useQuery({
    queryKey: ['master-audit-log-widget'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listAuditLogs', { limit: 30 });
      return res.data?.logs || [];
    },
  });

  const logs = data || [];

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-blue-500" />
          </div>
          <h2 className="font-bold text-foreground text-lg tracking-tight">
            Log de auditoria <span className="text-xs font-medium text-muted-foreground">(últimas 30)</span>
          </h2>
        </div>
        <Link
          to="/master/auditoria"
          className="flex items-center gap-1 text-xs text-blue-500 hover:underline font-medium"
        >
          Ver tudo <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && logs.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma ação registrada ainda.</div>
        )}
        {logs.map(l => {
          const label = ACTION_LABELS[l.action] || l.action;
          const badgeCls = SEVERITY_BADGE[l.severity] || SEVERITY_BADGE.info;
          return (
            <div key={l.id} className="p-4 flex items-start gap-3 text-sm hover:bg-muted/40 transition-colors">
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${badgeCls}`}>
                {label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-foreground truncate">
                  <span className="font-semibold">{l.actor_email || 'sistema'}</span>
                  {l.target_type && (
                    <span className="text-muted-foreground">
                      {' '}· {l.target_type}
                      {l.target_id && <code className="text-xs font-mono ml-1">{l.target_id.slice(0, 8)}</code>}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {l.created_date && format(new Date(l.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {l.ip && l.ip !== 'unknown' && <span> · IP {l.ip}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}