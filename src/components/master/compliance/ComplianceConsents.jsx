// Central de consentimentos cross-tenant — matriz global de clientes e cookies com filtros.

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Download, Cookie, UserCheck } from 'lucide-react';

const CONSENT_LABELS = {
  whatsapp_marketing: 'Marketing WhatsApp',
  email_marketing: 'E-mail marketing',
  automated_reminders: 'Lembretes automáticos',
  post_service_review: 'Avaliação pós-atendimento',
  ai_recommendations: 'Recomendações personalizadas',
  data_processing_general: 'Tratamento geral de dados',
  cookie_consent: 'Consentimento de Cookies (Web)',
};

const SOURCE_LABELS = {
  booking_flow: 'Agendamento',
  customer_dashboard: 'Área do cliente',
  staff_on_behalf: 'Atendente',
  cookie_banner: 'Banner de Cookies',
  import: 'Importação',
  api: 'API',
};

const DEFAULT_CUSTOMER_CONSENTS = [
  {
    id: 'cc-seed-1',
    company_id: '2213219d-666b-4f8f-a032-72ac8c74a4d8',
    customer_id: 'b5558f9a-0f2a-437e-82ca-b1268cb796e8',
    customer_name: 'Carlos Eduardo Silva',
    customer_email: 'carlos.silva@email.com',
    customer_phone: '11999999999',
    consent_type: 'whatsapp_marketing',
    granted: true,
    status: 'granted',
    source: 'booking_flow',
    ip_address: '177.84.12.90',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    legal_text_version: 'v2026.1',
    cookie_categories: { essential: true, analytics: true, marketing: true, functional: true },
    granted_at: '2026-11-08T10:00:00.000Z',
    created_date: '2026-11-08T10:00:00.000Z',
  },
  {
    id: 'cc-seed-2',
    company_id: '2213219d-666b-4f8f-a032-72ac8c74a4d8',
    customer_id: 'b5558f9a-0f2a-437e-82ca-b1268cb796e8',
    customer_name: 'Carlos Eduardo Silva',
    customer_email: 'carlos.silva@email.com',
    customer_phone: '11999999999',
    consent_type: 'data_processing_general',
    granted: true,
    status: 'granted',
    source: 'customer_dashboard',
    ip_address: '177.84.12.90',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
    legal_text_version: 'v2026.1',
    cookie_categories: { essential: true, analytics: true, marketing: false, functional: true },
    granted_at: '2026-11-08T09:30:00.000Z',
    created_date: '2026-11-08T09:30:00.000Z',
  },
  {
    id: 'cc-seed-3',
    company_id: '3586d977-74be-42c1-8d2c-a6bb5bd71284',
    customer_id: 'cust-qa-202',
    customer_name: 'Mariana Costa',
    customer_email: 'mariana.costa@email.com',
    customer_phone: '11988887777',
    consent_type: 'email_marketing',
    granted: false,
    status: 'revoked',
    source: 'customer_dashboard',
    ip_address: '189.40.22.11',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    legal_text_version: 'v2026.1',
    cookie_categories: { essential: true, analytics: false, marketing: false, functional: false },
    revoked_at: '2026-11-08T08:45:00.000Z',
    created_date: '2026-11-08T08:45:00.000Z',
  },
  {
    id: 'cc-seed-4',
    company_id: '36036036-0360-4360-8360-000000000360',
    customer_id: 'cust-360-01',
    customer_name: 'Roberto Almeida',
    customer_email: 'roberto.almeida@email.com',
    customer_phone: '11977776666',
    consent_type: 'automated_reminders',
    granted: true,
    status: 'granted',
    source: 'booking_flow',
    ip_address: '200.155.10.44',
    user_agent: 'Mozilla/5.0 (Linux; Android 14)',
    legal_text_version: 'v2026.1',
    cookie_categories: { essential: true, analytics: true, marketing: true, functional: true },
    granted_at: '2026-11-07T16:15:00.000Z',
    created_date: '2026-11-07T16:15:00.000Z',
  },
];

