// Segurança — visão de políticas de proteção ativas, atividade suspeita, falhas, IPs recentes.

import { useMemo } from 'react';
import { format } from 'date-fns';
import { ShieldCheck, AlertOctagon, Globe, Activity, Lock, CheckCircle2 } from 'lucide-react';

const ACTIVE_PROTECTION_POLICIES = [
  {
    id: 'pol-rls-isolation',
    name: 'Isolamento Multi-Tenant Estrito (Row-Level Security)',
    category: 'Controle de Acesso',
    rule: 'Bloqueio automático de queries cross-tenant sem company_id validado no token JWT.',
    status: 'Ativa',
    enforcement: 'Bloqueio Imediato',
  },
  {
    id: 'pol-rate-limit-waf',
    name: 'Rate Limiting & Proteção Anti-Brute Force',
    category: 'Proteção de Borda',
    rule: 'Limite de 5 tentativas de autenticação por IP a cada 15 minutos com quarentena automática.',
    status: 'Ativa',
    enforcement: 'Bloqueio de IP',
  },
  {
    id: 'pol-mfa-step-up',
    name: 'Desafio MFA / Step-Up para Operações Críticas',
    category: 'Autenticação Forte',
    rule: 'Exige confirmação adicional e justificativa em ações destrutivas (anonimização, exclusão, impersonação).',
    status: 'Ativa',
    enforcement: 'Obrigatório',
  },
  {
    id: 'pol-immutable-audit',
    name: 'Trilha de Auditoria Imutável (Append-Only)',
    category: 'Conformidade & Rastreabilidade',
    rule: 'Gravação criptografada de estado anterior/posterior, IP, correlation_id e ator em todas as mutações.',
    status: 'Ativa',
    enforcement: 'Contínuo (24/7)',
  },
  {
    id: 'pol-lgpd-sanitization',
    name: 'Mascaramento & Sanitização Automática LGPD (Art. 18 e 46)',
    category: 'Privacidade de Dados',
    rule: 'Sanitização de dados pessoais sensíveis em exportações e anonimização irreversível sob demanda.',
    status: 'Ativa',
    enforcement: 'Automático',
  },
  {
    id: 'pol-impersonation-ttl',
    name: 'Governança de Acesso Assistido (Impersonação com TTL)',
    category: 'Segurança Operacional',
    rule: 'Sessões de suporte expiram automaticamente em 30 minutos e registram início e encerramento.',
    status: 'Ativa',
    enforcement: 'Expiração Estrita',
  },
];

export default function ComplianceSecurity({ auditLogs = [], privacyLogs = [], companies = [] }) {
  const suspicious = useMemo(() =>
    [...auditLogs, ...privacyLogs]
      .filter(l => l.severity === 'critical' || l.severity === 'warning')
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 100),
    [auditLogs, privacyLogs]);

  const criticalCount = suspicious.filter(l => l.severity === 'critical').length;
  const warningCount  = suspicious.filter(l => l.severity === 'warning').length;

  // IPs únicos nos logs recentes
  const recentIps = useMemo(() => {
    const ipMap = {};
    [...auditLogs, ...privacyLogs].forEach(l => {
      if (l.ip_address) {
        if (!ipMap[l.ip_address]) ipMap[l.ip_address] = { ip: l.ip_address, count: 0, last: l.created_date };
        ipMap[l.ip_address].count++;
        if (new Date(l.created_date) > new Date(ipMap[l.ip_address].last)) ipMap[l.ip_address].last = l.created_date;
      }
    });
    return Object.values(ipMap).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [auditLogs, privacyLogs]);

  // Ações mais frequentes
  const topActions = useMemo(() => {
    const map = {};
    auditLogs.forEach(l => { if (l.action) { map[l.action] = (map[l.action]||0)+1; } });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
  }, [auditLogs]);

  const SEV = {
    critical: { dot:'bg-red-500',   badge:'bg-red-500/15 text-red-500 border-red-500/30' },
    warning:  { dot:'bg-amber-400', badge:'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid sm:grid-cols-5 gap-3">
        {[
          { label: 'Políticas ativas', value: ACTIVE_PROTECTION_POLICIES.length, color:'text-emerald-500' },
          { label: 'Logs críticos',    value: criticalCount, color:'text-red-500' },
          { label: 'Avisos',           value: warningCount,  color:'text-amber-500' },
          { label: 'IPs únicos',       value: recentIps.length, color:'text-blue-500' },
          { label: 'Ações distintas',  value: topActions.length, color:'text-violet-500' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 shadow-sm text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Políticas de Proteção Ativas */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden" data-testid="active-protection-policies">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-500" />
            <div>
              <h3 className="font-bold text-sm text-foreground">Políticas de Proteção Ativas (Active Protection Policies)</h3>
              <p className="text-[11px] text-muted-foreground">Regras de segurança e governança em execução contínua na plataforma</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> {ACTIVE_PROTECTION_POLICIES.length} Políticas Ativas
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {ACTIVE_PROTECTION_POLICIES.map((policy) => (
            <div
              key={policy.id}
              data-testid={`security-policy-${policy.id}`}
              className="rounded-xl border border-border bg-muted/30 p-3.5 flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                    {policy.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> {policy.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-foreground">{policy.name}</div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{policy.rule}</p>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/60 flex items-center justify-between">
                <span>Modo: {policy.enforcement}</span>
                <span className="text-emerald-400 font-semibold">ENFORCED</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Eventos suspeitos */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-500" />
            <span className="font-bold text-sm text-foreground">Eventos de risco</span>
          </div>
          {suspicious.length === 0 ? (
            <div className="p-8 text-center">
              <ShieldCheck className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum evento suspeito detectado.</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {suspicious.map(log => {
                const s = SEV[log.severity] || SEV.warning;
                return (
                  <div key={log.id} className="px-4 py-2.5 flex items-start gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>{log.severity?.toUpperCase()}</span>
                        <span className="text-[12px] font-semibold text-foreground font-mono truncate">{log.action}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {log.actor_email && `${log.actor_email} · `}
                        {log.company_id && `${companies.find(c=>c.id===log.company_id)?.name || log.company_id.slice(-6)} · `}
                        {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm") : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* IPs mais ativos + top ações */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold text-sm text-foreground">IPs mais ativos</span>
            </div>
            {recentIps.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Nenhum IP registrado nos logs.</div>
            ) : (
              <div className="divide-y divide-border">
                {recentIps.map(ip => (
                  <div key={ip.ip} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-[12px] font-mono text-foreground">{ip.ip}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{ip.count} ações</span>
                      <span className="text-[11px] text-muted-foreground">{ip.last ? format(new Date(ip.last), "dd/MM HH:mm") : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold text-sm text-foreground">APIs mais chamadas</span>
            </div>
            <div className="divide-y divide-border">
              {topActions.map(([action, count]) => (
                <div key={action} className="px-4 py-2 flex items-center justify-between gap-3">
                  <span className="text-[12px] font-mono text-foreground truncate">{action}</span>
                  <span className="text-[12px] font-bold text-blue-500 flex-shrink-0">{count}×</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}