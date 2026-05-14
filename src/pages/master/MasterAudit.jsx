// MasterAudit — Dashboard enterprise de auditoria cross-tenant.
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Shield, AlertTriangle, Activity, Users, Zap, MessageSquare,
  ChevronDown, ChevronUp, X, Download, RefreshCw, Filter,
  Search, Eye, Clock, DollarSign
} from 'lucide-react';
import AuditDetailDrawer from '@/components/master/AuditDetailDrawer';
import AuditKpiCards from '@/components/master/AuditKpiCards';
import AuditFiltersBar from '@/components/master/AuditFiltersBar';
import AuditTimeline from '@/components/master/AuditTimeline';

export default function MasterAudit() {
  const [filters, setFilters] = useState({ limit: 50, skip: 0 });
  const [selectedLog, setSelectedLog] = useState(null);
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['master-audit', filters, page],
    queryFn: async () => {
      const res = await base44.functions.invoke('listAuditLogs', {
        ...filters,
        skip: page * filters.limit,
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const logs = data?.logs || [];
  const hasMore = data?.has_more || false;
  const total = data?.total || 0;

  const handleFilter = useCallback((newFilters) => {
    setFilters(f => ({ ...f, ...newFilters }));
    setPage(0);
  }, []);

  const handleExportCSV = () => {
    if (!logs.length) return;
    const headers = ['data', 'action', 'severity', 'actor_email', 'target_type', 'target_id', 'company_id', 'correlation_id'];
    const rows = logs.map(l => headers.map(h => {
      const v = l[h] || '';
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!logs.length) return;
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] ring-1 ring-[#DBEAFE] flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#111827] tracking-tight">Auditoria</h1>
            <p className="text-sm text-[#6B7280]">Rastreabilidade completa da plataforma.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-black/10 bg-white hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-black/10 bg-white hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-black/10 bg-white hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> JSON
          </button>
        </div>
      </div>

      {/* KPIs */}
      <AuditKpiCards logs={logs} />

      {/* Filtros */}
      <AuditFiltersBar onFilter={handleFilter} />

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB]" />
            <span className="font-bold text-[#111827]">Timeline</span>
            {total > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                {total} registros
              </span>
            )}
          </div>
          <span className="text-xs text-[#6B7280]">Página {page + 1}</span>
        </div>

        <AuditTimeline
          logs={logs}
          isLoading={isLoading}
          onSelect={setSelectedLog}
        />

        {/* Paginação */}
        <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between bg-[#FAFBFC]">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || isFetching}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border border-black/10 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-xs text-[#6B7280]">
            {page * filters.limit + 1}–{Math.min((page + 1) * filters.limit, total)} de {total}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore || isFetching}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border border-black/10 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Próxima →
          </button>
        </div>
      </div>

      {/* Drawer de detalhes */}
      {selectedLog && (
        <AuditDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}