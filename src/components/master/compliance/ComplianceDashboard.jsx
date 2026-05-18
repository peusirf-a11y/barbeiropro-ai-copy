// Dashboard executivo de compliance — KPIs, LGPD scores, alertas.

import { useMemo } from 'react';
import {
  Users, Download, UserX, UserCog,
  CheckCircle2, XCircle, ShieldCheck, TrendingUp, AlertOctagon,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';

function KpiCard({ label, value, sub, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue:   { bg: 'bg-blue-500/15',    text: 'text-blue-500',    ring: 'ring-blue-500/30' },
    red:    { bg: 'bg-red-500/15',     text: 'text-red-500',     ring: 'ring-red-500/30' },
    green:  { bg: 'bg-emerald-500/15', text: 'text-emerald-500', ring: 'ring-emerald-500/30' },
    amber:  { bg: 'bg-amber-500/15',   text: 'text-amber-500',   ring: 'ring-amber-500/30' },
    violet: { bg: 'bg-violet-500/15',  text: 'text-violet-500',  ring: 'ring-violet-500/30' },
    gray:   { bg: 'bg-muted',          text: 'text-muted-foreground', ring: 'ring-border' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
        {trend !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${trend >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-foreground tabular-nums">{value}</div>
      <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </div>
  );
}

function LgpdScoreCard({ company, consents, privacyLogs }) {
  const companyConsents = consents.filter(c => c.company_id === company.id);
  const companyLogs = privacyLogs.filter(l => l.company_id === company.id);

  let score = 0;
  const criteria = [
    { label: 'Política publicada',     pass: !!company.slug,                     pts: 15 },
    { label: 'Consentimentos ativos',  pass: companyConsents.some(c => c.granted), pts: 20 },
    { label: 'Logs de auditoria',      pass: companyLogs.length > 0,              pts: 15 },
    { label: 'Stripe Connect ativo',   pass: company.stripe_connect_status === 'enabled', pts: 10 },
    { label: 'Onboarding completo',    pass: !!company.onboarding_completed,      pts: 15 },
    { label: 'Assinatura ativa',       pass: company.subscription_status === 'active', pts: 10 },
    { label: 'Dados estruturados',     pass: !!(company.owner_email && company.owner_name), pts: 15 },
  ];
  criteria.forEach(c => { if (c.pass) score += c.pts; });

  const color = score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';
  const ring  = score >= 80 ? 'ring-emerald-500/30' : score >= 50 ? 'ring-amber-500/30' : 'ring-red-500/30';
  const bg    = score >= 80 ? 'bg-emerald-500/15'    : score >= 50 ? 'bg-amber-500/15'    : 'bg-red-500/15';

  return (
    <div className="bg-card rounded-xl border border-border p-3 shadow-sm flex items-center gap-3">
      <div className={`w-12 h-12 rounded-xl ${bg} ring-1 ${ring} flex items-center justify-center flex-shrink-0`}>
        <span className={`text-sm font-black ${color}`}>{score}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-foreground truncate">{company.name}</div>
        <div className="text-[10px] text-muted-foreground truncate">{company.owner_email || '—'}</div>
        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${score}%` }} />
        </div>
      </div>
      <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${bg} ${color} flex-shrink-0`}>
        {score >= 80 ? '✓ OK' : score >= 50 ? '⚠ Parcial' : '✗ Alerta'}
      </div>
    </div>
  );
}

export default function ComplianceDashboard({ companies, privacyLogs, auditLogs, consents, cookieLogs, loadingPrivacy }) {
  const stats = useMemo(() => {
    const activeConsents   = consents.filter(c => c.granted).length;
    const mktConsents      = consents.filter(c => c.consent_type === 'whatsapp_marketing' && c.granted).length;
    const totalConsents    = consents.filter(c => c.consent_type === 'whatsapp_marketing').length;
    const exports          = privacyLogs.filter(l => l.action === 'DATA_EXPORT_REQUESTED').length;
    const anonymizations   = privacyLogs.filter(l => l.action === 'DATA_ANONYMIZED').length;
    const impersonations   = auditLogs.filter(l => l.action === 'IMPERSONATION_STARTED').length;
    const suspicious       = auditLogs.filter(l => l.severity === 'critical').length;
    const cookieAccepted   = cookieLogs.filter(l => l.action === 'accept_all').length;
    const cookieRejected   = cookieLogs.filter(l => l.action === 'reject_optional').length;
    const optInRate        = totalConsents > 0 ? Math.round((mktConsents / totalConsents) * 100) : 0;
    return { activeConsents, mktConsents, totalConsents, exports, anonymizations, impersonations, suspicious, cookieAccepted, cookieRejected, optInRate };
  }, [consents, privacyLogs, auditLogs, cookieLogs]);

  const recentAlerts = useMemo(() => [
    ...privacyLogs.filter(l => l.severity === 'critical').slice(0, 3).map(l => ({ ...l, _type: 'privacy' })),
    ...auditLogs.filter(l => l.severity === 'critical').slice(0, 3).map(l => ({ ...l, _type: 'audit' })),
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5), [privacyLogs, auditLogs]);

  const sortedCompanies = [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '')).slice(0, 12);

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Consentimentos ativos"  value={stats.activeConsents}  icon={CheckCircle2} color="green" />
        <KpiCard label="Opt-in marketing"       value={`${stats.optInRate}%`} icon={TrendingUp}   color="blue"  sub={`${stats.mktConsents} de ${stats.totalConsents}`} />
        <KpiCard label="Exportações LGPD"       value={stats.exports}         icon={Download}     color="violet" />
        <KpiCard label="Anonimizações"          value={stats.anonymizations}  icon={UserX}        color="amber" />
        <KpiCard label="Impersonações"          value={stats.impersonations}  icon={UserCog}      color="gray" />
        <KpiCard label="Logs críticos"          value={stats.suspicious}      icon={AlertOctagon} color={stats.suspicious > 0 ? 'red' : 'green'} />
        <KpiCard label="Cookies aceitos"        value={stats.cookieAccepted}  icon={CheckCircle2} color="green" />
        <KpiCard label="Cookies recusados"      value={stats.cookieRejected}  icon={XCircle}      color="amber" />
      </div>

      {/* Alertas recentes + LGPD Scores */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Alertas */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-500" />
            <span className="font-bold text-sm text-foreground">Alertas críticos recentes</span>
          </div>
          {recentAlerts.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum alerta crítico. Plataforma saudável.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentAlerts.map(log => (
                <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">{log.action}</div>
                    <div className="text-[11px] text-muted-foreground">{log.actor_email || '—'} · {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm") : '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LGPD Score por tenant */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-sm text-foreground">LGPD Score por tenant</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{companies.length} tenants</span>
          </div>
          <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
            {loadingPrivacy ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Calculando…</div>
            ) : sortedCompanies.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Nenhum tenant encontrado.</div>
            ) : sortedCompanies.map(co => (
              <LgpdScoreCard key={co.id} company={co} consents={consents} privacyLogs={privacyLogs} />
            ))}
          </div>
        </div>
      </div>

      {/* Platform overview */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider mb-2">Tenants ativos</div>
          <div className="text-3xl font-black text-foreground">{companies.filter(c => c.status === 'active').length}</div>
          <div className="text-xs text-muted-foreground mt-1">de {companies.length} totais</div>
        </div>
        <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20 rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-violet-500 uppercase tracking-wider mb-2">Logs de auditoria</div>
          <div className="text-3xl font-black text-foreground">{auditLogs.length}</div>
          <div className="text-xs text-muted-foreground mt-1">últimas 500 ações</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider mb-2">Conformidade</div>
          <div className="text-3xl font-black text-foreground">
            {companies.length > 0 ? `${Math.round((companies.filter(c => c.onboarding_completed).length / companies.length) * 100)}%` : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">onboarding completo</div>
        </div>
      </div>
    </div>
  );
}