// Políticas de retenção de dados — configuração visual das janelas de expiração.
// Puramente visual/documentacional (configurações reais ficam no backend).

import { useState } from 'react';
import { Database, CheckCircle2, Clock } from 'lucide-react';

const DEFAULT_POLICIES = [
  { id: 'audit_logs',      label: 'Logs de auditoria',      icon: '📋', value: '365', unit: 'days',  note: 'Obrigatório por LGPD — mínimo 5 anos recomendado.' },
  { id: 'privacy_logs',    label: 'Logs de privacidade',    icon: '🔒', value: '365', unit: 'days',  note: 'Registros de consentimento e anonimização.' },
  { id: 'sessions',        label: 'Sessões de autenticação',icon: '🔑', value: '30',  unit: 'days',  note: 'auth_token + TotpSession.' },
  { id: 'cookie_consents', label: 'Consentimentos de cookie',icon:'🍪', value: '180', unit: 'days',  note: 'Revalidação automática a cada 6 meses (LGPD).' },
  { id: 'reset_tokens',    label: 'Tokens de reset de senha',icon:'🔄', value: '1',   unit: 'hours', note: 'Expiração curta por segurança.' },
  { id: 'appointments',    label: 'Agendamentos cancelados', icon: '📅', value: '90',  unit: 'days',  note: 'Registros de cancelamento e faltas.' },
  { id: 'whatsapp_msgs',   label: 'Logs WhatsApp',           icon: '💬', value: '60',  unit: 'days',  note: 'Histórico de mensagens disparadas.' },
  { id: 'analytics',       label: 'Dados de analytics',      icon: '📊', value: '90',  unit: 'days',  note: 'Eventos de tracking consentido.' },
];

const PRESETS = [
  { label: '30 dias',   value: '30',   unit: 'days' },
  { label: '90 dias',   value: '90',   unit: 'days' },
  { label: '6 meses',   value: '180',  unit: 'days' },
  { label: '1 ano',     value: '365',  unit: 'days' },
  { label: '5 anos',    value: '1825', unit: 'days' },
];

export default function ComplianceRetention() {
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);
  const [saved, setSaved] = useState(false);

  const update = (id, field, val) => {
    setPolicies(p => p.map(po => po.id === id ? { ...po, [field]: val } : po));
    setSaved(false);
  };

  const handleSave = () => {
    // Em produção: persistir em entidade de configurações do master
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
        <Database className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Políticas de retenção definem por quanto tempo cada categoria de dado permanece ativa na plataforma.
          Dados além do prazo devem ser excluídos ou anonimizados automaticamente pelo job de retenção.
          <strong> Configurações salvas aqui são documentacionais</strong> — os jobs de cleanup devem referenciar esses valores.
        </span>
      </div>

      <div className="space-y-3">
        {policies.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xl">{p.icon}</span>
              <div className="flex-1 min-w-[180px]">
                <div className="text-sm font-bold text-[#111827]">{p.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{p.note}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {/* Presets */}
                <div className="flex gap-1 flex-wrap">
                  {PRESETS.filter(pr => pr.unit === p.unit || p.unit === 'hours').slice(0, p.unit === 'hours' ? 1 : 5).map(pr => (
                    <button key={pr.label} onClick={() => update(p.id, 'value', pr.value)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${p.value === pr.value && p.unit === pr.unit ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                      {pr.label}
                    </button>
                  ))}
                </div>
                {/* Custom input */}
                <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-black/8">
                  <input type="number" min="1" value={p.value} onChange={e => update(p.id, 'value', e.target.value)}
                    className="w-14 text-sm font-bold text-[#111827] bg-transparent focus:outline-none text-right" />
                  <select value={p.unit} onChange={e => update(p.id, 'unit', e.target.value)}
                    className="text-xs text-gray-500 bg-transparent focus:outline-none">
                    <option value="hours">horas</option>
                    <option value="days">dias</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400">
          <Clock className="w-3 h-3 inline mr-1" />
          Alterações documentacionais — atualize os jobs de cleanup para refletir essas políticas.
        </p>
        <button onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8]'}`}>
          {saved ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</> : 'Salvar políticas'}
        </button>
      </div>
    </div>
  );
}