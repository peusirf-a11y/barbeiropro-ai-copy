import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/layout/AppLayout';
import { useCompany } from '@/hooks/useCompany';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import { shouldScopeCustomersByUnit } from '@/lib/customerUnitMode';
import { MessageSquare, CheckCircle, Send, AlertCircle, Zap, Save, Loader2, Settings as SettingsIcon } from 'lucide-react';

const TYPE_LABELS = {
  confirmacao: 'Confirmação',
  lembrete_24h: 'Lembrete 24h',
  lembrete_2h: 'Lembrete 2h',
  pos_atendimento: 'Pós-atendimento',
  reativacao: 'Reativação (IA)',
};

const STATUS_BADGE = {
  enviado: 'bg-green-50 text-green-700',
  simulado: 'bg-blue-50 text-blue-700',
  erro: 'bg-red-50 text-red-700',
};

export default function AppRetencao() {
  const { company, isLoading: loadingCompany } = useCompany();
  const { activeUnitId } = useActiveUnit();
  const scopeByUnit = shouldScopeCustomersByUnit(company, activeUnitId);
  const qc = useQueryClient();
  const [tab, setTab] = useState('dashboard');
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (company?.whatsapp_settings) setSettings(company.whatsapp_settings);
    else if (company) setSettings({
      enabled: true,
      send_confirmation: true,
      send_reminder_24h: true,
      send_reminder_2h: true,
      send_post_appointment: true,
      send_reactivation: true,
      reactivation_days: 30,
      send_window_start: '09:00',
      send_window_end: '20:00',
      review_link: '',
      msg_confirmation: 'Olá, {nome}! Seu horário na {barbearia} foi confirmado para {data} às {hora}. Te esperamos! 💈',
      msg_reminder_24h: 'Fala, {nome}! Passando pra lembrar do seu horário amanhã às {hora} na {barbearia}. 💈',
      msg_reminder_2h: 'Opa {nome}! Seu horário na {barbearia} é daqui 2h, às {hora}. Tô te esperando! 💈',
      msg_post_appointment: 'Valeu por colar na {barbearia}, {nome}! 🔥 Se puder, deixa sua avaliação: {link_avaliacao}',
      msg_reactivation: 'Fala, {nome}! Sumiu hein 👀 Já tá na hora de dar aquele trato![[ Tenho um horário {horario_sugerido}, encaixa pra você?]]',
    });
  }, [company]);

  const { data: messagesRaw = [] } = useQuery({
    queryKey: ['whatsapp-messages', company?.id],
    queryFn: () => base44.entities.WhatsAppMessage.filter({ company_id: company.id }, '-sent_at', 500),
    enabled: !!company?.id,
  });

  const { data: customersRaw = [] } = useQuery({
    queryKey: ['customers-retencao', company?.id],
    queryFn: () => base44.entities.Customer.filter({ company_id: company.id }, '-last_appointment_at', 1000),
    enabled: !!company?.id,
  });

  // Em modo "clientes por unidade", filtra logs e clientes pela unidade ativa
  const messages = scopeByUnit
    ? messagesRaw.filter(m => !m.unit_id || m.unit_id === activeUnitId)
    : messagesRaw;
  const customers = scopeByUnit
    ? customersRaw.filter(c => !c.unit_id || c.unit_id === activeUnitId)
    : customersRaw;

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.Company.update(company.id, { whatsapp_settings: settings }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company'] }),
  });

  if (loadingCompany) {
    return <AppLayout><div className="p-8 flex items-center justify-center min-h-[400px]"><Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" /></div></AppLayout>;
  }

  if (!company) {
    return (
      <AppLayout>
        <div className="p-8 max-w-xl mx-auto text-center">
          <div className="bg-white rounded-2xl border border-black/8 p-8">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-[#1B1C1E] mb-2">Nenhuma empresa configurada</h2>
            <p className="text-sm text-gray-500">Complete o onboarding para acessar o sistema de retenção.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!settings) {
    return <AppLayout><div className="p-8 flex items-center justify-center min-h-[400px]"><Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" /></div></AppLayout>;
  }

  // Métricas
  const total = messages.length;
  const sent = messages.filter(m => m.status === 'enviado').length;
  const simulated = messages.filter(m => m.status === 'simulado').length;
  const errors = messages.filter(m => m.status === 'erro').length;

  const reactivationMsgs = messages.filter(m => m.type === 'reativacao' && m.status !== 'erro');
  const recoveredCustomerIds = new Set();
  reactivationMsgs.forEach(rm => {
    const c = customers.find(c => c.id === rm.customer_id);
    if (c?.last_appointment_at && rm.sent_at && new Date(c.last_appointment_at) > new Date(rm.sent_at)) {
      recoveredCustomerIds.add(c.id);
    }
  });
  const recoveredCount = recoveredCustomerIds.size;
  const recoveryRate = reactivationMsgs.length > 0 ? Math.round((recoveredCount / new Set(reactivationMsgs.map(m => m.customer_id)).size) * 100) : 0;

  const byType = Object.keys(TYPE_LABELS).map(t => ({
    type: t, label: TYPE_LABELS[t],
    count: messages.filter(m => m.type === t).length,
  }));

  const updateField = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] ring-1 ring-[#DBEAFE] flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 bg-[#2563EB]/10 text-[#2563EB] text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1">
                <Zap className="w-2.5 h-2.5" /> Retenção via WhatsApp
              </div>
              <h1 className="text-2xl lg:text-[26px] font-black text-[#111827] tracking-tight leading-tight">Retenção Automática</h1>
              <p className="text-[#6B7280] text-sm mt-0.5">Confirmações, lembretes e reativação de clientes inativos</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-black/5 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'logs', label: 'Mensagens' },
            { id: 'config', label: 'Configurações' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <MetricCard icon={Send} label="Mensagens enviadas" value={sent + simulated} sub={simulated > 0 ? `${simulated} em modo teste` : null} color="text-[#2563EB]" />
              <MetricCard icon={CheckCircle} label="Clientes recuperados" value={recoveredCount} sub={`${recoveryRate}% taxa de retorno`} color="text-green-600" />
              <MetricCard icon={MessageSquare} label="Total de envios" value={total} color="text-gray-700" />
              <MetricCard icon={AlertCircle} label="Falhas" value={errors} color="text-red-500" />
            </div>

            <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-[var(--shadow-sm)]">
              <h3 className="font-bold text-[#111827] mb-4">Mensagens por tipo</h3>
              <div className="space-y-3">
                {byType.map(b => (
                  <div key={b.type} className="flex items-center gap-3">
                    <div className="w-32 sm:w-44 text-sm text-gray-600 flex-shrink-0">{b.label}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-[#2563EB] h-full" style={{ width: total ? `${(b.count / total) * 100}%` : '0%' }} />
                    </div>
                    <div className="w-10 text-right text-sm font-semibold text-[#1B1C1E]">{b.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {simulated > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
                <strong>💡 Modo teste ativo.</strong> As mensagens estão sendo registradas mas não enviadas. Configure as credenciais Z-API (ou outro provedor) nas variáveis de ambiente para ativar envios reais.
              </div>
            )}
          </div>
        )}

        {tab === 'logs' && (
          <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#FAFBFC] border-b border-black/5">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Mensagem</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Nenhuma mensagem enviada ainda</td></tr>
                  )}
                  {messages.slice(0, 200).map(m => (
                    <tr key={m.id} className="border-b border-black/5 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1B1C1E]">{m.customer_name || '–'}</div>
                        <div className="text-xs text-gray-400">{m.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{TYPE_LABELS[m.type] || m.type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[m.status] || 'bg-gray-100 text-gray-600'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell max-w-md truncate">{m.message_text}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {m.sent_at ? new Date(m.sent_at).toLocaleString('pt-BR') : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'config' && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-white rounded-2xl border border-black/5 p-5 space-y-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-2 mb-2">
                <SettingsIcon className="w-4 h-4 text-[#2563EB]" />
                <h3 className="font-bold text-[#111827]">Geral</h3>
              </div>
              <ToggleRow label="Sistema de retenção ativo" checked={settings.enabled !== false} onChange={v => updateField('enabled', v)} />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Reativar após (dias)" value={settings.reactivation_days || 30} onChange={v => updateField('reactivation_days', Number(v))} min={7} max={180} />
                <TextField label="Link de avaliação" value={settings.review_link || ''} onChange={v => updateField('review_link', v)} placeholder="https://g.page/r/..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Janela início" type="time" value={settings.send_window_start || '09:00'} onChange={v => updateField('send_window_start', v)} />
                <TextField label="Janela fim" type="time" value={settings.send_window_end || '20:00'} onChange={v => updateField('send_window_end', v)} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-black/5 p-5 space-y-4 shadow-[var(--shadow-sm)]">
              <h3 className="font-bold text-[#111827]">Tipos de mensagem</h3>
              <ToggleRow label="Confirmação ao agendar" checked={settings.send_confirmation !== false} onChange={v => updateField('send_confirmation', v)} />
              <ToggleRow label="Lembrete 24h antes" checked={settings.send_reminder_24h !== false} onChange={v => updateField('send_reminder_24h', v)} />
              <ToggleRow label="Lembrete 2h antes" checked={settings.send_reminder_2h !== false} onChange={v => updateField('send_reminder_2h', v)} />
              <ToggleRow label="Pós-atendimento (2h depois)" checked={settings.send_post_appointment !== false} onChange={v => updateField('send_post_appointment', v)} />
              <ToggleRow label="Reativação automática (IA)" checked={settings.send_reactivation !== false} onChange={v => updateField('send_reactivation', v)} />
            </div>

            <div className="bg-white rounded-2xl border border-black/5 p-5 space-y-4 shadow-[var(--shadow-sm)]">
              <h3 className="font-bold text-[#111827]">Modelos de mensagem</h3>
              <p className="text-xs text-gray-500">Variáveis disponíveis: <code className="bg-gray-100 px-1 rounded">{'{nome}'}</code> <code className="bg-gray-100 px-1 rounded">{'{barbearia}'}</code> <code className="bg-gray-100 px-1 rounded">{'{data}'}</code> <code className="bg-gray-100 px-1 rounded">{'{hora}'}</code> <code className="bg-gray-100 px-1 rounded">{'{link_avaliacao}'}</code></p>
              <TextArea label="Confirmação" value={settings.msg_confirmation || ''} onChange={v => updateField('msg_confirmation', v)} />
              <TextArea label="Lembrete 24h" value={settings.msg_reminder_24h || ''} onChange={v => updateField('msg_reminder_24h', v)} />
              <TextArea label="Lembrete 2h" value={settings.msg_reminder_2h || ''} onChange={v => updateField('msg_reminder_2h', v)} />
              <TextArea label="Pós-atendimento" value={settings.msg_post_appointment || ''} onChange={v => updateField('msg_post_appointment', v)} />
              <div>
                <TextArea label="Reativação" value={settings.msg_reactivation || ''} onChange={v => updateField('msg_reactivation', v)} />
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5"><Zap className="w-3 h-3" /> IA de horário ideal</div>
                  <p>Use <code className="bg-white px-1 rounded">{'{horario_sugerido}'}</code> e <code className="bg-white px-1 rounded">{'{profissional_sugerido}'}</code> para inserir o melhor encaixe da agenda do cliente.</p>
                  <p>Texto entre <code className="bg-white px-1 rounded">[[ ]]</code> só aparece quando a IA encontra um horário. Ex: <em>"Tenho [[{'{horario_sugerido}'} com {'{profissional_sugerido}'}]] disponível."</em></p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 disabled:opacity-60 shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] active:scale-[0.98]"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar configurações
              </button>
            </div>
            {saveMutation.isSuccess && <p className="text-green-600 text-sm text-right">✓ Configurações salvas</p>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = 'text-gray-700' }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4 sm:p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[11px] text-[#6B7280] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">{value}</div>
      {sub && <div className="text-xs text-[#6B7280] mt-1">{sub}</div>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#2563EB]' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

function TextField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-black/10 rounded-lg"
      />
    </div>
  );
}

function NumberField({ label, value, onChange, min, max }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-black/10 rounded-lg"
      />
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 text-sm border border-black/10 rounded-lg resize-y"
      />
    </div>
  );
}