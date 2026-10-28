// Timeline de audit logs — com tratamento completo de Loading, Empty, Erro e timestamps
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Shield,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  MessageSquare,
  DollarSign,
  Calendar,
  Zap,
  Eye,
  RotateCcw,
  WifiOff,
} from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: {
    badge: 'bg-red-500/15 text-red-500 border border-red-500/30',
    dot: 'bg-red-500',
    icon: AlertTriangle,
  },
  warning: {
    badge: 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30',
    dot: 'bg-yellow-500',
    icon: AlertTriangle,
  },
  info: {
    badge: 'bg-blue-500/15 text-blue-500 border border-blue-500/30',
    dot: 'bg-blue-400',
    icon: Info,
  },
};

const ACTION_ICONS = {
  START_IMPERSONATION: Shield,
  IMPERSONATION_STARTED: Shield,
  END_IMPERSONATION: Shield,
  IMPERSONATION_ENDED: Shield,
  WHATSAPP_SENT: MessageSquare,
  WHATSAPP_FAILED: MessageSquare,
  CASH_OPENED: DollarSign,
  CASH_CLOSED: DollarSign,
  FINANCIAL_ENTRY_CREATED: DollarSign,
  APPOINTMENT_COMPLETED: CheckCircle2,
  APPOINTMENT_CANCELLED: XCircle,
  APPOINTMENT_CREATED: Calendar,
  CROSS_TENANT_ATTEMPT: Zap,
  PERMISSION_DENIED: Shield,
  ASAAS_ENV_MISMATCH: AlertTriangle,
};

function ActionBadge({ action, severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
  const Icon = ACTION_ICONS[action] || Info;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${cfg.badge}`}
    >
      <Icon className="w-3 h-3" />
      {action}
    </span>
  );
}

export default function AuditTimeline({
  logs = [],
  isLoading,
  isError,
  error,
  hasActiveFilters,
  onResetFilters,
  onRetry,
  onSelect,
}) {
  if (isLoading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-4 flex items-start gap-3 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-muted mt-2 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-3">
          <WifiOff className="w-5 h-5 text-red-500" />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-1">
          Falha ao carregar registros de auditoria
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
          {error?.message || 'Não foi possível comunicar com o servidor de auditoria no momento.'}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-3">
          <Shield className="w-6 h-6 text-muted-foreground/60" />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-1">
          {hasActiveFilters
            ? 'Nenhum registro encontrado para os filtros aplicados'
            : 'Nenhum evento de auditoria registrado'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
          {hasActiveFilters
            ? 'Tente remover ou ajustar os filtros selecionados para visualizar outros eventos da plataforma.'
            : 'Eventos críticos, impersonações, aberturas de caixa e tentativas de acesso aparecerão aqui em tempo real.'}
        </p>
        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar filtros ativos
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {logs.map((l) => {
        const cfg = SEVERITY_CONFIG[l.severity] || SEVERITY_CONFIG.info;
        const rawTs = l.created_at || l.created_date;
        const parsedDate = rawTs ? new Date(rawTs) : null;
        const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

        return (
          <div
            key={l.id}
            className="p-4 flex items-start gap-3 hover:bg-muted/40 transition-colors cursor-pointer group"
            onClick={() => onSelect(l)}
          >
            {/* Dot severity */}
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${cfg.dot}`} />

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <ActionBadge action={l.action} severity={l.severity} />
                {l.impersonated_company_id && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-purple-500/15 text-purple-500 rounded-full border border-purple-500/30">
                    IMPERSONATION
                  </span>
                )}
              </div>
              <div className="text-sm text-foreground truncate">
                <span className="font-medium">
                  {l.actor_email || l.actor_name || 'sistema'}
                </span>
                {l.target_type && (
                  <span className="text-muted-foreground">
                    {' '}
                    → {l.target_type}
                    {l.target_id && (
                      <code className="text-xs font-mono ml-1 text-muted-foreground/70">
                        {String(l.target_id).slice(0, 8)}
                      </code>
                    )}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-muted-foreground">
                {validDate && (
                  <span>{format(validDate, 'dd/MM/yy HH:mm:ss', { locale: ptBR })}</span>
                )}
                {l.company_id && (
                  <span className="font-mono">{String(l.company_id).slice(0, 8)}…</span>
                )}
                {(l.ip || l.ip_address) && (l.ip || l.ip_address) !== 'unknown' && (
                  <span>IP {l.ip || l.ip_address}</span>
                )}
                {l.correlation_id && (
                  <span className="font-mono">
                    corr: {String(l.correlation_id).slice(0, 8)}
                  </span>
                )}
              </div>
            </div>

            {/* Ver detalhes */}
            <Eye className="w-4 h-4 text-muted-foreground/50 group-hover:text-[#2563EB] transition-colors flex-shrink-0 mt-1" />
          </div>
        );
      })}
    </div>
  );
}