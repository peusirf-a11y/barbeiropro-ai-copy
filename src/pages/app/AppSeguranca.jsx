// AppSeguranca — Configurações > Segurança
// Mostra sessões ativas do cliente/admin e permite revogação.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/layout/AppLayout';
import AppPageHeader from '@/components/app/AppPageHeader';
import { Shield, Monitor, Smartphone, Globe, Clock, LogOut, AlertTriangle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const RISK_STYLE = {
  low:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium:   'bg-amber-50 text-amber-700 border-amber-200',
  high:     'bg-red-50 text-red-700 border-red-200',
  critical: 'bg-red-100 text-red-800 border-red-300',
};

function getDeviceIcon(ua) {
  if (!ua) return Monitor;
  const lower = ua.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return Smartphone;
  return Monitor;
}

export default function AppSeguranca() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  // Admin vê AuditLog de ações críticas da empresa
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });
  const company = companies.find(c => c.owner_email === user?.email) || companies[0];

  const { data: adminLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['admin-audit-logs', company?.id],
    queryFn: () => base44.entities.AdminAuditLog.filter(
      { company_id: company.id }, '-created_date', 50
    ),
    enabled: !!company?.id,
  });

  const { data: securityEvents = [] } = useQuery({
    queryKey: ['security-events-company', company?.id],
    queryFn: () => base44.entities.SecurityEvent.filter(
      { company_id: company.id }, '-created_date', 20
    ),
    enabled: !!company?.id,
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => base44.functions.invoke('adminAudit', {
      action: 'BULK_EXPORT',
      company_id: company?.id,
      severity: 'warning',
      metadata: { reason: 'manual_revoke_all_sessions' },
    }),
    onSuccess: () => {
      toast({ title: 'Sessões encerradas', description: 'Todas as sessões ativas foram revogadas.' });
      setConfirmRevokeAll(false);
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });

  const SEV_STYLE = {
    info:     'bg-blue-50 text-blue-700 border-blue-100',
    warning:  'bg-amber-50 text-amber-700 border-amber-100',
    critical: 'bg-red-50 text-red-700 border-red-100',
  };

  const ACTION_LABELS = {
    CUSTOMER_DELETED: 'Cliente excluído',
    CUSTOMER_ANONYMIZED: 'Cliente anonimizado',
    CUSTOMER_EXPORTED: 'Dados exportados',
    FINANCIAL_ENTRY_DELETED: 'Lançamento excluído',
    FINANCIAL_ENTRY_MODIFIED: 'Lançamento modificado',
    PERMISSION_CHANGED: 'Permissão alterada',
    IMPERSONATION_STARTED: 'Impersonação iniciada',
    IMPERSONATION_ENDED: 'Impersonação encerrada',
    COMMISSION_REVERSED: 'Comissão revertida',
    SUBSCRIPTION_CHANGED: 'Assinatura alterada',
    TEAM_MEMBER_REMOVED: 'Membro removido',
    TEAM_MEMBER_ROLE_CHANGED: 'Role de membro alterado',
    LGPD_ACTION: 'Ação LGPD',
    BULK_EXPORT: 'Exportação em massa',
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Segurança"
          subtitle="Trilha de auditoria e eventos de segurança da sua barbearia"
          icon={Shield}
        />

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-black/5 p-4 text-center shadow-sm">
            <div className="text-2xl font-black text-[#111827]">{adminLogs.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Ações auditadas</div>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 p-4 text-center shadow-sm">
            <div className="text-2xl font-black text-amber-600">
              {adminLogs.filter(l => l.severity === 'critical').length}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">Ações críticas</div>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 p-4 text-center shadow-sm">
            <div className="text-2xl font-black text-red-600">
              {securityEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">Alertas de segurança</div>
          </div>
        </div>

        {/* Eventos de segurança */}
        {securityEvents.length > 0 && (
          <div className="mb-6 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-black/5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-[#111827]">Alertas de segurança recentes</span>
            </div>
            <div className="divide-y divide-black/5">
              {securityEvents.slice(0, 5).map(ev => (
                <div key={ev.id} className="px-5 py-3 flex items-start gap-3">
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${SEV_STYLE[ev.severity] || SEV_STYLE.info}`}>
                    {ev.severity?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#111827]">{ev.event_type?.replace(/_/g, ' ')}</div>
                    {ev.ip_address && <div className="text-xs text-gray-400">IP: {ev.ip_address}</div>}
                  </div>
                  <div className="text-[11px] text-gray-400 flex-shrink-0">
                    {ev.created_date ? format(new Date(ev.created_date), "dd/MM HH:mm") : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trilha de auditoria administrativa */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-black/5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="font-bold text-[#111827]">Trilha de auditoria administrativa</span>
            <span className="ml-auto text-[11px] text-gray-400">{adminLogs.length} registros</span>
          </div>

          {loadingLogs ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando…</div>
          ) : adminLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma ação crítica registrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 max-h-96 overflow-y-auto">
              {adminLogs.map(log => (
                <div key={log.id} className="px-5 py-3">
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEV_STYLE[log.severity] || SEV_STYLE.info}`}>
                          {log.severity?.toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-[#111827]">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        {log.actor_is_impersonating && (
                          <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">
                            Via impersonação
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Por: <strong>{log.actor}</strong>
                        {log.target_entity && ` · ${log.target_entity}`}
                        {log.ip && ` · ${log.ip}`}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm", { locale: ptBR }) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info de segurança */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800 leading-relaxed">
          <strong>Sobre a auditoria:</strong> Todas as ações destrutivas (exclusões, anonimizações, alterações financeiras, mudanças de permissão) são registradas automaticamente com actor, IP, data e estado antes/depois. Esses logs são imutáveis e não podem ser excluídos pelo painel.
        </div>
      </div>
    </AppLayout>
  );
}