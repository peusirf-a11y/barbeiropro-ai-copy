/**
 * MasterIncidentPanel — Painel de incidentes ativos no Security Center.
 * Exibe: tenants mais arriscados, sessões críticas, exportações recentes,
 * impersonações ativas, ataques em andamento.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ShieldAlert, AlertTriangle, UserCheck, Download, Globe, TrendingUp, Activity } from 'lucide-react';

function RiskBar({ score }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[11px] font-black tabular-nums ${score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
        {score}
      </span>
    </div>
  );
}

export default function MasterIncidentPanel() {
  const { data: events = [] } = useQuery({
    queryKey: ['master-sec-events-incidents'],
    queryFn: () => base44.entities.SecurityEvent.list('-created_date', 200),
    staleTime: 30_000,
  });

  const { data: adminLogs = [] } = useQuery({
    queryKey: ['master-admin-audit-incidents'],
    queryFn: () => base44.entities.AdminAuditLog.list('-created_date', 100),
    staleTime: 30_000,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['master-companies-incident'],
    queryFn: () => base44.entities.Company.list('-created_date', 200),
    staleTime: 5 * 60_000,
  });

  const { data: rateLimits = [] } = useQuery({
    queryKey: ['master-rate-limits-incident'],
    queryFn: () => base44.entities.SecurityRateLimit.filter({ is_blocked: true }, '-created_date', 50),
    staleTime: 30_000,
  });

  // Score de risco por tenant
  const tenantRisk = useMemo(() => {
    return companies.map(co => {
      const coEvents = events.filter(e => e.company_id === co.id);
      const critical = coEvents.filter(e => e.severity === 'critical').length;
      const high = coEvents.filter(e => e.severity === 'high').length;
      const crossTenant = coEvents.filter(e => e.event_type === 'cross_tenant_attempt').length;
      const bruteForce = coEvents.filter(e => e.event_type === 'brute_force_attempt').length;
      const score = Math.max(0, 100 - critical * 20 - high * 10 - crossTenant * 30 - bruteForce * 5);
      const riskLevel = score >= 80 ? 'low' : score >= 50 ? 'medium' : 'high';
      return { ...co, score, critical, high, crossTenant, bruteForce, riskLevel };
    }).filter(co => co.score < 100).sort((a, b) => a.score - b.score).slice(0, 8);
  }, [companies, events]);

  // Incidentes ativos (últimas 2h, severity high/critical)
  const activeIncidents = useMemo(() => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    return events
      .filter(e => (e.severity === 'high' || e.severity === 'critical') && new Date(e.created_date) > twoHoursAgo)
      .slice(0, 10);
  }, [events]);

  // Exportações LGPD recentes (24h)
  const recentExports = useMemo(() => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return adminLogs
      .filter(l => ['CUSTOMER_EXPORTED', 'BULK_EXPORT'].includes(l.action) && new Date(l.created_date) > oneDayAgo)
      .slice(0, 5);
  }, [adminLogs]);

  // Impersonações recentes (24h)
  const recentImpersonations = useMemo(() => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return adminLogs
      .filter(l => l.action === 'IMPERSONATION_STARTED' && new Date(l.created_date) > oneDayAgo)
      .slice(0, 5);
  }, [adminLogs]);

  const companyName = (id) => companies.find(c => c.id === id)?.name || id?.slice(-6) || '—';

  return (
    <div className="space-y-4">
      {/* KPIs de incidentes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Incidentes ativos (2h)', value: activeIncidents.length, icon: AlertTriangle, color: activeIncidents.length > 0 ? 'text-red-600' : 'text-emerald-600', urgent: activeIncidents.length > 0 },
          { label: 'Tenants em risco', value: tenantRisk.filter(t => t.score < 50).length, icon: ShieldAlert, color: 'text-amber-600' },
          { label: 'IPs bloqueados', value: rateLimits.length, icon: Globe, color: 'text-violet-600' },
          { label: 'Exportações (24h)', value: recentExports.length, icon: Download, color: 'text-blue-600' },
        ].map(stat => (
          <div key={stat.label} className={`bg-white rounded-xl border p-3 shadow-sm ${stat.urgent ? 'border-red-200 ring-1 ring-red-100' : 'border-black/5'}`}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              {stat.urgent && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
            </div>
            <div className={`text-2xl font-black tabular-nums ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Incidentes ativos */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-500" />
            <span className="font-bold text-sm text-[#111827]">Incidentes ativos (2h)</span>
            {activeIncidents.length > 0 && (
              <span className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          {activeIncidents.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">✓ Nenhum incidente ativo</div>
          ) : (
            <div className="divide-y divide-black/5 max-h-52 overflow-y-auto">
              {activeIncidents.map(ev => (
                <div key={ev.id} className="px-4 py-2.5 flex items-start gap-2">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${ev.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                    {ev.severity.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#111827]">{ev.event_type?.replace(/_/g, ' ')}</div>
                    <div className="text-[10px] text-gray-400">
                      {ev.actor_email && <span>{ev.actor_email} · </span>}
                      {ev.ip_address && <span>{ev.ip_address} · </span>}
                      {ev.company_id && <span>{companyName(ev.company_id)}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {ev.created_date ? format(new Date(ev.created_date), "HH:mm") : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tenants mais arriscados */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-sm text-[#111827]">Tenants com maior risco</span>
          </div>
          {tenantRisk.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">✓ Todos os tenants saudáveis</div>
          ) : (
            <div className="divide-y divide-black/5 max-h-52 overflow-y-auto">
              {tenantRisk.map(co => (
                <div key={co.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12px] font-semibold text-[#111827] truncate">{co.name}</span>
                    {co.critical > 0 && (
                      <span className="text-[10px] text-red-600 font-bold flex-shrink-0">{co.critical} crítico(s)</span>
                    )}
                  </div>
                  <RiskBar score={co.score} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exportações recentes */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-sm text-[#111827]">Exportações LGPD (24h)</span>
          </div>
          {recentExports.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">Nenhuma exportação nas últimas 24h</div>
          ) : (
            <div className="divide-y divide-black/5 max-h-40 overflow-y-auto">
              {recentExports.map(log => (
                <div key={log.id} className="px-4 py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#111827] truncate">{log.actor}</div>
                    <div className="text-[10px] text-gray-400">{companyName(log.company_id)}</div>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm") : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Impersonações recentes */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-violet-500" />
            <span className="font-bold text-sm text-[#111827]">Impersonações (24h)</span>
          </div>
          {recentImpersonations.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">Nenhuma impersonação nas últimas 24h</div>
          ) : (
            <div className="divide-y divide-black/5 max-h-40 overflow-y-auto">
              {recentImpersonations.map(log => (
                <div key={log.id} className="px-4 py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#111827] truncate">{log.actor}</div>
                    <div className="text-[10px] text-gray-400">{companyName(log.company_id)}</div>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm") : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}