// MasterObservability — painel central de operação do super admin.
// Fontes: getObservabilityMetrics + runSystemCheck.
// Agrega security events, audit log, e-mail, rate limit, sessões.
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Shield, Mail, Lock, Users, AlertTriangle, ServerCog, Ban, Globe, FileSearch, RefreshCw } from 'lucide-react';
import HealthBadge from '@/components/master/observability/HealthBadge';
import MetricCard from '@/components/master/observability/MetricCard';
import HourlySeriesChart from '@/components/master/observability/HourlySeriesChart';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { hour12: false });
}

export default function MasterObservability() {
  const obs = useQuery({
    queryKey: ['master', 'observability'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getObservabilityMetrics', {});
      return res.data;
    },
    refetchInterval: 60_000, // refresh a cada 1min
  });

  const sys = useQuery({
    queryKey: ['master', 'system-check'],
    queryFn: async () => {
      const res = await base44.functions.invoke('runSystemCheck', {});
      return res.data;
    },
    refetchInterval: 5 * 60_000, // 5min — chamada mais pesada
  });

  const data = obs.data;
  const sysData = sys.data;

  if (obs.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#60A5FA]/20 border-t-[#60A5FA] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.success) {
    return (
      <div className="ds-card border-rose-400/30">
        <div className="flex items-center gap-3 text-rose-300">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <div className="font-bold">Falha ao carregar métricas</div>
            <div className="text-sm opacity-75">{data?.error || obs.error?.message}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-white/45">Master · Operação</div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-0.5">Observabilidade</h1>
          <div className="text-xs text-white/50 mt-1">
            Janela: últimas 24h · Atualizado {formatTime(data.checked_at)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HealthBadge status={data.health.status} score={data.health.score} size="lg" />
          <button
            onClick={() => { obs.refetch(); sys.refetch(); }}
            disabled={obs.isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border border-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${obs.isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Status dos serviços externos */}
      {sysData && (
        <div className="ds-card">
          <div className="flex items-center gap-2 mb-4">
            <ServerCog className="w-4 h-4 text-blue-300" />
            <div className="text-sm font-bold text-white">Serviços externos</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ServiceStatus
              label={`Asaas${sysData.asaas_environment ? ` · ${sysData.asaas_environment}` : ''}`}
              value={sysData.asaas}
            />
            <ServiceStatus label="WhatsApp" value={sysData.whatsapp} />
            <ServiceStatus label="E-mail" value={sysData.email} />
            <ServiceStatus label="Geral" value={sysData.overall_status} />
          </div>
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Security events (24h)"
          value={data.security.events_24h}
          sub={`${data.security.events_7d} em 7 dias`}
          icon={Shield}
          tone={data.security.events_24h > 50 ? 'amber' : 'blue'}
        />
        <MetricCard
          label="Brute force"
          value={data.security.brute_force_24h}
          sub="tentativas em 24h"
          icon={Ban}
          tone={data.security.brute_force_24h > 5 ? 'red' : 'gray'}
        />
        <MetricCard
          label="Cross-tenant"
          value={data.security.cross_tenant_24h}
          sub="tentativas bloqueadas"
          icon={Globe}
          tone={data.security.cross_tenant_24h > 0 ? 'red' : 'green'}
        />
        <MetricCard
          label="LGPD exports"
          value={data.security.lgpd_exports_24h}
          sub="solicitações em 24h"
          icon={FileSearch}
          tone={data.security.lgpd_exports_24h > 10 ? 'amber' : 'purple'}
        />
        <MetricCard
          label="Impersonação inválida"
          value={data.security.invalid_impersonation_24h}
          sub="tentativas bloqueadas"
          icon={Lock}
          tone={data.security.invalid_impersonation_24h > 3 ? 'amber' : 'gray'}
        />
        <MetricCard
          label="Rate limit ativo"
          value={data.rate_limit.active_blocks}
          sub="bloqueios em vigor"
          icon={Ban}
          tone={data.rate_limit.active_blocks > 20 ? 'amber' : 'gray'}
        />
        <MetricCard
          label="Sessões impersonação"
          value={data.impersonation.active_sessions}
          sub="ativas agora"
          icon={Users}
          tone={data.impersonation.active_sessions > 3 ? 'amber' : 'green'}
        />
        <MetricCard
          label="Auditoria (24h)"
          value={data.audit.total_24h}
          sub="ações registradas"
          icon={Activity}
          tone="blue"
        />
      </div>

      {/* Charts 24h */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ds-card">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-rose-300" />
            <div className="text-sm font-bold text-white">Security events · 24h</div>
          </div>
          <HourlySeriesChart data={data.security.series_24h} color="#F87171" />
        </div>
        <div className="ds-card">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-300" />
            <div className="text-sm font-bold text-white">Audit log · 24h</div>
          </div>
          <HourlySeriesChart data={data.audit.series_24h} color="#60A5FA" />
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ds-card">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-amber-300" />
            <div className="text-sm font-bold text-white">Eventos por tipo (24h)</div>
          </div>
          <BreakdownList items={data.security.by_type} emptyLabel="Nenhum evento registrado." />
        </div>
        <div className="ds-card">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-300" />
            <div className="text-sm font-bold text-white">Top ações auditadas (24h)</div>
          </div>
          <BreakdownList
            items={Object.fromEntries((data.audit.top_actions || []).map(a => [a.action, a.count]))}
            emptyLabel="Nenhuma ação registrada."
          />
        </div>
      </div>

      {/* Email health */}
      <div className="ds-card">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-emerald-300" />
          <div className="text-sm font-bold text-white">E-mail · 24h</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Total" value={data.email.total_24h} tone="gray" />
          <MetricCard label="Enviados" value={data.email.sent} tone="green" />
          <MetricCard
            label="Falhas"
            value={data.email.failed}
            sub={`${(data.email.failure_rate * 100).toFixed(1)}% do total`}
            tone={data.email.failure_rate > 0.05 ? 'red' : 'gray'}
          />
        </div>
      </div>
    </div>
  );
}

function ServiceStatus({ label, value }) {
  const tone =
    value === 'ok' || value === 'healthy' ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30'
    : value === 'degraded' || value === 'disconnected' || value === 'not_configured' ? 'bg-amber-500/15 text-amber-300 ring-amber-400/30'
    : value === 'critical' || value === 'error' ? 'bg-rose-500/15 text-rose-300 ring-rose-400/30'
    : 'bg-slate-500/15 text-slate-300 ring-slate-400/30';
  return (
    <div className="rounded-lg bg-white/[0.025] border border-white/8 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold mb-1">{label}</div>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${tone}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function BreakdownList({ items, emptyLabel }) {
  const entries = Object.entries(items || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <div className="text-xs text-white/40 py-4">{emptyLabel}</div>;
  }
  const max = entries[0][1] || 1;
  return (
    <div className="space-y-2">
      {entries.slice(0, 8).map(([key, val]) => (
        <div key={key}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/70 truncate pr-2">{key}</span>
            <span className="font-bold text-white">{val}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
              style={{ width: `${Math.max(4, (val / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}