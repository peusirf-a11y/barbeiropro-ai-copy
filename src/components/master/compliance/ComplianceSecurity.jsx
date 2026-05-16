// Segurança — visão de atividade suspeita, falhas, IPs recentes.

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ShieldCheck, AlertOctagon, Globe, Activity } from 'lucide-react';

export default function ComplianceSecurity({ auditLogs, privacyLogs, companies }) {
  const suspicious = useMemo(() =>
    [...auditLogs, ...privacyLogs]
      .filter(l => l.severity === 'critical' || l.severity === 'warning')
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 100),
    [auditLogs, privacyLogs]);

  const criticalCount = suspicious.filter(l => l.severity === 'critical').length;
  const warningCount  = suspicious.filter(l => l.severity === 'warning').length;

  // IPs únicos nos logs recentes
  const recentIps = useMemo(() => {
    const ipMap = {};
    [...auditLogs, ...privacyLogs].forEach(l => {
      if (l.ip_address) {
        if (!ipMap[l.ip_address]) ipMap[l.ip_address] = { ip: l.ip_address, count: 0, last: l.created_date };
        ipMap[l.ip_address].count++;
        if (new Date(l.created_date) > new Date(ipMap[l.ip_address].last)) ipMap[l.ip_address].last = l.created_date;
      }
    });
    return Object.values(ipMap).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [auditLogs, privacyLogs]);

  // Ações mais frequentes
  const topActions = useMemo(() => {
    const map = {};
    auditLogs.forEach(l => { if (l.action) { map[l.action] = (map[l.action]||0)+1; } });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
  }, [auditLogs]);

  const SEV = {
    critical: { dot:'bg-red-500',   badge:'bg-red-50 text-red-700 border-red-100' },
    warning:  { dot:'bg-amber-400', badge:'bg-amber-50 text-amber-700 border-amber-100' },
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid sm:grid-cols-4 gap-3">
        {[
          { label: 'Logs críticos',    value: criticalCount, color:'text-red-600' },
          { label: 'Avisos',           value: warningCount,  color:'text-amber-600' },
          { label: 'IPs únicos',       value: recentIps.length, color:'text-[#2563EB]' },
          { label: 'Ações distintas',  value: topActions.length, color:'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-black/5 p-4 shadow-sm text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Eventos suspeitos */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-500" />
            <span className="font-bold text-sm text-[#111827]">Eventos de risco</span>
          </div>
          {suspicious.length === 0 ? (
            <div className="p-8 text-center">
              <ShieldCheck className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum evento suspeito detectado.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 max-h-96 overflow-y-auto">
              {suspicious.map(log => {
                const s = SEV[log.severity] || SEV.warning;
                return (
                  <div key={log.id} className="px-4 py-2.5 flex items-start gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>{log.severity?.toUpperCase()}</span>
                        <span className="text-[12px] font-semibold text-[#111827] font-mono truncate">{log.action}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {log.actor_email && `${log.actor_email} · `}
                        {log.company_id && `${companies.find(c=>c.id===log.company_id)?.name || log.company_id.slice(-6)} · `}
                        {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm") : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* IPs mais ativos + top ações */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="font-bold text-sm text-[#111827]">IPs mais ativos</span>
            </div>
            {recentIps.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">Nenhum IP registrado nos logs.</div>
            ) : (
              <div className="divide-y divide-black/5">
                {recentIps.map(ip => (
                  <div key={ip.ip} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-[12px] font-mono text-gray-700">{ip.ip}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">{ip.count} ações</span>
                      <span className="text-[11px] text-gray-400">{ip.last ? format(new Date(ip.last), "dd/MM HH:mm") : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="font-bold text-sm text-[#111827]">APIs mais chamadas</span>
            </div>
            <div className="divide-y divide-black/5">
              {topActions.map(([action, count]) => (
                <div key={action} className="px-4 py-2 flex items-center justify-between gap-3">
                  <span className="text-[12px] font-mono text-gray-700 truncate">{action}</span>
                  <span className="text-[12px] font-bold text-[#2563EB] flex-shrink-0">{count}×</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}