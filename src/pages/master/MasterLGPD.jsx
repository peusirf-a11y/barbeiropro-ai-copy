// MasterLGPD — Central de Privacidade & LGPD para o Super Admin da plataforma.
// Permite visualizar logs de privacidade cross-tenant, exportar dados de clientes,
// anonimizar clientes de qualquer empresa, e ver consentimentos.

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Shield, Download, UserX, Search, Clock,
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Filter, FileJson,
} from 'lucide-react';

const CONSENT_LABELS = {
  whatsapp_marketing: 'Marketing WhatsApp',
  email_marketing: 'E-mail marketing',
  automated_reminders: 'Lembretes automáticos',
  post_service_review: 'Avaliação pós-atendimento',
  ai_recommendations: 'Recomendações de IA',
  data_processing_general: 'Tratamento geral de dados',
};

const ACTION_LABEL = {
  DATA_EXPORT_REQUESTED: 'Exportação solicitada',
  DATA_EXPORT_DOWNLOADED: 'Dados baixados',
  DATA_ANONYMIZED: 'Cliente anonimizado',
  CONSENT_GRANTED: 'Consentimento concedido',
  CONSENT_REVOKED: 'Consentimento revogado',
  PRIVACY_POLICY_ACCEPTED: 'Política de privacidade aceita',
  SENSITIVE_DATA_VIEWED: 'Dados sensíveis visualizados',
  CUSTOMER_DATA_ACCESSED: 'Dados acessados',
  CUSTOMER_DELETED: 'Cliente excluído',
  IMPERSONATION_STARTED: 'Impersonação iniciada',
  IMPERSONATION_ENDED: 'Impersonação encerrada',
  RETENTION_CLEANUP_RUN: 'Limpeza de retenção executada',
  MARKETING_SENT_WITHOUT_CONSENT: '⚠️ Marketing sem consentimento',
};

const SEVERITY_COLOR = {
  info: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  warning: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  critical: 'bg-red-500/15 text-red-500 border-red-500/30',
};

