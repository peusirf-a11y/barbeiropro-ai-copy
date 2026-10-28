// MasterAudit — Dashboard enterprise de auditoria cross-tenant.
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Shield, Activity, Download, RefreshCw } from 'lucide-react';
import AuditDetailDrawer from '@/components/master/AuditDetailDrawer';
import AuditKpiCards from '@/components/master/AuditKpiCards';
import AuditFiltersBar from '@/components/master/AuditFiltersBar';
import AuditTimeline from '@/components/master/AuditTimeline';

const PAGE_LIMIT = 50;

export default function MasterAudit() {
  const queryClient = useQueryClient();
  const [activeFilters, setActiveFilters] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [page, setPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['master-audit', activeFilters, page],
    queryFn: async () => {
      const res = await base44.functions.invoke('listAuditLogs', {
        ...activeFilters,
        limit: PAGE_LIMIT,
        skip: page * PAGE_LIMIT,
      });
      return res?.data;
    },
    keepPreviousData: true,
    staleTime: 15_000,
  });

  const logs = data?.logs || [];
  const kpis = data?.kpis || null;
  const hasMore = Boolean(data?.has_more);
  const total = Number(data?.total || 0);
  const hasActiveFilters = Object.values(activeFilters).some((v) => v !== '' && v !== null && v !== undefined);

  // Substitui o objeto de filtros por completo (garante que desmarcar um chip ou limpar remova chaves antigas)
  const handleFilter = useCallback((newFilters) => {
    const clean = Object.fromEntries(
      Object.entries(newFilters || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    setActiveFilters(clean);
    setPage(0);
  }, []);

  // Invalida o cache completo da auditoria e força re-fetch limpo
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['master-audit'] });
    await refetch();
  };

  // Busca todos os registros filtrados (até 5.000) para exportação completa, não apenas a página atual
  const fetchAllFilteredForExport = async () => {
    try {
      const res = await base44.functions.invoke('listAuditLogs', {
        ...activeFilters,
        limit: 5000,
        skip: 0,
      });
      return res?.data?.logs || logs;
    } catch {
      return logs;
    }
  };

  const handleExportCSV = async () => {
    if (!total && !logs.length) return;
    setIsExporting(true);
    try {
      const exportLogs = await fetchAllFilteredForExport();
      if (!exportLogs.length) return;

      const columns = [
        { key: 'created_at', label: 'data_hora' },
        { key: 'action', label: 'action' },
        { key: 'severity', label: 'severity' },
        { key: 'actor_type', label: 'actor_type' },
        { key: 'actor_email', label: 'actor_email' },
        { key: 'target_type', label: 'target_type' },
        { key: 'target_id', label: 'target_id' },
        { key: 'company_id', label: 'company_id' },
        { key: 'ip', label: 'ip' },
        { key: 'correlation_id', label: 'correlation_id' },
      ];

      const headerRow = columns.map((c) => c.label).join(',');
      const rows = exportLogs.map((l) =>
        columns
          .map((c) => {
            const rawVal =
              c.key === 'created_at'
                ? l.created_at || l.created_date || ''
                : c.key === 'ip'
                  ? l.ip || l.ip_address || ''
                  : l[c.key] ?? '';
            const escaped = String(rawVal)
              .replace(/\r?\n|\r/g, ' ')
              .replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      );

      // BOM UTF-8 (\uFEFF) para abertura perfeita de acentos no Microsoft Excel
      const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ocorte_audit_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    if (!total && !logs.length) return;
    setIsExporting(true);
    try {
      const exportLogs = await fetchAllFilteredForExport();
      if (!exportLogs.length) return;

      const blob = new Blob([JSON.stringify(exportLogs, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ocorte_audit_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const startIdx = total === 0 ? 0 : page * PAGE_LIMIT + 1;
  const endIdx = total === 0 ? 0 : Math.min((page + 1) * PAGE_LIMIT, total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Auditoria</h1>
            <p className="text-sm text-muted-foreground">
              Rastreabilidade completa da plataforma.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-muted disabled:opacity-50 transition-colors text-foreground cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#2563EB]' : ''}`} />
            {isFetching ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting || total === 0}
            title={total === 0 ? 'Sem registros para exportar' : `Exportar ${total} registros em CSV`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors text-foreground cursor-pointer"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={isExporting || total === 0}
            title={total === 0 ? 'Sem registros para exportar' : `Exportar ${total} registros em JSON`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors text-foreground cursor-pointer"
          >
            <Download className="w-4 h-4" /> JSON
          </button>
        </div>
      </div>

      {/* KPIs de 24h (agregados no servidor + clicáveis para filtro rápido) */}
      <AuditKpiCards
        logs={logs}
        kpis={kpis}
        activeFilters={activeFilters}
        onQuickFilter={handleFilter}
      />

      {/* Barra de Busca e Filtros Dinâmicos */}
      <AuditFiltersBar value={activeFilters} onFilter={handleFilter} />

      {/* Timeline */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-foreground">Timeline</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-muted text-muted-foreground rounded-full border border-border">
              {total} {total === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Página {page + 1}</span>
        </div>

        <AuditTimeline
          logs={logs}
          isLoading={isLoading}
          isError={isError}
          error={error}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={() => handleFilter({})}
          onRetry={handleRefresh}
          onSelect={setSelectedLog}
        />

        {/* Paginação */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-muted/40">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isFetching}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border border-border bg-card disabled:opacity-40 hover:bg-muted transition-colors text-foreground cursor-pointer"
          >
            ← Anterior
          </button>
          <span className="text-xs text-muted-foreground">
            {startIdx}–{endIdx} de {total}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore || isFetching}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border border-border bg-card disabled:opacity-40 hover:bg-muted transition-colors text-foreground cursor-pointer"
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