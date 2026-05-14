// Timeline de audit logs — estilo Stripe/Sentry
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Shield, AlertTriangle, Info, CheckCircle2, XCircle,
  MessageSquare, DollarSign, Calendar, User, Zap, Eye
} from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: {
    badge: 'bg-red-100 text-red-700 border border-red-200',
    dot: 'bg-red-500',
    icon: AlertTriangle,
  },
  warning: {
    badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    dot: 'bg-yellow-500',
    icon: AlertTriangle,
  },
  info: {
    badge: 'bg-blue-50 text-blue-600 border border-blue-100',
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
  STRIPE_ENV_MISMATCH: AlertTriangle,
};

function ActionBadge({ action, severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
  const Icon = ACTION_ICONS[action] || Info;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${cfg.badge}`}>
      <Icon className="w-3 h-3" />
      {action}
    </span>
  );
}

export default function AuditTimeline({ logs = [], isLoading, onSelect }) {
  if (isLoading) {
    return (
      <div className="divide-y divide-black/5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-4 flex items-start gap-3 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-gray-200 mt-2 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="py-16 text-center text-[#6B7280] text-sm">
        <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        Nenhum registro encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="divide-y divide-black/5">
      {logs.map(l => {
        const cfg = SEVERITY_CONFIG[l.severity] || SEVERITY_CONFIG.info;
        const date = l.created_date ? new Date(l.created_date) : null;
        return (
          <div
            key={l.id}
            className="p-4 flex items-start gap-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer group"
            onClick={() => onSelect(l)}
          >
            {/* Dot severity */}
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${cfg.dot}`} />

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <ActionBadge action={l.action} severity={l.severity} />
                {l.impersonated_company_id && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full border border-purple-100">
                    IMPERSONATION
                  </span>
                )}
              </div>
              <div className="text-sm text-[#111827] truncate">
                <span className="font-medium">{l.actor_email || l.actor_name || 'sistema'}</span>
                {l.target_type && (
                  <span className="text-[#6B7280]">
                    {' '}→ {l.target_type}
                    {l.target_id && <code className="text-xs font-mono ml-1 text-[#9CA3AF]">{l.target_id.slice(0, 8)}</code>}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-[#9CA3AF]">
                {date && <span>{format(date, "dd/MM/yy HH:mm:ss", { locale: ptBR })}</span>}
                {l.company_id && <span className="font-mono">{l.company_id.slice(0, 8)}…</span>}
                {l.ip && l.ip !== 'unknown' && <span>IP {l.ip}</span>}
                {l.correlation_id && <span className="font-mono">corr: {l.correlation_id.slice(0, 8)}</span>}
              </div>
            </div>

            {/* Ver detalhes */}
            <Eye className="w-4 h-4 text-gray-300 group-hover:text-[#2563EB] transition-colors flex-shrink-0 mt-1" />
          </div>
        );
      })}
    </div>
  );
}