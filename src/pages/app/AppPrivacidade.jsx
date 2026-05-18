// Central de Privacidade & LGPD — Configurações → Privacidade
// Permite ao admin: ver logs de privacidade, exportar dados de clientes,
// anonimizar clientes, e visualizar consentimentos por cliente.

import AppLayout from '@/components/layout/AppLayout';
import AppPageHeader from '@/components/app/AppPageHeader';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useState } from 'react';
import { Shield, Download, UserX, Search, Clock, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, FileText, Cookie } from 'lucide-react';
import CookiePreferencesModal from '@/components/cookies/CookiePreferencesModal';
import { getConsentState, COOKIE_CATEGORIES, hasConsent } from '@/lib/cookieConsent';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

const CONSENT_LABELS = {
  whatsapp_marketing: 'Marketing WhatsApp',
  email_marketing: 'E-mail marketing',
  automated_reminders: 'Lembretes automáticos',
  post_service_review: 'Avaliação pós-atendimento',
  ai_recommendations: 'Recomendações de IA',
  data_processing_general: 'Tratamento geral de dados',
};

function CookiesTab({ onOpenModal }) {
  const state = getConsentState();
  const categories = Object.values(COOKIE_CATEGORIES);

  return (
    <div className="space-y-4">
      {/* Status atual */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Cookie className="w-4 h-4 text-white/50" />
            Preferências de cookies do navegador
          </h3>
          <button
            onClick={onOpenModal}
            className="text-xs font-bold px-3 py-1.5 bg-blue-400/12 text-[#93C5FD] ring-1 ring-blue-400/25 rounded-lg hover:bg-blue-400/20 transition-colors"
          >
            Gerenciar
          </button>
        </div>
        {!state ? (
          <div className="text-sm text-amber-200 bg-amber-400/10 border border-amber-400/25 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0" />
            Consentimento ainda não registrado neste navegador.
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map(cat => {
              const accepted = cat.always_on || hasConsent(cat.id);
              return (
                <div key={cat.id} className="flex items-center justify-between py-2 border-b border-white/6 last:border-b-0">
                  <div>
                    <div className="text-sm font-semibold text-white">{cat.label}</div>
                    <div className="text-xs text-white/55">{cat.description}</div>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    {cat.always_on ? (
                      <span className="text-[10px] font-bold text-white/55 bg-white/8 px-2 py-0.5 rounded-full">Sempre ativo</span>
                    ) : accepted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-400/15 ring-1 ring-emerald-400/30 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Aceito
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/60 bg-white/8 ring-1 ring-white/10 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3" /> Recusado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="text-[11px] text-white/40 pt-1">
              Versão da política: <strong className="text-white/70">{state.policy_version}</strong> ·
              Consentido em: <strong className="text-white/70">{state.consented_at ? new Date(state.consented_at).toLocaleDateString('pt-BR') : '—'}</strong> ·
              Expira em: <strong className="text-white/70">{state.expires_at ? new Date(state.expires_at).toLocaleDateString('pt-BR') : '—'}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Documentação */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-400/12 ring-1 ring-blue-400/25 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-[#93C5FD]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-white">Política de Cookies</div>
          <div className="text-xs text-white/55 mt-0.5">Categorias, finalidades, retenção, terceiros e como revogar.</div>
          <div className="text-[10px] text-white/30 mt-0.5 font-mono">docs/COOKIE_POLICY.md</div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30 flex-shrink-0">✓ Criada</span>
      </div>

      {/* Info LGPD */}
      <div className="bg-blue-400/10 border border-blue-400/25 rounded-2xl p-4 text-xs text-blue-100 leading-relaxed">
        <strong>Modo Privacidade:</strong> Quando o usuário recusa analytics e marketing, eventos internos são anonimizados, fingerprinting é desabilitado e nenhum script de tracking é carregado. Consentimento expira em <strong>6 meses</strong> e é revalidado automaticamente.
      </div>
    </div>
  );
}

export default function AppPrivacidade() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [activeTab, setActiveTab] = useState('logs');
  const [expandedLog, setExpandedLog] = useState(null);
  const [showCookieModal, setShowCookieModal] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });
  const company = companies.find(c => c.owner_email === user?.email) || companies[0];

  // Privacy audit logs
  const { data: privacyLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['privacy-audit-logs', company?.id],
    queryFn: () => base44.entities.PrivacyAuditLog.filter(
      { company_id: company.id }, '-created_date', 100
    ),
    enabled: !!company?.id,
  });

  // Busca cliente por telefone
  const { data: foundCustomers = [], isFetching: searching } = useQuery({
    queryKey: ['customer-search-privacy', company?.id, searchPhone],
    queryFn: () => base44.entities.Customer.filter({ company_id: company.id, phone: searchPhone }),
    enabled: !!company?.id && searchPhone.length >= 8,
  });

  // Consentimentos do cliente selecionado
  const { data: consentsData, isLoading: loadingConsents } = useQuery({
    queryKey: ['consents', company?.id, selectedCustomerId],
    queryFn: () => base44.functions.invoke('manageConsent', {
      action: 'list',
      company_id: company.id,
      customer_id: selectedCustomerId,
    }),
    enabled: !!company?.id && !!selectedCustomerId,
  });
  const consents = consentsData?.data?.consents || [];

  // Exportar dados
  const exportMutation = useMutation({
    mutationFn: (customerId) => base44.functions.invoke('exportCustomerData', {
      company_id: company.id,
      customer_id: customerId,
    }),
    onSuccess: (res) => {
      const data = res?.data?.data;
      if (!data) return;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados_cliente_${data.personal_data?.name?.replace(/\s+/g, '_') || 'export'}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportação concluída', description: 'Arquivo JSON baixado com sucesso.' });
    },
    onError: () => toast({ title: 'Erro na exportação', variant: 'destructive' }),
  });

  // Anonimizar cliente
  const anonymizeMutation = useMutation({
    mutationFn: ({ customerId, reason }) => base44.functions.invoke('anonymizeCustomer', {
      company_id: company.id,
      customer_id: customerId,
      reason,
    }),
    onSuccess: (res) => {
      toast({ title: 'Cliente anonimizado', description: res?.data?.message });
      setSelectedCustomerId(null);
      setSearchPhone('');
    },
    onError: (err) => toast({ title: 'Erro', description: err?.response?.data?.error || 'Erro ao anonimizar', variant: 'destructive' }),
  });

  const handleAnonymize = (customer) => {
    if (!confirm(`⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL.\n\nO cliente "${customer.name}" terá nome, telefone, e-mail e dados pessoais removidos.\nDados financeiros e operacionais são mantidos.\n\nConfirmar anonimização?`)) return;
    anonymizeMutation.mutate({ customerId: customer.id, reason: 'solicitação via painel admin' });
  };

  const severityColor = {
    info: 'bg-blue-400/15 text-blue-200 ring-1 ring-blue-400/30',
    warning: 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30',
    critical: 'bg-red-400/15 text-red-200 ring-1 ring-red-400/30',
  };

  const actionLabel = {
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

  const tabs = [
    { key: 'logs', label: 'Auditoria LGPD' },
    { key: 'search', label: 'Dados por cliente' },
    { key: 'cookies', label: 'Cookies' },
    { key: 'docs', label: 'Documentação' },
  ];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Privacidade & LGPD"
          subtitle="Central de compliance, consentimentos e direitos dos titulares"
          icon={Shield}
        />

        {/* Status bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Logs de auditoria', value: privacyLogs.length },
            { label: 'Consentimentos', value: '-' },
            { label: 'Exportações', value: privacyLogs.filter(l => l.action === 'DATA_EXPORT_REQUESTED').length },
            { label: 'Anonimizações', value: privacyLogs.filter(l => l.action === 'DATA_ANONYMIZED').length },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-3 text-center shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
              <div className="text-2xl font-black text-white">{s.value}</div>
              <div className="text-[10px] text-white/55 mt-0.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/[0.04] border border-white/8 rounded-xl p-1 mb-6">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${activeTab === t.key ? 'bg-white/[0.08] text-white ring-1 ring-blue-400/25 shadow-[0_4px_12px_rgba(37,99,235,0.2)]' : 'text-white/50 hover:text-white/80'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: AUDITORIA ── */}
        {activeTab === 'logs' && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8 flex items-center gap-2">
              <Clock className="w-4 h-4 text-white/50" />
              <span className="font-bold text-white">Registro de ações de privacidade</span>
            </div>
            {loadingLogs ? (
              <div className="p-8 text-center text-white/40 text-sm">Carregando logs…</div>
            ) : privacyLogs.length === 0 ? (
              <div className="p-8 text-center">
                <Shield className="w-8 h-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/40">Nenhuma ação de privacidade registrada ainda.</p>
                <p className="text-xs text-white/30 mt-1">Exportações, anonimizações e alterações de consentimento aparecerão aqui.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/6">
                {privacyLogs.map(log => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-start gap-3 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityColor[log.severity] || severityColor.info}`}>
                            {log.severity?.toUpperCase()}
                          </span>
                          <span className="text-sm font-semibold text-white">{actionLabel[log.action] || log.action}</span>
                        </div>
                        <div className="text-xs text-white/55 mt-0.5">
                          {log.actor_email && <span>Por: <strong className="text-white/75">{log.actor_email}</strong> · </span>}
                          {log.actor_type && <span className="capitalize">{log.actor_type}</span>}
                          {log.customer_id && <span> · Cliente: {log.customer_id.slice(-6)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-white/40">
                          {log.created_date ? format(new Date(log.created_date), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
                        </span>
                        {log.details && (
                          <button onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            className="text-white/30 hover:text-white/60">
                            {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedLog === log.id && log.details && (
                      <pre className="mt-2 text-[11px] text-white/70 bg-black/30 border border-white/8 rounded-lg p-2 overflow-x-auto">
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
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-white/50" />
                Buscar cliente por telefone
              </h3>
              <input
                type="text"
                placeholder="Ex: 11999999999"
                value={searchPhone}
                onChange={e => setSearchPhone(e.target.value)}
                className="w-full px-3 py-2.5 border border-white/10 bg-white/[0.03] rounded-lg text-sm text-white placeholder:text-white/30"
              />
              {searching && <p className="text-xs text-white/40 mt-2">Buscando…</p>}
              {foundCustomers.length > 0 && (
                <div className="mt-3 space-y-2">
                  {foundCustomers.map(c => (
                    <div key={c.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedCustomerId === c.id ? 'border-blue-400/40 bg-blue-400/10' : 'border-white/8 hover:border-white/15'}`}
                      onClick={() => setSelectedCustomerId(c.id)}>
                      <div>
                        <div className="font-semibold text-sm text-white">{c.name}</div>
                        <div className="text-xs text-white/55">{c.phone} · {c.total_appointments || 0} agendamentos</div>
                      </div>
                      {selectedCustomerId === c.id && <CheckCircle2 className="w-4 h-4 text-[#93C5FD]" />}
                    </div>
                  ))}
                </div>
              )}
              {searchPhone.length >= 8 && !searching && foundCustomers.length === 0 && (
                <p className="text-xs text-white/40 mt-2">Nenhum cliente encontrado.</p>
              )}
            </div>

            {selectedCustomerId && (
              <>
                {/* Consentimentos */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                  <h3 className="font-bold text-white mb-4">Consentimentos registrados</h3>
                  {loadingConsents ? (
                    <p className="text-sm text-white/40">Carregando…</p>
                  ) : consents.length === 0 ? (
                    <p className="text-sm text-white/40">Nenhum consentimento registrado para este cliente.</p>
                  ) : (
                    <div className="space-y-2">
                      {consents.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-white/6 last:border-b-0">
                          <div>
                            <div className="text-sm font-semibold text-white">{CONSENT_LABELS[c.consent_type] || c.consent_type}</div>
                            <div className="text-xs text-white/55">
                              {c.granted ? (
                                <span className="text-emerald-300">Concedido em {c.granted_at ? format(new Date(c.granted_at), "dd/MM/yyyy HH:mm") : '—'}</span>
                              ) : (
                                <span className="text-red-300">Revogado {c.revoked_at ? format(new Date(c.revoked_at), "dd/MM/yyyy HH:mm") : ''}</span>
                              )}
                              {c.source && <span className="ml-2 opacity-60">via {c.source}</span>}
                            </div>
                          </div>
                          {c.granted
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            : <XCircle className="w-4 h-4 text-red-300 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ações LGPD */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                  <h3 className="font-bold text-white mb-1">Ações sobre os dados</h3>
                  <p className="text-xs text-white/55 mb-4">Exercício dos direitos do titular (LGPD Art. 18)</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => exportMutation.mutate(selectedCustomerId)}
                      disabled={exportMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-400/12 text-[#93C5FD] ring-1 ring-blue-400/25 rounded-xl text-sm font-semibold hover:bg-blue-400/20 hover:text-white transition-colors disabled:opacity-50"
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
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-400/12 text-red-300 ring-1 ring-red-400/25 rounded-xl text-sm font-semibold hover:bg-red-400/20 transition-colors disabled:opacity-50"
                    >
                      <UserX className="w-4 h-4" />
                      {anonymizeMutation.isPending ? 'Anonimizando…' : 'Anonimizar cliente'}
                    </button>
                  </div>
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-200 bg-amber-400/10 border border-amber-400/25 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>A anonimização é <strong>irreversível</strong>. Remove nome, telefone, e-mail e CPF. Dados financeiros são mantidos para obrigação fiscal.</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB: COOKIES ── */}
        {activeTab === 'cookies' && (
          <CookiesTab onOpenModal={() => setShowCookieModal(true)} />
        )}

        {showCookieModal && (
          <CookiePreferencesModal
            onSave={() => setShowCookieModal(false)}
            onClose={() => setShowCookieModal(false)}
          />
        )}

        {/* ── TAB: DOCUMENTAÇÃO ── */}
        {activeTab === 'docs' && (
          <div className="space-y-3">
            {[
              { title: 'Visão Geral LGPD', path: 'docs/LGPD_OVERVIEW.md', desc: 'Papéis, bases legais, checklist de compliance e direitos dos titulares.' },
              { title: 'Mapeamento de Dados', path: 'docs/LGPD_DATA_MAPPING.md', desc: 'Todos os dados pessoais coletados, finalidade, base legal e retenção.' },
              { title: 'Política de Retenção', path: 'docs/DATA_RETENTION_POLICY.md', desc: 'Por quanto tempo cada dado é mantido e quando deve ser excluído.' },
              { title: 'Fluxo de Consentimentos', path: 'docs/CONSENT_FLOW.md', desc: 'Como os consentimentos são coletados, registrados e revogados.' },
            ].map(doc => (
              <div key={doc.path} className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-400/12 ring-1 ring-blue-400/25 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-[#93C5FD]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-white">{doc.title}</div>
                  <div className="text-xs text-white/55 mt-0.5">{doc.desc}</div>
                  <div className="text-[10px] text-white/30 mt-0.5 font-mono">{doc.path}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30 flex-shrink-0">✓ Criado</span>
              </div>
            ))}

            <div className="bg-blue-400/10 border border-blue-400/25 rounded-2xl p-4">
              <div className="font-semibold text-sm text-[#93C5FD] mb-1">Política de Privacidade Pública</div>
              <div className="text-xs text-blue-100 mb-3">
                A política de privacidade está disponível publicamente em <code className="bg-blue-400/20 text-white px-1 rounded">/politica-de-privacidade</code> e deve ser linkada no fluxo de agendamento.
              </div>
              <a href="/politica-de-privacidade" target="_blank"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#93C5FD] hover:text-white hover:underline">
                <FileText className="w-3.5 h-3.5" />
                Ver política de privacidade
              </a>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}