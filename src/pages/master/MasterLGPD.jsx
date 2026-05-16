// MasterLGPD — Central de Privacidade & LGPD para o Super Admin da plataforma.
// Permite visualizar logs de privacidade cross-tenant, exportar dados de clientes,
// anonimizar clientes de qualquer empresa, e ver consentimentos.

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Shield, Download, UserX, Search, Clock,
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, FileText,
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
  SENSITIVE_DATA_VIEWED: 'Dados sensíveis visualizados',
  CUSTOMER_DATA_ACCESSED: 'Dados acessados',
  CUSTOMER_DELETED: 'Cliente excluído',
  IMPERSONATION_STARTED: 'Impersonação iniciada',
  IMPERSONATION_ENDED: 'Impersonação encerrada',
  RETENTION_CLEANUP_RUN: 'Limpeza de retenção executada',
  MARKETING_SENT_WITHOUT_CONSENT: '⚠️ Marketing sem consentimento',
};

const SEVERITY_COLOR = {
  info: 'bg-blue-50 text-blue-700 border-blue-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-red-50 text-red-700 border-red-100',
};

export default function MasterLGPD() {
  const [activeTab, setActiveTab] = useState('logs');
  const [expandedLog, setExpandedLog] = useState(null);
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Todos os logs de privacidade (cross-tenant)
  const { data: privacyLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['master-privacy-logs'],
    queryFn: () => base44.entities.PrivacyAuditLog.list('-created_date', 200),
  });

  // Empresas para filtro
  const { data: companies = [] } = useQuery({
    queryKey: ['master-companies-list'],
    queryFn: () => base44.entities.Company.list('-created_date', 200),
  });

  // Busca cliente por telefone + empresa
  const { data: foundCustomers = [], isFetching: searching } = useQuery({
    queryKey: ['master-customer-search', selectedCompanyId, searchPhone],
    queryFn: () => base44.entities.Customer.filter({
      ...(selectedCompanyId ? { company_id: selectedCompanyId } : {}),
      phone: searchPhone,
    }),
    enabled: searchPhone.length >= 8,
  });

  // Consentimentos do cliente
  const { data: consentsData, isLoading: loadingConsents } = useQuery({
    queryKey: ['master-consents', selectedCompanyId, selectedCustomerId],
    queryFn: () => base44.functions.invoke('manageConsent', {
      action: 'list',
      company_id: selectedCompanyId,
      customer_id: selectedCustomerId,
    }),
    enabled: !!selectedCompanyId && !!selectedCustomerId,
  });
  const consents = consentsData?.data?.consents || [];

  // Exportar dados
  const exportMutation = useMutation({
    mutationFn: ({ customerId, companyId }) =>
      base44.functions.invoke('exportCustomerData', { company_id: companyId, customer_id: customerId }),
    onSuccess: (res) => {
      const data = res?.data?.data;
      if (!data) return;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados_${data.personal_data?.name?.replace(/\s+/g, '_') || 'export'}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  // Anonimizar
  const anonymizeMutation = useMutation({
    mutationFn: ({ customerId, companyId }) =>
      base44.functions.invoke('anonymizeCustomer', {
        company_id: companyId,
        customer_id: customerId,
        reason: 'anonimização via painel master',
      }),
    onSuccess: () => {
      setSelectedCustomerId(null);
      setSearchPhone('');
    },
  });

  const handleAnonymize = (customer) => {
    if (!confirm(`⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL.\n\nCliente "${customer.name}" terá dados pessoais removidos permanentemente.\n\nConfirmar anonimização?`)) return;
    anonymizeMutation.mutate({ customerId: customer.id, companyId: customer.company_id });
  };

  // Exportar CSV dos logs
  const handleExportCSV = () => {
    if (!privacyLogs.length) return;
    const headers = ['data', 'action', 'severity', 'actor_email', 'actor_type', 'company_id', 'customer_id'];
    // Proteção contra CSV injection (formula injection em Excel/LibreOffice)
    const safeCsv = (v) => {
      const s = String(v || '').replace(/"/g, '""');
      return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    };
    const rows = privacyLogs.map(l =>
      headers.map(h => `"${safeCsv(l[h])}"`).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lgpd_audit_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { key: 'logs', label: 'Auditoria LGPD' },
    { key: 'search', label: 'Dados por cliente' },
  ];

  const criticalCount = privacyLogs.filter(l => l.severity === 'critical').length;
  const warningCount = privacyLogs.filter(l => l.severity === 'warning').length;
  const anonymizedCount = privacyLogs.filter(l => l.action === 'DATA_ANONYMIZED').length;
  const exportCount = privacyLogs.filter(l => l.action === 'DATA_EXPORT_REQUESTED').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] ring-1 ring-[#DBEAFE] flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#111827] tracking-tight">Privacidade & LGPD</h1>
            <p className="text-sm text-[#6B7280]">Auditoria de privacidade cross-tenant · Direitos dos titulares</p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-black/10 bg-white hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de logs', value: privacyLogs.length, color: 'text-[#2563EB]' },
          { label: 'Críticos', value: criticalCount, color: 'text-red-600' },
          { label: 'Avisos', value: warningCount, color: 'text-amber-600' },
          { label: 'Anonimizações', value: anonymizedCount, color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-black/5 p-4 shadow-sm text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${activeTab === t.key ? 'bg-white text-[#111827] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: AUDITORIA ── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-black/5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="font-bold text-[#111827]">Registro de ações de privacidade (todos os tenants)</span>
          </div>
          {loadingLogs ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando logs…</div>
          ) : privacyLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma ação de privacidade registrada ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {privacyLogs.map(log => (
                <div key={log.id} className="px-5 py-3">
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_COLOR[log.severity] || SEVERITY_COLOR.info}`}>
                          {log.severity?.toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-[#111827]">{ACTION_LABEL[log.action] || log.action}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                        {log.actor_email && <span>Por: <strong>{log.actor_email}</strong></span>}
                        {log.company_id && <span>Empresa: <span className="font-mono">{log.company_id.slice(-6)}</span></span>}
                        {log.customer_id && <span>Cliente: <span className="font-mono">{log.customer_id.slice(-6)}</span></span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] text-gray-400">
                        {log.created_date ? format(new Date(log.created_date), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
                      </span>
                      {log.details && (
                        <button onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="text-gray-300 hover:text-gray-500">
                          {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedLog === log.id && log.details && (
                    <pre className="mt-2 text-[11px] text-gray-600 bg-gray-50 rounded-lg p-2 overflow-x-auto">
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
          <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
            <h3 className="font-bold text-[#111827] mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              Buscar cliente por telefone
            </h3>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Empresa (opcional)</label>
                <select
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                >
                  <option value="">Todas as empresas</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Telefone</label>
                <input
                  type="text"
                  placeholder="Ex: 11999999999"
                  value={searchPhone}
                  onChange={e => setSearchPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm text-[#111827] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            </div>
            {searching && <p className="text-xs text-gray-400">Buscando…</p>}
            {foundCustomers.length > 0 && (
              <div className="space-y-2 mt-2">
                {foundCustomers.map(c => {
                  const company = companies.find(co => co.id === c.company_id);
                  return (
                    <div key={c.id}
                      onClick={() => { setSelectedCustomerId(c.id); setSelectedCompanyId(c.company_id); }}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedCustomerId === c.id ? 'border-[#2563EB] bg-blue-50' : 'border-black/8 hover:border-black/15'}`}>
                      <div>
                        <div className="font-semibold text-sm text-[#111827]">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.phone} · {company?.name || c.company_id?.slice(-6)}</div>
                      </div>
                      {selectedCustomerId === c.id && <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />}
                    </div>
                  );
                })}
              </div>
            )}
            {searchPhone.length >= 8 && !searching && foundCustomers.length === 0 && (
              <p className="text-xs text-gray-400 mt-2">Nenhum cliente encontrado.</p>
            )}
          </div>

          {selectedCustomerId && selectedCompanyId && (
            <>
              {/* Consentimentos */}
              <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
                <h3 className="font-bold text-[#111827] mb-4">Consentimentos registrados</h3>
                {loadingConsents ? (
                  <p className="text-sm text-gray-400">Carregando…</p>
                ) : consents.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhum consentimento registrado para este cliente.</p>
                ) : (
                  <div className="space-y-2">
                    {consents.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-black/5 last:border-b-0">
                        <div>
                          <div className="text-sm font-semibold text-[#111827]">{CONSENT_LABELS[c.consent_type] || c.consent_type}</div>
                          <div className="text-xs text-gray-500">
                            {c.granted
                              ? <span className="text-emerald-600">Concedido em {c.granted_at ? format(new Date(c.granted_at), "dd/MM/yyyy HH:mm") : '—'}</span>
                              : <span className="text-red-500">Revogado {c.revoked_at ? format(new Date(c.revoked_at), "dd/MM/yyyy HH:mm") : ''}</span>}
                            {c.source && <span className="ml-2 opacity-60">via {c.source}</span>}
                          </div>
                        </div>
                        {c.granted
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ações LGPD */}
              <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
                <h3 className="font-bold text-[#111827] mb-1">Ações sobre os dados</h3>
                <p className="text-xs text-gray-500 mb-4">Exercício dos direitos do titular (LGPD Art. 18)</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => exportMutation.mutate({ customerId: selectedCustomerId, companyId: selectedCompanyId })}
                    disabled={exportMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#EFF6FF] text-[#2563EB] rounded-xl text-sm font-semibold hover:bg-[#DBEAFE] transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {exportMutation.isPending ? 'Exportando…' : 'Exportar dados (JSON)'}
                  </button>
                  <button
                    onClick={() => {
                      const customer = foundCustomers.find(c => c.id === selectedCustomerId);
                      if (customer) handleAnonymize(customer);
                    }}
                    disabled={anonymizeMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <UserX className="w-4 h-4" />
                    {anonymizeMutation.isPending ? 'Anonimizando…' : 'Anonimizar cliente'}
                  </button>
                </div>
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
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