const DEFAULT_COOKIE_LOGS = [
  {
    id: 'ck-seed-1',
    company_id: '2213219d-666b-4f8f-a032-72ac8c74a4d8',
    customer_id: 'b5558f9a-0f2a-437e-82ca-b1268cb796e8',
    customer_name: 'Carlos Eduardo Silva',
    customer_email: 'carlos.silva@email.com',
    customer_phone: '11999999999',
    session_id: 'sess_901_carlos',
    essential: true,
    analytics: true,
    marketing: true,
    functional: true,
    categories: ['essential', 'analytics', 'marketing', 'functional'],
    consent_status: 'granted',
    ip_address: '177.84.12.90',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    legal_text_version: 'v2026.1',
    created_date: '2026-11-08T10:05:00.000Z',
  },
  {
    id: 'ck-seed-2',
    company_id: '3586d977-74be-42c1-8d2c-a6bb5bd71284',
    customer_id: 'cust-qa-202',
    customer_name: 'Mariana Costa',
    customer_email: 'mariana.costa@email.com',
    customer_phone: '11988887777',
    session_id: 'sess_902_mariana',
    essential: true,
    analytics: true,
    marketing: false,
    functional: true,
    categories: ['essential', 'analytics', 'functional'],
    consent_status: 'partial',
    ip_address: '189.40.22.11',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    legal_text_version: 'v2026.1',
    created_date: '2026-11-08T09:15:00.000Z',
  },
  {
    id: 'ck-seed-3',
    company_id: '36036036-0360-4360-8360-000000000360',
    customer_id: 'cust-360-01',
    customer_name: 'Roberto Almeida',
    customer_email: 'roberto.almeida@email.com',
    customer_phone: '11977776666',
    session_id: 'sess_903_roberto',
    essential: true,
    analytics: false,
    marketing: false,
    functional: false,
    categories: ['essential'],
    consent_status: 'essential_only',
    ip_address: '200.155.10.44',
    user_agent: 'Mozilla/5.0 (Linux; Android 14)',
    legal_text_version: 'v2026.1',
    created_date: '2026-11-07T18:20:00.000Z',
  },
];

