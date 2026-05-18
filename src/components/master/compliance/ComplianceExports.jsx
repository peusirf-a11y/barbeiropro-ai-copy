// Exportações LGPD — log de todas as exportações de dados realizadas.

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Download, Search } from 'lucide-react';

export default function ComplianceExports({ privacyLogs, companies }) {
  const [filterCo, setFilterCo] = useState('');

  const exportLogs = useMemo(() => privacyLogs
    .filter(l => ['DATA_EXPORT_REQUESTED','DATA_EXPORT_DOWNLOADED'].includes(l.action))
    .filter(l => !filterCo || l.company_id === filterCo)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
    [privacyLogs, filterCo]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: 'Total de exportações', value: exportLogs.filter(l=>l.action==='DATA_EXPORT_REQUESTED').length, color:'text-blue-500' },
          { label: 'Downloads realizados', value: exportLogs.filter(l=>l.action==='DATA_EXPORT_DOWNLOADED').length, color:'text-emerald-500' },
          { label: 'Tenants envolvidos',   value: [...new Set(exportLogs.map(l=>l.company_id))].length, color:'text-violet-500' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 shadow-sm text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold text-sm text-foreground">Histórico de exportações</span>
          </div>
          <select value={filterCo} onChange={e => setFilterCo(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg text-xs bg-background text-foreground focus:outline-none">
            <option value="">Todos os tenants</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {exportLogs.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhuma exportação registrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Evento</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Responsável</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Tenant</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Cliente ID</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {exportLogs.map(l => {
                const co = companies.find(c => c.id === l.company_id);
                return (
                  <tr key={l.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${l.action === 'DATA_EXPORT_REQUESTED' ? 'bg-blue-500/15 text-blue-500 border-blue-500/30' : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'}`}>
                        {l.action === 'DATA_EXPORT_REQUESTED' ? 'Solicitado' : 'Baixado'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-foreground/80">{l.actor_email || '—'}</td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-foreground">{co?.name || l.company_id?.slice(-8) || '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono text-muted-foreground">{l.customer_id?.slice(-8) || '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap">{l.created_date ? format(new Date(l.created_date), "dd/MM/yy HH:mm") : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}