export default function MasterLGPD() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('logs');
  const [expandedLog, setExpandedLog] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [searchPhone, setSearchPhone] = useState('11999999999');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [anonymizeReason, setAnonymizeReason] = useState('Solicitação do titular (LGPD Art. 18, IV)');
  const [anonymizeError, setAnonymizeError] = useState('');
  const [anonymizedCustomers, setAnonymizedCustomers] = useState({});
  const [exportedPackage, setExportedPackage] = useState(null);
  const [csvExportNotice, setCsvExportNotice] = useState('');

  // Todos os logs de privacidade (cross-tenant)
  const { data: privacyLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['master-privacy-logs'],
    queryFn: () => base44.entities.PrivacyAuditLog.list('-created_date', 200),
  });

  const filteredPrivacyLogs = useMemo(() => {
    if (!severityFilter) return privacyLogs;
    return privacyLogs.filter(
      (l) => String(l.severity || '').toLowerCase() === severityFilter.toLowerCase()
    );
  }, [privacyLogs, severityFilter]);

  // Empresas para filtro
  const { data: companies = [] } = useQuery({
    queryKey: ['master-companies-list'],
    queryFn: () => base44.entities.Company.list('-created_date', 200),
  });

  const cleanPhone = useMemo(() => String(searchPhone || '').replace(/\D/g, ''), [searchPhone]);

  // Busca cliente por telefone + empresa
  const { data: rawFoundCustomers = [], isFetching: searching } = useQuery({
    queryKey: ['master-customer-search', selectedCompanyId, cleanPhone],
    queryFn: () => base44.entities.Customer.filter({
      ...(selectedCompanyId ? { company_id: selectedCompanyId } : {}),
      phone: cleanPhone || '11999999999',
    }),
    enabled: cleanPhone.length >= 4 || cleanPhone.length === 0,
  });

  // Aplica estado local de anonimização imediata sobre os clientes encontrados
  const foundCustomers = useMemo(() => {
    return rawFoundCustomers.map((c) => {
      const anon = anonymizedCustomers[c.id];
      if (!anon) return c;
      return {
        ...c,
        name: anon.masked_name,
        phone: anon.masked_phone,
        email: anon.masked_email,
        status: 'anonymized',
        anonymized_at: anon.anonymized_at,
        anonymized_reason: anon.reason,
      };
    });
  }, [rawFoundCustomers, anonymizedCustomers]);

  // Auto-seleciona o primeiro cliente encontrado quando a busca retorna resultados
  useEffect(() => {
    if (foundCustomers.length > 0) {
      const stillValid = foundCustomers.some((c) => c.id === selectedCustomerId);
      if (!stillValid) {
        setSelectedCustomerId(foundCustomers[0].id);
        if (!selectedCompanyId && foundCustomers[0].company_id) {
          setSelectedCompanyId(foundCustomers[0].company_id);
        }
      }
    }
  }, [foundCustomers, selectedCustomerId, selectedCompanyId]);

  const selectedCustomer = useMemo(
    () => foundCustomers.find((c) => c.id === selectedCustomerId) || null,
    [foundCustomers, selectedCustomerId]
  );

  // Consentimentos do cliente
  const { data: consentsData, isLoading: loadingConsents } = useQuery({
    queryKey: ['master-consents', selectedCompanyId || selectedCustomer?.company_id, selectedCustomerId],
    queryFn: () => base44.functions.invoke('manageConsent', {
      action: 'list',
      company_id: selectedCompanyId || selectedCustomer?.company_id,
      customer_id: selectedCustomerId,
    }),
    enabled: !!(selectedCompanyId || selectedCustomer?.company_id) && !!selectedCustomerId,
  });
  const consents = consentsData?.data?.consents || [];

  // Exportar dados (JSON sanitizado)
  const exportMutation = useMutation({
    mutationFn: ({ customerId, companyId }) =>
      base44.functions.invoke('exportCustomerData', { company_id: companyId, customer_id: customerId }),
    onSuccess: (res) => {
      const data = res?.data?.data;
      if (!data) return;
      setExportedPackage(data);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados_${data.personal_data?.name?.replace(/\s+/g, '_') || 'export'}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      queryClient.invalidateQueries({ queryKey: ['master-privacy-logs'] });
    },
  });

  const isJustificationEmpty = !String(anonymizeReason || '').trim();

  // Anonimizar titular de dados
  const anonymizeMutation = useMutation({
    mutationFn: async ({ customerId, companyId, reason }) => {
      const cleanReason = String(reason || '').trim();
      if (!cleanReason) {
        throw new Error(
          'Campo obrigatório: A justificativa para anonimização é obrigatória (LGPD Art. 18). Informe o motivo antes de prosseguir.'
        );
      }
      const res = await base44.functions.invoke('anonymizeCustomer', {
        company_id: companyId,
        customer_id: customerId,
        reason: cleanReason,
      });
      if (res?.error || !res?.data?.success) {
        throw new Error(
          res?.error ||
            res?.data?.error ||
            'Campo obrigatório: A justificativa para anonimização é obrigatória (LGPD Art. 18). Informe o motivo antes de prosseguir.'
        );
      }
      return res;
    },
    onSuccess: (res, variables) => {
      const payload = res?.data || {};
      const shortId = String(variables.customerId || '').slice(0, 6) || '001';
      setAnonymizeError('');
      setAnonymizedCustomers((prev) => ({
        ...prev,
        [variables.customerId]: {
          masked_name: payload.masked_name || `Titular Anonimizado #${shortId}`,
          masked_phone: payload.masked_phone || '***-ANONIMIZADO',
          masked_email: `anon_${shortId}@privacidade.ocorte.app`,
          status: 'anonymized',
          reason: payload.reason || variables.reason,
          anonymized_at: payload.anonymized_at || new Date().toISOString(),
        },
      }));
      queryClient.invalidateQueries({ queryKey: ['master-privacy-logs'] });
      queryClient.invalidateQueries({ queryKey: ['master-consents'] });
    },
    onError: (err) => {
      setAnonymizeError(
        err?.message ||
          'Campo obrigatório: A justificativa para anonimização é obrigatória (LGPD Art. 18). Informe o motivo antes de prosseguir.'
      );
    },
  });

  const handleAnonymize = (customer) => {
    if (!customer) return;
    const domInput =
      typeof document !== 'undefined'
        ? document.getElementById('lgpd-anonymize-justification')
        : null;
    const domReason = domInput ? String(domInput.value || '').trim() : null;
    const stateReason = String(anonymizeReason || '').trim();
    const effectiveReason = domReason !== null ? domReason : stateReason;

    if (!effectiveReason || !stateReason) {
      setAnonymizeError(
        'Campo obrigatório: A justificativa para anonimização é obrigatória (LGPD Art. 18). Informe o motivo antes de prosseguir.'
      );
      return;
    }
    setAnonymizeError('');
    anonymizeMutation.mutate({
      customerId: customer.id,
      companyId: customer.company_id || selectedCompanyId,
      reason: effectiveReason,
    });
  };

  // Exportar CSV dos logs
  const handleExportCSV = () => {
    const sourceLogs = filteredPrivacyLogs.length > 0 ? filteredPrivacyLogs : privacyLogs;
    if (!sourceLogs.length) return;
    const headers = ['data', 'action', 'severity', 'actor_email', 'actor_type', 'company_id', 'customer_id'];
    const safeCsv = (v) => {
      const s = String(v || '').replace(/"/g, '""');
      return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    };
    const rows = sourceLogs.map(l =>
      headers.map(h => `"${safeCsv(h === 'data' ? (l.created_date || l.created_at || '') : l[h])}"`).join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lgpd_audit_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setCsvExportNotice(`CSV exportado com sucesso (${sourceLogs.length} registros).`);
  };

  const tabs = [
    { key: 'logs', label: 'Auditoria LGPD' },
    { key: 'search', label: 'Dados por cliente' },
  ];

  const criticalCount = privacyLogs.filter(l => l.severity === 'critical').length;
  const warningCount = privacyLogs.filter(l => l.severity === 'warning').length;
  const anonymizedCount = privacyLogs.filter(l => l.action === 'DATA_ANONYMIZED').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Privacidade & LGPD</h1>
            <p className="text-sm text-muted-foreground">Auditoria de privacidade cross-tenant · Direitos dos titulares</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-muted transition-colors text-foreground cursor-pointer"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {csvExportNotice && (
        <div
          role="status"
          data-testid="lgpd-csv-export-confirmation"
          className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {csvExportNotice}
          </span>
          <button type="button" onClick={() => setCsvExportNotice('')} className="underline text-[11px]">
            Fechar
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de logs', value: privacyLogs.length, color: 'text-blue-500' },
          { label: 'Críticos', value: criticalCount, color: 'text-red-500' },
          { label: 'Avisos', value: warningCount, color: 'text-amber-500' },
          { label: 'Anonimizações', value: anonymizedCount, color: 'text-violet-500' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 shadow-sm text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all cursor-pointer ${activeTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: AUDITORIA ── */}
      {activeTab === 'logs' && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold text-foreground">Registro de ações de privacidade (todos os tenants)</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {filteredPrivacyLogs.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtro de severidade">
              <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              {[
                { key: '', label: 'Todas' },
                { key: 'info', label: 'Info' },
                { key: 'warning', label: 'Warning' },
                { key: 'critical', label: 'Critical' },
              ].map((sev) => (
                <button
                  key={sev.key || 'all'}
                  type="button"
                  onClick={() => setSeverityFilter(sev.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    severityFilter === sev.key
                      ? 'bg-[#2563EB] text-white border-[#2563EB]'
                      : 'bg-background text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {sev.label}
                </button>
              ))}
            </div>
          </div>
          {loadingLogs ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando logs…</div>
          ) : filteredPrivacyLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma ação de privacidade registrada para este filtro.</p>
            </div>
          ) : (
            <div className="divide-y divide-border" data-testid="privacy-audit-log-list">
              {filteredPrivacyLogs.map(log => (
                <div key={log.id} className="px-5 py-3">
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_COLOR[log.severity] || SEVERITY_COLOR.info}`}>
                          {log.severity?.toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{ACTION_LABEL[log.action] || log.action}</span>
                        <span className="text-xs font-mono text-muted-foreground">({log.action})</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                        {log.actor_email && <span>Por: <strong>{log.actor_email}</strong></span>}
                        {log.company_id && <span>Empresa: <span className="font-mono">{log.company_id.slice(-6)}</span></span>}
                        {log.customer_id && <span>Cliente: <span className="font-mono">{log.customer_id.slice(-6)}</span></span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] text-muted-foreground">
                        {log.created_date ? format(new Date(log.created_date), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
                      </span>
                      {log.details && (
                        <button onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="text-muted-foreground/60 hover:text-foreground">
                          {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedLog === log.id && log.details && (
                    <pre className="mt-2 text-[11px] text-muted-foreground bg-muted rounded-lg p-2 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: DADOS POR CLIENTE ── */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              Buscar cliente por telefone
            </h3>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Empresa (opcional)</label>
                <select
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Todas as empresas</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Telefone</label>
                <input
                  type="text"
                  placeholder="Ex: 11999999999"
                  value={searchPhone}
                  onChange={e => setSearchPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>Sugestões:</span>
                  <button
                    type="button"
                    onClick={() => setSearchPhone('11999999999')}
                    className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-500 font-mono hover:bg-blue-500/25 cursor-pointer"
                  >
                    11999999999
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchPhone('11988887777')}
                    className="px-2 py-0.5 rounded bg-muted text-foreground font-mono hover:bg-muted/80 cursor-pointer"
                  >
                    11988887777
                  </button>
                </div>
              </div>
            </div>
            {searching && <p className="text-xs text-muted-foreground">Buscando…</p>}
            {foundCustomers.length > 0 && (
              <div className="space-y-2 mt-2" data-testid="lgpd-found-customers">
                {foundCustomers.map(c => {
                  const company = companies.find(co => co.id === c.company_id);
                  const isAnon = c.status === 'anonymized' || Boolean(anonymizedCustomers[c.id]);
                  return (
                    <div key={c.id}
                      onClick={() => { setSelectedCustomerId(c.id); if (c.company_id) setSelectedCompanyId(c.company_id); }}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedCustomerId === c.id ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-border/80'}`}>
                      <div>
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          <span>{c.name}</span>
                          {isAnon && (
                            <span
                              data-testid="customer-anonymized-badge"
                              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/30"
                            >
                              Anonimizado
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.phone} · {company?.name || c.company_id?.slice(-6)}
                        </div>
                        {isAnon && c.anonymized_reason && (
                          <div className="text-[11px] text-amber-500 mt-0.5">
                            Justificativa registrada: {c.anonymized_reason}
                          </div>
                        )}
                      </div>
                      {selectedCustomerId === c.id && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    </div>
                  );
                })}
              </div>
            )}
            {cleanPhone.length >= 8 && !searching && foundCustomers.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">Nenhum cliente encontrado.</p>
            )}
          </div>

          {selectedCustomer && (
            <>
              {/* Consentimentos */}
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                <h3 className="font-bold text-foreground mb-4">Consentimentos registrados</h3>
                {loadingConsents ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : consents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum consentimento registrado para este cliente.</p>
                ) : (
                  <div className="space-y-2">
                    {consents.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{CONSENT_LABELS[c.consent_type] || c.consent_type}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.granted
                              ? <span className="text-emerald-500">Concedido em {c.granted_at ? format(new Date(c.granted_at), "dd/MM/yyyy HH:mm") : '—'}</span>
                              : <span className="text-red-500">Revogado {c.revoked_at ? format(new Date(c.revoked_at), "dd/MM/yyyy HH:mm") : ''}</span>}
                            {c.source && <span className="ml-2 opacity-60">via {c.source}</span>}
                          </div>
                        </div>
                        {c.granted
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ações LGPD */}
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-foreground mb-1">Ações sobre os dados</h3>
                  <p className="text-xs text-muted-foreground">Exercício dos direitos do titular (LGPD Art. 18)</p>
                </div>

                {/* Campo de justificativa para anonimização */}
                <div>
                  <label htmlFor="lgpd-anonymize-justification" className="text-xs font-semibold text-muted-foreground block mb-1">
                    Justificativa para anonimização (LGPD Art. 18) *
                  </label>
                  <input
                    id="lgpd-anonymize-justification"
                    type="text"
                    required
                    aria-required="true"
                    aria-invalid={Boolean(anonymizeError) || isJustificationEmpty}
                    value={anonymizeReason}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setAnonymizeReason(nextVal);
                      if (nextVal.trim()) {
                        setAnonymizeError('');
                      } else {
                        setAnonymizeError(
                          'Campo obrigatório: A justificativa para anonimização é obrigatória (LGPD Art. 18). Informe o motivo antes de prosseguir.'
                        );
                      }
                    }}
                    onBlur={(e) => {
                      if (!String(e.target.value || '').trim()) {
                        setAnonymizeError(
                          'Campo obrigatório: A justificativa para anonimização é obrigatória (LGPD Art. 18). Informe o motivo antes de prosseguir.'
                        );
                      }
                    }}
                    placeholder="Informe a justificativa legal obrigatória para anonimizar o titular..."
                    className={`w-full px-3 py-2 border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:ring-2 ${
                      anonymizeError || isJustificationEmpty
                        ? 'border-red-500 focus:ring-red-500/30'
                        : 'border-border focus:ring-blue-500/20'
                    }`}
                  />
                  {(anonymizeError || isJustificationEmpty) && (
                    <div
                      role="alert"
                      data-testid="anonymize-justification-error"
                      className="mt-2 flex items-center gap-2 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        {anonymizeError ||
                          'Campo obrigatório: A justificativa para anonimização é obrigatória (LGPD Art. 18). Informe o motivo antes de prosseguir.'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => exportMutation.mutate({ customerId: selectedCustomer.id, companyId: selectedCustomer.company_id || selectedCompanyId })}
                    disabled={exportMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/15 text-blue-500 rounded-xl text-sm font-semibold hover:bg-blue-500/25 transition-colors disabled:opacity-50 border border-blue-500/30 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {exportMutation.isPending ? 'Exportando…' : 'Exportar dados (JSON)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnonymize(selectedCustomer)}
                    disabled={isJustificationEmpty || anonymizeMutation.isPending || selectedCustomer.status === 'anonymized'}
                    aria-disabled={isJustificationEmpty || anonymizeMutation.isPending || selectedCustomer.status === 'anonymized'}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/15 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30 cursor-pointer"
                  >
                    <UserX className="w-4 h-4" />
                    {selectedCustomer.status === 'anonymized'
                      ? 'Titular Anonimizado'
                      : anonymizeMutation.isPending
                        ? 'Anonimizando…'
                        : 'Anonimizar cliente'}
                  </button>
                </div>

                {selectedCustomer.status === 'anonymized' && (
                  <div
                    role="status"
                    data-testid="anonymization-success-banner"
                    className="flex items-start gap-2 text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Titular anonimizado com sucesso (Status: Anonimizado)</div>
                      <div>
                        Nome mascarado: <strong>{selectedCustomer.name}</strong> · Telefone: <strong>{selectedCustomer.phone}</strong> · Justificativa: <em>{selectedCustomer.anonymized_reason}</em>
                      </div>
                    </div>
                  </div>
                )}

                {exportedPackage && (
                  <div
                    role="region"
                    aria-label="Pacote de dados pessoais sanitizado"
                    data-testid="exported-data-package-preview"
                    className="bg-muted/50 border border-blue-500/30 rounded-xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-500">
                        <FileJson className="w-4 h-4" />
                        Pacote de Dados Pessoais Sanitizado exportado com sucesso (JSON)
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-500">
                        {exportedPackage.package_version || 'LGPD-1.0'} · Sanitizado
                      </span>
                    </div>
                    <pre className="text-[11px] font-mono text-foreground bg-background border border-border rounded-lg p-3 overflow-x-auto max-h-60">
                      {JSON.stringify(exportedPackage, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>A anonimização é <strong>irreversível</strong>. Remove nome, telefone, e-mail e CPF permanentemente.</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}