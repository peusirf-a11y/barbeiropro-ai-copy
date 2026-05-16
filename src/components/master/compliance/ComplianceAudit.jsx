// Auditoria master cross-tenant — log imutável de todas as ações críticas.

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, ChevronDown, ChevronUp, Download, AlertOctagon, Info, AlertTriangle } from 'lucide-react';

const SEV_STYLE = {
  info:     'bg-blue-50  text-blue-700  border-blue-100',
  warning:  'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-red-50   text-red-700   border-red-100',
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
      <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">Fonte</label>
            <div className="flex rounded-lg border border-black/10 overflow-hidden text-sm font-semibold">
              {[['audit','Auditoria Geral'],['privacy','LGPD / Privacidade']].map(([v,l]) => (
                <button key={v} onClick={() => { setSource(v); setPage(0); }}
                  className={`px-3 py-2 ${source === v ? 'bg-[#111827] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">Severidade</label>
            <select value={filterSev} onChange={e => { setFilterSev(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todas</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">Tenant</label>
            <select value={filterCo} onChange={e => { setFilterCo(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-gray-500 block mb-1">Filtrar ação</label>
            <input value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
              placeholder="Ex: APPOINTMENT" className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-black/10 bg-white rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
        <div className="mt-2 text-[11px] text-gray-400">{filtered.length.toLocaleString()} entradas · Logs imutáveis (somente leitura)</div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <span className="font-bold text-sm text-[#111827]">Log de eventos</span>
        </div>
        {loadingAudit ? (
          <div className="p-10 text-center text-gray-400 text-sm">Carregando…</div>
        ) : (
          <div className="divide-y divide-black/5">
            {paginated.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">Nenhum log encontrado com esses filtros.</div>
            ) : paginated.map(log => (
              <div key={log.id} className="px-4 py-3 hover:bg-[#FAFBFC] transition-colors">
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${SEV_DOT[log.severity] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${SEV_STYLE[log.severity] || SEV_STYLE.info}`}>{log.severity?.toUpperCase()}</span>
                        <span className="text-[13px] font-semibold text-[#111827] font-mono">{log.action}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                        {log.actor_email && <span>👤 {log.actor_email}</span>}
                        {log.company_id && <span>🏢 {companies.find(c=>c.id===log.company_id)?.name || log.company_id.slice(-8)}</span>}
                        {log.target_type && <span>🎯 {log.target_type}</span>}
                        {log.ip_address && <span>🌐 {log.ip_address}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm") : '—'}
                    </span>
                    {(log.metadata || log.details || log.before || log.after) && (
                      <button onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="text-gray-300 hover:text-gray-500 p-0.5">
                        {expanded === log.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                {expanded === log.id && (
                  <pre className="mt-2 ml-4 text-[11px] text-gray-600 bg-gray-50 rounded-lg p-2.5 overflow-x-auto border border-black/5">
                    {JSON.stringify(log.metadata || log.details || { before: log.before, after: log.after }, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-black/5 flex items-center justify-between">
            <span className="text-[12px] text-gray-400">Pág. {page + 1} de {totalPages} · {filtered.length} logs</span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-2.5 py-1 rounded-lg text-xs border border-black/10 disabled:opacity-40 hover:bg-gray-50">‹ Ant.</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-2.5 py-1 rounded-lg text-xs border border-black/10 disabled:opacity-40 hover:bg-gray-50">Próx. ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}