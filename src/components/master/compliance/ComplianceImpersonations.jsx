// Impersonações — log completo com motivo, duração, IP, status.

import { useMemo } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { UserCog, Clock, AlertTriangle } from 'lucide-react';

export default function ComplianceImpersonations({ auditLogs, companies }) {
  const starts = useMemo(() => auditLogs.filter(l => l.action === 'IMPERSONATION_STARTED'), [auditLogs]);
  const ends   = useMemo(() => auditLogs.filter(l => l.action === 'IMPERSONATION_ENDED'),   [auditLogs]);

  const sessions = useMemo(() => starts.map(s => {
    const end = ends.find(e => e.impersonated_company_id === s.impersonated_company_id && new Date(e.created_date) > new Date(s.created_date));
    const durMin = end ? differenceInMinutes(new Date(end.created_date), new Date(s.created_date)) : null;
    const co = companies.find(c => c.id === s.impersonated_company_id);
    return { ...s, end, durMin, co };
  }).sort((a,b) => new Date(b.created_date) - new Date(a.created_date)), [starts, ends, companies]);

  const open = sessions.filter(s => !s.end);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: 'Total de sessões',     value: sessions.length, color: 'text-blue-500' },
          { label: 'Sessões abertas',       value: open.length,     color: open.length > 0 ? 'text-red-500' : 'text-emerald-500' },
          { label: 'Tenants acessados',    value: [...new Set(sessions.map(s => s.impersonated_company_id))].length, color: 'text-violet-500' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 shadow-sm text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {open.length > 0 && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-500">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span><strong>{open.length} sessão(ões) de impersonação ainda abertas.</strong> Verifique no sistema se o encerramento foi registrado corretamente.</span>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <UserCog className="w-4 h-4 text-muted-foreground" />
          <span className="font-bold text-sm text-foreground">Sessões de impersonação</span>
        </div>
        {sessions.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhuma sessão de impersonação registrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Ator</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Tenant acessado</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Início</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Duração</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">IP</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5 text-[13px] text-foreground/80">{s.actor_email || '—'}</td>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-foreground">{s.co?.name || s.impersonated_company_id?.slice(-8) || '—'}</td>
                  <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap">{s.created_date ? format(new Date(s.created_date), "dd/MM/yy HH:mm") : '—'}</td>
                  <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                    {s.durMin !== null ? (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.durMin}min</span>
                    ) : (
                      <span className="text-red-500 font-semibold">Em aberto</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-mono text-muted-foreground">{s.ip_address || '—'}</td>
                  <td className="px-4 py-2.5">
                    {s.end
                      ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">Encerrado</span>
                      : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/30 animate-pulse">Aberto</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}