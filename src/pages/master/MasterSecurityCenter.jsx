// MasterSecurityCenter — Painel de Segurança Master.
// Mostra eventos de segurança, tentativas bloqueadas, score por tenant.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  ShieldAlert, AlertTriangle, Globe, UserX, Lock, TrendingDown, CheckCircle2,
  RefreshCw, Download, Filter, Activity
} from 'lucide-react';
import MasterIncidentPanel from '@/components/security/MasterIncidentPanel';

const SEV_STYLE = {
  critical: { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',    label: 'CRÍTICO' },
  high:     { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: 'ALTO' },
  medium:   { dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200',   label: 'MÉDIO' },
  low:      { dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200',      label: 'BAIXO' },
};

const EVENT_LABELS = {
  brute_force_attempt:         '🔨 Brute force',
  rate_limit_exceeded:         '⏱ Rate limit excedido',
  cross_tenant_attempt:        '🚧 Acesso cross-tenant',
  invalid_token:               '🔑 Token inválido',
  impersonation_abuse:         '👤 Abuso de impersonação',
  lgpd_export:                 '📦 Exportação LGPD',
  lgpd_anonymization:          '🗑 Anonimização LGPD',
  suspicious_payload:          '⚠️ Payload suspeito',
  invalid_impersonation:       '🚫 Impersonação inválida',
  privilege_escalation_attempt:'⬆️ Escalonamento de privilégio',
  mass_export_attempt:         '📤 Exportação em massa',
  login_failure:               '🔐 Falha de login',
  password_reset_abuse:        '🔄 Abuso de reset de senha',
};

function KpiCard({ label, value, icon: Icon, color = 'blue', urgent }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 ring-blue-100',
    red:    'bg-red-50 text-red-600 ring-red-100',
    amber:  'bg-amber-50 text-amber-600 ring-amber-100',
    green:  'bg-emerald-50 text-emerald-600 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  };
  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${urgent ? 'border-red-200 ring-1 ring-red-100' : 'border-black/5'}`}>
      <div className={`w-8 h-8 rounded-lg ring-1 flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-black text-[#111827] tabular-nums">{value}</div>
      <div className="text-[11px] font-semibold text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function MasterSecurityCenter() {
  const [activeTab, setActiveTab] = useState('incidents');
  const [filterSev, setFilterSev] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCo, setFilterCo] = useState('');

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['master-security-events'],
    queryFn: () => base44.entities.SecurityEvent.list('-created_date', 500),
    staleTime: 30_000,
  });

  const { data: rateLimits = [] } = useQuery({
    queryKey: ['master-rate-limits'],
    queryFn: () => base44.entities.SecurityRateLimit.filter({ is_blocked: true }, '-created_date', 100),
    staleTime: 30_000,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['master-companies-sec'],
    queryFn: () => base44.entities.Company.list('-created_date', 500),
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => events.filter(e => {
    if (filterSev && e.severity !== filterSev) return false;
    if (filterType && e.event_type !== filterType) return false;
    if (filterCo && e.company_id !== filterCo) return false;
    return true;
  }), [events, filterSev, filterType, filterCo]);

  const stats = useMemo(() => ({
    critical:    events.filter(e => e.severity === 'critical').length,
    crossTenant: events.filter(e => e.event_type === 'cross_tenant_attempt').length,
    bruteForce:  events.filter(e => e.event_type === 'brute_force_attempt' || e.event_type === 'rate_limit_exceeded').length,
    blocked:     rateLimits.filter(r => r.is_blocked).length,
    lgpd:        events.filter(e => e.event_type === 'lgpd_export' || e.event_type === 'lgpd_anonymization').length,
  }), [events, rateLimits]);

  const exportCSV = () => {
    const safeCsv = (v) => { const s = String(v || '').replace(/"/g, '""'); return /^[=+\-@]/.test(s) ? `'${s}` : s; };
    const headers = ['data', 'tipo', 'severidade', 'actor', 'tenant', 'ip', 'bloqueado'];
    const rows = filtered.map(e => [
      e.created_date ? format(new Date(e.created_date), 'dd/MM/yy HH:mm') : '',
      EVENT_LABELS[e.event_type] || e.event_type, e.severity,
      e.actor_email, e.company_id, e.ip_address, e.blocked ? 'Sim' : 'Não',
    ].map(v => `"${safeCsv(v)}"`).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' }));
    a.download = `security_events_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Score de segurança por tenant (heurístico)
  const tenantScores = useMemo(() => {
    return companies.slice(0, 10).map(co => {
      const coEvents = events.filter(e => e.company_id === co.id);
      const critical = coEvents.filter(e => e.severity === 'critical').length;
      const crossTenant = coEvents.filter(e => e.event_type === 'cross_tenant_attempt').length;
      const score = Math.max(0, 100 - critical * 20 - crossTenant * 30);
      return { ...co, score, critical, crossTenant };
    }).sort((a, b) => a.score - b.score);
  }, [companies, events]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-400 flex items-center justify-center shadow-md">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#111827] tracking-tight">Security Center</h1>
            <p className="text-xs text-gray-400">Eventos de segurança · Brute force · Cross-tenant · LGPD</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 border border-black/10 rounded-xl text-sm hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-black/10 rounded-xl text-sm hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'incidents', label: 'Incidentes', icon: Activity },
          { key: 'events', label: 'Eventos', icon: ShieldAlert },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 flex-1 text-sm font-semibold py-2 px-3 rounded-lg transition-all ${activeTab === t.key ? 'bg-white text-[#111827] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'incidents' && <MasterIncidentPanel />}

      {activeTab === 'events' && (<>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard label="Eventos críticos"     value={stats.critical}    icon={AlertTriangle} color="red"    urgent={stats.critical > 0} />
        <KpiCard label="Cross-tenant bloq."   value={stats.crossTenant} icon={Lock}          color="red"    urgent={stats.crossTenant > 0} />
        <KpiCard label="Brute force / RL"     value={stats.bruteForce}  icon={TrendingDown}  color="amber" />
        <KpiCard label="IPs bloqueados"        value={stats.blocked}     icon={Globe}         color="violet" />
        <KpiCard label="Ações LGPD"            value={stats.lgpd}        icon={UserX}         color="blue" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Events timeline */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-black/5 p-3 shadow-sm flex flex-wrap gap-2 items-center">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
              className="px-2 py-1.5 text-xs border border-black/10 rounded-lg focus:outline-none">
              <option value="">Todas severidades</option>
              <option value="critical">Crítico</option>
              <option value="high">Alto</option>
              <option value="medium">Médio</option>
              <option value="low">Baixo</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-2 py-1.5 text-xs border border-black/10 rounded-lg focus:outline-none">
              <option value="">Todos os tipos</option>
              {Object.entries(EVENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select value={filterCo} onChange={e => setFilterCo(e.target.value)}
              className="px-2 py-1.5 text-xs border border-black/10 rounded-lg focus:outline-none">
              <option value="">Todos os tenants</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="ml-auto text-[11px] text-gray-400">{filtered.length} eventos</span>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Carregando eventos…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nenhum evento detectado. Sistema saudável.</p>
              </div>
            ) : (
              <div className="divide-y divide-black/5 max-h-[500px] overflow-y-auto">
                {filtered.map(ev => {
                  const s = SEV_STYLE[ev.severity] || SEV_STYLE.low;
                  const co = companies.find(c => c.id === ev.company_id);
                  return (
                    <div key={ev.id} className="px-4 py-3 hover:bg-[#FAFBFC] transition-colors">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${s.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>{s.label}</span>
                            <span className="text-[13px] font-semibold text-[#111827]">{EVENT_LABELS[ev.event_type] || ev.event_type}</span>
                            {!ev.blocked && <span className="text-[10px] text-amber-600 font-bold">NÃO BLOQUEADO</span>}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                            {ev.actor_email && <span>👤 {ev.actor_email}</span>}
                            {co && <span>🏢 {co.name}</span>}
                            {ev.ip_address && <span>🌐 {ev.ip_address}</span>}
                            {ev.route && <span>📍 {ev.route}</span>}
                          </div>
                        </div>
                        <span className="text-[11px] text-gray-400 flex-shrink-0 whitespace-nowrap">
                          {ev.created_date ? format(new Date(ev.created_date), "dd/MM HH:mm") : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: IPs bloqueados + Security score */}
        <div className="space-y-4">
          {/* IPs bloqueados */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
              <Globe className="w-4 h-4 text-red-400" />
              <span className="font-bold text-sm text-[#111827]">IPs bloqueados agora</span>
            </div>
            {rateLimits.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">Nenhum IP bloqueado.</div>
            ) : (
              <div className="divide-y divide-black/5 max-h-48 overflow-y-auto">
                {rateLimits.slice(0, 20).map(r => (
                  <div key={r.id} className="px-4 py-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12px] font-mono text-gray-700">{r.ip || r.identifier || '—'}</div>
                      <div className="text-[10px] text-gray-400">{r.route} · {r.attempts} tentativas</div>
                    </div>
                    <div className="text-[10px] text-red-500 font-bold flex-shrink-0">
                      {r.blocked_until ? `até ${format(new Date(r.blocked_until), "HH:mm")}` : 'Bloq.'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security score por tenant */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#2563EB]" />
              <span className="font-bold text-sm text-[#111827]">Score de risco por tenant</span>
            </div>
            <div className="divide-y divide-black/5 max-h-64 overflow-y-auto">
              {tenantScores.map(co => (
                <div key={co.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black ${co.score >= 80 ? 'bg-emerald-50 text-emerald-600' : co.score >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                    {co.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#111827] truncate">{co.name}</div>
                    {co.critical > 0 && <div className="text-[10px] text-red-500">{co.critical} evento(s) crítico(s)</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </>)}
    </div>
  );
}