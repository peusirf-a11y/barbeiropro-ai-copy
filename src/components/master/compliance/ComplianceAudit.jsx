// Auditoria master cross-tenant — log imutável de todas as ações críticas.

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, ChevronDown, ChevronUp, Download, AlertOctagon, Info, AlertTriangle } from 'lucide-react';

const SEV_STYLE = {
  info:     'bg-blue-500/15  text-blue-500  border-blue-500/30',
  warning:  'bg-amber-500/15 text-amber-500 border-amber-500/30',
  critical: 'bg-red-500/15   text-red-500   border-red-500/30',
};
const SEV_DOT = {
  info:     'bg-blue-400',
  warning:  'bg-amber-400',
  critical: 'bg-red-500',
};

export default function ComplianceAudit({ auditLogs, privacyLogs, companies, loadingAudit }) {
  const [source, setSource]         = useState('audit'); // 'audit' | 'privacy'
  const [filterSev, setFilterSev]   = useState('');
  const [filterCo, setFilterCo]     = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [expanded, setExpanded]     = useState(null);
  const [page, setPage]             = useState(0);
  const PER_PAGE = 40;

  const logs = source === 'audit' ? auditLogs : privacyLogs;

  const filtered = useMemo(() => logs.filter(l => {
    if (filterSev    && l.severity !== filterSev)         return false;
    if (filterCo     && l.company_id !== filterCo)        return false;
    if (filterAction && !l.action?.includes(filterAction.toUpperCase())) return false;
    return true;
  }), [logs, filterSev, filterCo, filterAction]);

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const exportCSV = () => {
    const headers = ['data','action','severity','actor_email','actor_type','company_id','target_type','target_id'];
    const rows = filtered.map(l => headers.map(h => `"${String(l[h]||'').replace(/"/g,'""')}"`).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' }));
    a.download = `auditoria_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Fonte</label>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm font-semibold">
              {[['audit','Auditoria Geral'],['privacy','LGPD / Privacidade']].map(([v,l]) => (
                <button key={v} onClick={() => { setSource(v); setPage(0); }}
                  className={`px-3 py-2 ${source === v ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:bg-muted'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Severidade</label>
            <select value={filterSev} onChange={e => { setFilterSev(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todas</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Tenant</label>
            <select value={filterCo} onChange={e => { setFilterCo(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Filtrar ação</label>
            <input value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
              placeholder="Ex: APPOINTMENT" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-border bg-card rounded-lg text-sm font-medium hover:bg-muted whitespace-nowrap text-foreground">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">{filtered.length.toLocaleString()} entradas · Logs imutáveis (somente leitura)</div>
      </div>

      {/* Timeline */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="font-bold text-sm text-foreground">Log de eventos</span>
        </div>
        {loadingAudit ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando…</div>
        ) : (
          <div className="divide-y divide-border">
            {paginated.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">Nenhum log encontrado com esses filtros.</div>
            ) : paginated.map(log => (
              <div key={log.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${SEV_DOT[log.severity] || 'bg-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${SEV_STYLE[log.severity] || SEV_STYLE.info}`}>{log.severity?.toUpperCase()}</span>
                        <span className="text-[13px] font-semibold text-foreground font-mono">{log.action}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                        {log.actor_email && <span>👤 {log.actor_email}</span>}
                        {log.company_id && <span>🏢 {companies.find(c=>c.id===log.company_id)?.name || log.company_id.slice(-8)}</span>}
                        {log.target_type && <span>🎯 {log.target_type}</span>}
                        {log.ip_address && <span>🌐 {log.ip_address}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm") : '—'}
                    </span>
                    {(log.metadata || log.details || log.before || log.after) && (
                      <button onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="text-muted-foreground/60 hover:text-foreground p-0.5">
                        {expanded === log.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                {expanded === log.id && (
                  <pre className="mt-2 ml-4 text-[11px] text-muted-foreground bg-muted rounded-lg p-2.5 overflow-x-auto border border-border">
                    {JSON.stringify(log.metadata || log.details || { before: log.before, after: log.after }, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">Pág. {page + 1} de {totalPages} · {filtered.length} logs</span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-2.5 py-1 rounded-lg text-xs border border-border bg-card disabled:opacity-40 hover:bg-muted text-foreground">‹ Ant.</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-2.5 py-1 rounded-lg text-xs border border-border bg-card disabled:opacity-40 hover:bg-muted text-foreground">Próx. ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}