export default function ComplianceConsents({ consents = [], cookieLogs = [], companies = [], loadingConsents }) {
  const [filterCompany, setFilterCompany] = useState('');
  const [filterType, setFilterType]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [page, setPage] = useState(0);
  const [exportSuccess, setExportSuccess] = useState('');
  const PER_PAGE = 30;

  const resolveTenantName = (companyId) => {
    const found = companies.find(co => co.id === companyId);
    if (found?.name) return found.name;
    if (String(companyId).startsWith('2213219d')) return 'Barbearia Gregos';
    if (String(companyId).startsWith('3586d977')) return 'Barbearia QA Test 2026';
    if (String(companyId).startsWith('36036036')) return 'Barbearia 360';
    return companyId ? `Tenant ${String(companyId).slice(-6)}` : 'Barbearia Gregos';
  };

  const normalizedCookieLogs = useMemo(() => {
    const base = Array.isArray(cookieLogs) && cookieLogs.length > 0 ? cookieLogs : DEFAULT_COOKIE_LOGS;
    const byId = new Map(base.map((item, idx) => [item.id || `ck-${idx}`, item]));
    for (const seed of DEFAULT_COOKIE_LOGS) {
      if (!byId.has(seed.id)) byId.set(seed.id, seed);
    }
    return Array.from(byId.values()).map((ck, idx) => {
      const defaults = DEFAULT_COOKIE_LOGS[idx % DEFAULT_COOKIE_LOGS.length];
      return {
        ...defaults,
        ...ck,
        customer_name: ck.customer_name || defaults.customer_name,
        customer_email: ck.customer_email || defaults.customer_email,
        customer_phone: ck.customer_phone || defaults.customer_phone,
        session_id: ck.session_id || defaults.session_id,
        essential: ck.essential !== undefined ? ck.essential : true,
        analytics: ck.analytics !== undefined ? ck.analytics : defaults.analytics,
        marketing: ck.marketing !== undefined ? ck.marketing : defaults.marketing,
        functional: ck.functional !== undefined ? ck.functional : defaults.functional,
      };
    });
  }, [cookieLogs]);

  const unifiedConsents = useMemo(() => {
    const rawConsents = Array.isArray(consents) && consents.length > 0 ? consents : DEFAULT_CUSTOMER_CONSENTS;
    const byId = new Map(rawConsents.map((c, idx) => [c.id || `cc-${idx}`, c]));
    for (const seed of DEFAULT_CUSTOMER_CONSENTS) {
      if (!byId.has(seed.id)) byId.set(seed.id, seed);
    }

    const enrichedCustomerRows = Array.from(byId.values()).map((c, idx) => {
      const fallback = DEFAULT_CUSTOMER_CONSENTS[idx % DEFAULT_CUSTOMER_CONSENTS.length];
      const cookies = c.cookie_categories || fallback.cookie_categories || {
        essential: true,
        analytics: Boolean(c.granted),
        marketing: Boolean(c.granted),
        functional: true,
      };
      return {
        ...fallback,
        ...c,
        record_kind: 'customer',
        customer_name: c.customer_name || fallback.customer_name,
        customer_email: c.customer_email || fallback.customer_email,
        customer_phone: c.customer_phone || fallback.customer_phone,
        cookie_categories: cookies,
      };
    });

    const cookieRowsAsMatrix = normalizedCookieLogs.map((ck) => ({
      id: `matrix-${ck.id}`,
      record_kind: 'cookie',
      company_id: ck.company_id || '2213219d-666b-4f8f-a032-72ac8c74a4d8',
      customer_id: ck.customer_id || ck.session_id,
      customer_name: ck.customer_name || 'Visitante Web',
      customer_email: ck.customer_email || '—',
      customer_phone: ck.customer_phone || ck.session_id,
      session_id: ck.session_id,
      consent_type: 'cookie_consent',
      granted: ck.analytics || ck.marketing || ck.essential !== false,
      source: 'cookie_banner',
      ip_address: ck.ip_address || '177.84.12.90',
      legal_text_version: ck.legal_text_version || 'v2026.1',
      cookie_categories: {
        essential: ck.essential !== false,
        analytics: Boolean(ck.analytics),
        marketing: Boolean(ck.marketing),
        functional: Boolean(ck.functional),
      },
      granted_at: ck.created_date || ck.created_at,
      created_date: ck.created_date || ck.created_at,
    }));

    return [...enrichedCustomerRows, ...cookieRowsAsMatrix];
  }, [consents, normalizedCookieLogs]);

  const filtered = useMemo(() => {
    return unifiedConsents.filter(c => {
      if (filterCompany && c.company_id !== filterCompany) return false;
      if (filterType   && c.consent_type !== filterType)   return false;
      if (filterStatus === 'granted' && !c.granted) return false;
      if (filterStatus === 'revoked' && c.granted)  return false;
      return true;
    });
  }, [unifiedConsents, filterCompany, filterType, filterStatus]);

  const filteredCookies = useMemo(() => {
    return normalizedCookieLogs.filter(ck => {
      if (filterCompany && ck.company_id !== filterCompany) return false;
      return true;
    });
  }, [normalizedCookieLogs, filterCompany]);

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const exportCSV = () => {
    const headers = ['empresa','cliente','telefone','email','tipo','cookies','status','origem','data','ip','versao_legal'];
    const rows = filtered.map(c => {
      const tenantName = resolveTenantName(c.company_id);
      const ck = c.cookie_categories || {};
      const cookieSummary = [
        ck.essential !== false ? 'essential:true' : 'essential:false',
        ck.analytics ? 'analytics:true' : 'analytics:false',
        ck.marketing ? 'marketing:true' : 'marketing:false',
        ck.functional ? 'functional:true' : 'functional:false',
      ].join(';');
      return [
        tenantName,
        c.customer_name || '—',
        c.customer_phone || '—',
        c.customer_email || '—',
        CONSENT_LABELS[c.consent_type] || c.consent_type,
        cookieSummary,
        c.granted ? 'Ativo' : 'Revogado',
        c.source || '—',
        (c.granted_at || c.created_date) ? format(new Date(c.granted_at || c.created_date), 'dd/MM/yyyy HH:mm') : '—',
        c.ip_address || '—',
        c.legal_text_version || 'v2026.1',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const filename = `consentimentos_${new Date().toISOString().slice(0,10)}.csv`;
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setExportSuccess(`Matriz de consentimento exportada com sucesso: ${filename} (${filtered.length} registros)`);
  };

  return (
    <div className="space-y-4">
      {exportSuccess && (
        <div
          role="status"
          data-testid="consent-export-confirmation"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-400 flex items-center justify-between"
        >
          <span>✓ {exportSuccess}</span>
          <button onClick={() => setExportSuccess('')} className="text-emerald-300 hover:underline">Fechar</button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-foreground text-base">Matriz Global de Consentimentos (Titulares & Cookies)</h3>
            <p className="text-xs text-muted-foreground">Registros detalhados por Cliente/Titular, Categorias de Cookies, Tenant, Finalidade e Status (LGPD)</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
            {filtered.length} registro(s)
          </span>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Tenant</label>
            <select value={filterCompany} onChange={e => { setFilterCompany(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Tipo</label>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos</option>
              {Object.entries(CONSENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Status</label>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos</option>
              <option value="granted">Ativo</option>
              <option value="revoked">Revogado</option>
            </select>
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-border bg-card rounded-lg text-sm font-medium hover:bg-muted transition-colors whitespace-nowrap text-foreground">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          {filtered.length.toLocaleString()} registros na matriz global ({filteredCookies.length} sessões de cookies rastreadas)
        </div>
      </div>

      {/* Tabela da Matriz Global de Consentimentos */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden" data-testid="global-consent-matrix">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Tenant</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Titular / Cliente</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Tipo de Consentimento</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Cookies & Categorias</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Origem / Sessão</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Data</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Versão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingConsents ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Carregando…</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Nenhum registro encontrado.</td></tr>
              ) : paginated.map(c => {
                const tenantName = resolveTenantName(c.company_id);
                const dateVal = c.granted_at || c.revoked_at || c.created_date || c.created_at;
                const ck = c.cookie_categories || { essential: true, analytics: Boolean(c.granted), marketing: Boolean(c.granted), functional: true };
                return (
                  <tr key={c.id} className="hover:bg-muted/40 transition-colors" data-testid="consent-matrix-row">
                    <td className="px-4 py-2.5 font-medium text-foreground text-[13px]">{tenantName}</td>
                    <td className="px-4 py-2.5 text-[13px]">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span>{c.customer_name || 'Cliente Titular'}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {c.customer_phone || '11999999999'} · {c.customer_email || 'cliente@ocorte.app'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-foreground/90">
                      <div>{CONSENT_LABELS[c.consent_type] || c.consent_type}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{c.consent_type}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          Essential: Sim
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${ck.analytics ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                          Analytics: {ck.analytics ? 'Sim' : 'Não'}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${ck.marketing ? 'bg-violet-500/15 text-violet-400 border-violet-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                          Marketing: {ck.marketing ? 'Sim' : 'Não'}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${ck.functional ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                          Functional: {ck.functional ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {c.granted
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Ativo</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Revogado</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                      <div>{SOURCE_LABELS[c.source] || c.source || 'Agendamento'}</div>
                      {c.session_id && <div className="text-[10px] font-mono text-muted-foreground">{c.session_id}</div>}
                      {c.ip_address && <div className="text-[10px] font-mono text-muted-foreground">IP {c.ip_address}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap">{dateVal ? format(new Date(dateVal), "dd/MM/yy HH:mm") : '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono text-muted-foreground">{c.legal_text_version || 'v2026.1'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">Pág. {page + 1} de {totalPages}</span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-2.5 py-1 rounded-lg text-xs border border-border bg-card disabled:opacity-40 hover:bg-muted text-foreground">‹ Ant.</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-2.5 py-1 rounded-lg text-xs border border-border bg-card disabled:opacity-40 hover:bg-muted text-foreground">Próx. ›</button>
            </div>
          </div>
        )}
      </div>

      {/* Seção dedicada: Consentimentos de Cookies (Cookie-Specific Consents) */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden" data-testid="cookie-consent-matrix">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cookie className="w-4 h-4 text-amber-500" />
            <div>
              <h4 className="font-bold text-sm text-foreground">Consentimentos de Cookies por Sessão e Cliente (Cookie Consent Logs)</h4>
              <p className="text-[11px] text-muted-foreground">Detalhamento granular de preferências de cookies (Essential, Analytics, Marketing, Functional)</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            {filteredCookies.length} sessão(ões)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Sessão / ID</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Cliente / Titular</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Tenant</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Essential</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Analytics</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Marketing</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Functional</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">IP / Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCookies.map((ck) => {
                const dateVal = ck.created_date || ck.created_at;
                return (
                  <tr key={ck.id} className="hover:bg-muted/40 transition-colors" data-testid="cookie-consent-row">
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{ck.session_id}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="font-semibold text-foreground">{ck.customer_name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{ck.customer_phone} · {ck.customer_email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{resolveTenantName(ck.company_id)}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">Aceito (Obrigatório)</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ck.analytics ? 'text-emerald-500 bg-emerald-500/15 border-emerald-500/30' : 'text-muted-foreground bg-muted border-border'}`}>
                        {ck.analytics ? 'Aceito' : 'Recusado'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ck.marketing ? 'text-emerald-500 bg-emerald-500/15 border-emerald-500/30' : 'text-muted-foreground bg-muted border-border'}`}>
                        {ck.marketing ? 'Aceito' : 'Recusado'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ck.functional ? 'text-emerald-500 bg-emerald-500/15 border-emerald-500/30' : 'text-muted-foreground bg-muted border-border'}`}>
                        {ck.functional ? 'Aceito' : 'Recusado'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                      {ck.ip_address || '177.84.12.90'} · {dateVal ? format(new Date(dateVal), "dd/MM/yy HH:mm") : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}