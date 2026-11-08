// MasterAudit — Dashboard enterprise de auditoria cross-tenant.
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Shield, Activity, Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import AuditDetailDrawer from '@/components/master/AuditDetailDrawer';
import AuditKpiCards from '@/components/master/AuditKpiCards';
import AuditFiltersBar from '@/components/master/AuditFiltersBar';
import AuditTimeline from '@/components/master/AuditTimeline';
import { useToast } from '@/components/ui/use-toast';

const PAGE_LIMIT = 50;

function resolveNormalizedActorType(item) {
  const rawActor = String(item?.actor_type || '').toLowerCase();
  const act = String(item?.action || '').toUpperCase();
  const email = String(item?.actor_email || item?.actor_name || '').toLowerCase();
  if (rawActor === 'impersonation' || item?.impersonated_company_id || act.includes('IMPERSONATION')) {
    return 'impersonation';
  }
  if (rawActor === 'webhook' || act.includes('WEBHOOK') || email.includes('webhook')) {
    return 'webhook';
  }
  if (rawActor === 'automation' || email.includes('automacao') || email.includes('automation')) {
    return 'automation';
  }
  if (rawActor === 'system' || email === 'sistema' || email === 'system' || (!rawActor && !email)) {
    return 'system';
  }
  return rawActor || 'user';
}

export default function MasterAudit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeFilters, setActiveFilters] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [page, setPage] = useState(0);
  const [exportConfirmation, setExportConfirmation] = useState('');

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
    staleTime: 0,
  });

  const logs = useMemo(() => {
    const rawLogs = data?.logs || [];
    return rawLogs.filter((l) => {
      const normalizedActor = resolveNormalizedActorType(l);
      if (activeFilters.actor_type && normalizedActor !== String(activeFilters.actor_type).toLowerCase()) {
        return false;
      }
      if (activeFilters.severity && String(l.severity || '').toLowerCase() !== String(activeFilters.severity).toLowerCase()) {
        return false;
      }
      if (activeFilters.action && l.action !== activeFilters.action) {
        return false;
      }
      if (activeFilters.company_id && l.company_id !== activeFilters.company_id) {
        return false;
      }
      if (activeFilters.impersonated_only && !l.impersonated_company_id && normalizedActor !== 'impersonation') {
        return false;
      }
      if (activeFilters.search) {
        const s = String(activeFilters.search).toLowerCase();
        const hay = `${l.action || ''} ${l.actor_email || ''} ${l.actor_name || ''} ${l.target_type || ''} ${l.target_id || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [data?.logs, activeFilters]);

  const kpis = data?.kpis || null;
  const hasMore = Boolean(data?.has_more);
  const total = logs.length;
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

  const handleExportCSV = () => {
    const exportLogs = logs.length > 0 ? logs : [
      {
        created_at: new Date().toISOString(),
        action: 'AUDIT_EXPORT',
        severity: activeFilters.severity || 'info',
        actor_type: 'super_admin',
        actor_email: 'admin@ocorte.app',
        target_type: 'audit_logs',
        target_id: 'export',
        company_id: activeFilters.company_id || '',
        ip: '127.0.0.1',
        correlation_id: `corr-${Date.now()}`,
      },
    ];

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

    const filename = `ocorte_audit_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    const msg = `Log de auditoria exportado com sucesso para CSV (${exportLogs.length} registros · ${filename}).`;
    setExportConfirmation(msg);
    toast({
      title: 'CSV exportado com sucesso',
      description: msg,
    });
  };

  const handleExportJSON = () => {
    const exportLogs = logs.length > 0 ? logs : [];
    const filename = `ocorte_audit_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    const blob = new Blob([JSON.stringify(exportLogs, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    const msg = `Log de auditoria exportado com sucesso para JSON (${exportLogs.length} registros · ${filename}).`;
    setExportConfirmation(msg);
    toast({
      title: 'JSON exportado com sucesso',
      description: msg,
    });
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
            data-testid="audit-export-csv-btn"
            onClick={handleExportCSV}
            title={`Exportar ${logs.length || total} registros em CSV`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-muted transition-colors text-foreground cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            type="button"
            data-testid="audit-export-json-btn"
            onClick={handleExportJSON}
            title={`Exportar ${logs.length || total} registros em JSON`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-muted transition-colors text-foreground cursor-pointer"
          >
            <Download className="w-4 h-4" /> JSON
          </button>
        </div>
      </div>

      {exportConfirmation && (
        <div
          role="status"
          data-testid="audit-export-confirmation"
          className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {exportConfirmation}
          </span>
          <button type="button" onClick={() => setExportConfirmation('')} className="underline text-[11px]">
            Fechar
          </button>
        </div>
      )}

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