/**
 * SessionActivityStream — Timeline de atividade de sessão.
 * Exibe login, logout, MFA, impersonação, exports LGPD, alterações críticas.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LogIn, LogOut, Shield, UserCheck, Download, AlertTriangle,
  Monitor, Smartphone, Filter, RefreshCw
} from 'lucide-react';

const EVENT_CONFIG = {
  IMPERSONATION_STARTED:     { icon: UserCheck,    color: 'text-violet-600', bg: 'bg-violet-50', label: 'Impersonação iniciada' },
  IMPERSONATION_ENDED:       { icon: UserCheck,    color: 'text-violet-400', bg: 'bg-violet-50', label: 'Impersonação encerrada' },
  CUSTOMER_EXPORTED:         { icon: Download,     color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Exportação de dados' },
  CUSTOMER_ANONYMIZED:       { icon: AlertTriangle,color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'Cliente anonimizado' },
  CUSTOMER_DELETED:          { icon: AlertTriangle,color: 'text-red-600',    bg: 'bg-red-50',    label: 'Cliente excluído' },
  PERMISSION_CHANGED:        { icon: Shield,       color: 'text-orange-600', bg: 'bg-orange-50', label: 'Permissão alterada' },
  TEAM_MEMBER_REMOVED:       { icon: AlertTriangle,color: 'text-red-500',    bg: 'bg-red-50',    label: 'Membro removido' },
  TEAM_MEMBER_ROLE_CHANGED:  { icon: Shield,       color: 'text-orange-500', bg: 'bg-orange-50', label: 'Role alterado' },
  FINANCIAL_ENTRY_DELETED:   { icon: AlertTriangle,color: 'text-red-500',    bg: 'bg-red-50',    label: 'Lançamento excluído' },
  SUBSCRIPTION_CHANGED:      { icon: Shield,       color: 'text-blue-500',   bg: 'bg-blue-50',   label: 'Assinatura alterada' },
  SUBSCRIPTION_CANCELLED:    { icon: AlertTriangle,color: 'text-red-600',    bg: 'bg-red-50',    label: 'Assinatura cancelada' },
  STRIPE_CONNECTED:          { icon: Shield,       color: 'text-emerald-600',bg: 'bg-emerald-50',label: 'Stripe conectado' },
  STRIPE_DISCONNECTED:       { icon: AlertTriangle,color: 'text-red-500',    bg: 'bg-red-50',    label: 'Stripe desconectado' },
  COMMISSION_REVERSED:       { icon: AlertTriangle,color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'Comissão revertida' },
  LGPD_ACTION:               { icon: Shield,       color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Ação LGPD' },
  BULK_EXPORT:               { icon: Download,     color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'Exportação em massa' },
};

const SEV_BADGE = {
  info:     'bg-blue-50 text-blue-700 border-blue-100',
  warning:  'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-red-50 text-red-700 border-red-100',
};

function DeviceIcon({ ua }) {
  if (!ua) return <Monitor className="w-3.5 h-3.5" />;
  const lower = ua.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
    return <Smartphone className="w-3.5 h-3.5" />;
  }
  return <Monitor className="w-3.5 h-3.5" />;
}

/**
 * @param {object} props
 * @param {string} props.companyId
 * @param {number} [props.limit]
 */
export default function SessionActivityStream({ companyId, limit = 50 }) {
  const [filterSev, setFilterSev] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-audit-logs-stream', companyId],
    queryFn: () => base44.entities.AdminAuditLog.filter(
      { company_id: companyId },
      '-created_date',
      limit
    ),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const { data: secEvents = [] } = useQuery({
    queryKey: ['sec-events-stream', companyId],
    queryFn: () => base44.entities.SecurityEvent.filter(
      { company_id: companyId },
      '-created_date',
      20
    ),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterSev && l.severity !== filterSev) return false;
      if (filterAction && l.action !== filterAction) return false;
      return true;
    });
  }, [logs, filterSev, filterAction]);

  const actionKeys = [...new Set(logs.map(l => l.action).filter(Boolean))];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-3.5 h-3.5 text-gray-400" />
        <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
          className="px-2 py-1.5 text-xs border border-black/10 rounded-lg focus:outline-none bg-white">
          <option value="">Todas severidades</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Crítico</option>
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="px-2 py-1.5 text-xs border border-black/10 rounded-lg focus:outline-none bg-white">
          <option value="">Todas as ações</option>
          {actionKeys.map(k => (
            <option key={k} value={k}>{EVENT_CONFIG[k]?.label || k}</option>
          ))}
        </select>
        <button onClick={() => refetch()}
          className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </button>
        <span className="text-[11px] text-gray-400">{filtered.length} eventos</span>
      </div>

      {/* Security alerts (compact) */}
      {secEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1.5">
          <div className="text-[11px] font-bold text-red-700 uppercase tracking-wide mb-1">⚠️ Alertas de Segurança</div>
          {secEvents.filter(e => e.severity === 'high' || e.severity === 'critical').slice(0, 3).map(ev => (
            <div key={ev.id} className="flex items-center gap-2 text-xs text-red-700">
              <span className="font-bold">{ev.severity.toUpperCase()}</span>
              <span>{ev.event_type?.replace(/_/g, ' ')}</span>
              {ev.ip_address && <span className="text-red-400">· {ev.ip_address}</span>}
              <span className="ml-auto text-red-400">
                {ev.created_date ? format(new Date(ev.created_date), "dd/MM HH:mm") : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Activity timeline */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Nenhuma ação registrada ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5 max-h-[480px] overflow-y-auto">
            {filtered.map(log => {
              const cfg = EVENT_CONFIG[log.action] || { icon: Shield, color: 'text-gray-500', bg: 'bg-gray-50', label: log.action };
              const Icon = cfg.icon;
              return (
                <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-[#FAFBFC] transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${SEV_BADGE[log.severity] || SEV_BADGE.info}`}>
                        {log.severity?.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-[#111827]">{cfg.label}</span>
                      {log.actor_is_impersonating && (
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">
                          via impersonação
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>Por: <strong className="text-gray-600">{log.actor}</strong></span>
                      {log.ip && (
                        <span className="flex items-center gap-1">
                          <DeviceIcon ua={log.user_agent} />
                          {log.ip}
                        </span>
                      )}
                      {log.target_entity && <span>· {log.target_entity}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400 flex-shrink-0 whitespace-nowrap">
                    {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm", { locale: ptBR }) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}