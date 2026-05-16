// Central de Privacidade & LGPD — Configurações → Privacidade
// Permite ao admin: ver logs de privacidade, exportar dados de clientes,
// anonimizar, e ver checklist de compliance.

import AppLayout from '@/components/layout/AppLayout';
import AppPageHeader from '@/components/app/AppPageHeader';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useState } from 'react';
import { Shield, Download, UserX, CheckCircle, Clock, Search, AlertTriangle, FileText, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { useCompany } from '@/hooks/useCompany';

const COMPLIANCE_ITEMS = [
  { label: 'Mapeamento de dados documentado', done: true, file: 'docs/LGPD_DATA_MAPPING.md' },
  { label: 'Base legal definida para cada dado', done: true, file: 'docs/LGPD_OVERVIEW.md' },
  { label: 'Consentimentos separados por finalidade', done: true, file: 'docs/CONSENT_FLOW.md' },
  { label: 'Mecanismo de revogação de consentimento', done: true },
  { label: 'Exportação de dados (portabilidade)', done: true },
  { label: 'Anonimização de dados', done: true },
  { label: 'Política de retenção definida', done: true, file: 'docs/DATA_RETENTION_POLICY.md' },
  { label: 'Auditoria de ações de privacidade', done: true },
  { label: 'Isolamento multi-tenant por company_id', done: true },
  { label: 'Impersonação master auditada', done: true },
  { label: 'Guard de consentimento em campanhas de marketing', done: true },
  { label: 'Tokens com expiração automática', done: true },
];

export default function AppPrivacidade() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { company } = useCompany();
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [activeTab, setActiveTab] = useState('checklist');

  const { data: privacyLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['privacy-audit-logs', company?.id],
    queryFn: () => base44.entities.PrivacyAuditLog.filter(
      { company_id: company.id }, '-created_date', 50
    ),
    enabled: !!company?.id && activeTab === 'logs',
  });

  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers-search', company?.id, searchCustomer],
    queryFn: () => base44.entities.Customer.filter({ company_id: company.id }, '-created_date', 20),
    enabled: !!company?.id && activeTab === 'tools',
  });

  const filteredCustomers = searchCustomer
    ? customers.filter(c =>
        c.name?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
        c.phone?.includes(searchCustomer)
      )
    : customers.slice(0, 10);

  const exportMutation = useMutation({
    mutationFn: (customerId) => base44.functions.invoke('exportCustomerData', {
      company_id: company.id,
      customer_id: customerId,
    }),
    onSuccess: (res) => {
      const data = res?.data?.data;
      if (!data) { toast({ title: 'Erro ao exportar', variant: 'destructive' }); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados_${data.personal_data?.name?.replace(/\s+/g, '_') || 'cliente'}_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportação concluída', description: 'Arquivo JSON baixado com sucesso.' });
    },
    onError: (err) => toast({ title: 'Erro na exportação', description: err?.response?.data?.error || err.message, variant: 'destructive' }),
  });

  const anonymizeMutation = useMutation({
    mutationFn: ({ customerId, reason }) => base44.functions.invoke('anonymizeCustomer', {
      company_id: company.id,
      customer_id: customerId,
      reason,
    }),
    onSuccess: () => {
      toast({ title: 'Cliente anonimizado com sucesso', description: 'Os dados pessoais foram removidos. Esta operação é irreversível.' });
      setSelectedCustomerId(null);
    },
    onError: (err) => toast({ title: 'Erro na anonimização', description: err?.response?.data?.error || err.message, variant: 'destructive' }),
  });

  const handleAnonymize = (customer) => {
    if (!confirm(`⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL.\n\nVocê está prestes a anonimizar:\n${customer.name}\n${customer.phone}\n\nOs dados pessoais serão substituídos por um identificador anônimo.\nDados financeiros são mantidos conforme obrigação legal.\n\nDeseja continuar?`)) return;
    const reason = prompt('Motivo da anonimização (para o log de auditoria):') || 'solicitação do titular';
    anonymizeMutation.mutate({ customerId: customer.id, reason });
  };

  const actionLabels = {
    DATA_EXPORT_REQUESTED: { label: 'Exportação solicitada', color: 'text-blue-700 bg-blue-50', icon: Download },
    DATA_EXPORT_DOWNLOADED: { label: 'Dados baixados', color: 'text-blue-700 bg-blue-50', icon: Download },
    DATA_ANONYMIZED: { label: 'Dados anonimizados', color: 'text-orange-700 bg-orange-50', icon: UserX },
    CONSENT_GRANTED: { label: 'Consentimento concedido', color: 'text-emerald-700 bg-emerald-50', icon: CheckCircle },
    CONSENT_REVOKED: { label: 'Consentimento revogado', color: 'text-red-700 bg-red-50', icon: AlertTriangle },
    SENSITIVE_DATA_VIEWED: { label: 'Dados sensíveis acessados', color: 'text-amber-700 bg-amber-50', icon: Eye },
    CUSTOMER_DATA_ACCESSED: { label: 'Dados acessados', color: 'text-gray-700 bg-gray-50', icon: Eye },
    IMPERSONATION_STARTED: { label: 'Impersonação iniciada', color: 'text-red-700 bg-red-100', icon: AlertTriangle },
  };

  const tabs = [
    { key: 'checklist', label: 'Checklist' },
    { key: 'tools', label: 'Ferramentas' },
    { key: 'logs', label: 'Auditoria LGPD' },
  ];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
        <AppPageHeader
          title="Privacidade & LGPD"
          subtitle="Central de compliance, ferramentas de privacidade e auditoria"
          icon={Shield}
        />

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${activeTab === t.key ? 'bg-white text-[#111827] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── CHECKLIST ── */}
        {activeTab === 'checklist' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <div className="font-bold text-emerald-900 text-sm">
                  {COMPLIANCE_ITEMS.filter(i => i.done).length}/{COMPLIANCE_ITEMS.length} itens implementados
                </div>
                <div className="text-xs text-emerald-700">Sistema preparado para auditoria e escalabilidade</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-black/5 divide-y divide-black/5">
              {COMPLIANCE_ITEMS.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                    {item.done
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      : <Clock className="w-3.5 h-3.5 text-gray-400" />
                    }
                  </div>
                  <span className={`text-sm ${item.done ? 'text-[#111827]' : 'text-gray-500'}`}>{item.label}</span>
                  {item.file && (
                    <span className="ml-auto text-[10px] font-mono text-gray-400">{item.file}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
              <div className="font-bold mb-1">Documentação disponível</div>
              <ul className="space-y-0.5 text-xs font-mono text-blue-700">
                <li>docs/LGPD_OVERVIEW.md</li>
                <li>docs/LGPD_DATA_MAPPING.md</li>
                <li>docs/DATA_RETENTION_POLICY.md</li>
                <li>docs/CONSENT_FLOW.md</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── TOOLS ── */}
        {activeTab === 'tools' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertTriangle className="w-4 h-4" />
                Atenção — Operações sensíveis
              </div>
              <p className="text-xs">A anonimização é <strong>irreversível</strong>. Use apenas quando solicitado pelo titular ou por obrigação legal. Todas as ações são auditadas.</p>
            </div>

            {/* Busca de clientes */}
            <div className="bg-white rounded-2xl border border-black/5 p-5">
              <h2 className="font-bold text-[#111827] mb-4 flex items-center gap-2">
                <Search className="w-4 h-4" /> Selecionar cliente
              </h2>
              <input
                type="text"
                placeholder="Buscar por nome ou telefone..."
                value={searchCustomer}
                onChange={e => setSearchCustomer(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredCustomers.map(c => {
                  const isAnon = c.name?.startsWith('Cliente #anon_');
                  return (
                    <div key={c.id}
                      onClick={() => !isAnon && setSelectedCustomerId(selectedCustomerId === c.id ? null : c.id)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                        isAnon ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed' :
                        selectedCustomerId === c.id ? 'bg-blue-50 border-[#2563EB]' : 'border-transparent hover:bg-gray-50'
                      }`}>
                      <div>
                        <div className="text-sm font-semibold text-[#111827]">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.phone}</div>
                      </div>
                      {isAnon && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">ANONIMIZADO</span>}
                      {selectedCustomerId === c.id && !isAnon && (
                        <span className="text-[10px] font-bold text-[#2563EB] bg-blue-100 px-2 py-0.5 rounded-full">SELECIONADO</span>
                      )}
                    </div>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <div className="text-center text-sm text-gray-400 py-4">Nenhum cliente encontrado</div>
                )}
              </div>
            </div>

            {/* Ações para cliente selecionado */}
            {selectedCustomerId && (() => {
              const c = customers.find(x => x.id === selectedCustomerId);
              if (!c) return null;
              return (
                <div className="bg-white rounded-2xl border border-[#2563EB]/20 p-5 space-y-3">
                  <h3 className="font-bold text-[#111827] text-sm">Ações para: {c.name}</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => exportMutation.mutate(c.id)}
                      disabled={exportMutation.isPending}
                      className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:border-[#2563EB] transition-colors text-left disabled:opacity-50"
                    >
                      <Download className="w-5 h-5 text-[#2563EB] flex-shrink-0" />
                      <div>
                        <div className="font-bold text-sm text-[#111827]">Exportar dados</div>
                        <div className="text-xs text-gray-500">JSON com todos os dados pessoais</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleAnonymize(c)}
                      disabled={anonymizeMutation.isPending}
                      className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl hover:border-red-500 transition-colors text-left disabled:opacity-50"
                    >
                      <UserX className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-sm text-[#111827]">Anonimizar cliente</div>
                        <div className="text-xs text-gray-500">Remove dados identificáveis — irreversível</div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── LOGS ── */}
        {activeTab === 'logs' && (
          <div>
            {loadingLogs ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
              </div>
            ) : privacyLogs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
                <Shield className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <div className="text-sm text-gray-500">Nenhuma ação de privacidade registrada ainda.</div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-black/5 divide-y divide-black/5">
                {privacyLogs.map(log => {
                  const cfg = actionLabels[log.action] || { label: log.action, color: 'text-gray-700 bg-gray-50', icon: FileText };
                  const Icon = cfg.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-5 py-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-[#111827]">{cfg.label}</span>
                          {log.severity === 'warning' && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">ALERTA</span>
                          )}
                          {log.severity === 'critical' && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">CRÍTICO</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {log.actor_email && <span>{log.actor_email} · </span>}
                          <span>{log.actor_type}</span>
                          {log.customer_id && <span> · cliente #{log.customer_id.slice(-6)}</span>}
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="text-[11px] font-mono text-gray-400 mt-1 truncate">
                            {JSON.stringify(log.details).slice(0, 80)}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 flex-shrink-0">
                        {log.created_date
                          ? format(new Date(log.created_date), "dd/MM/yy HH:mm", { locale: ptBR })
                          : '—'
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}