// Aba "Campanhas" → mensagens TRANSACIONAIS (confirmação, lembretes, pós-atendimento, reativação IA).
// Refatorado da antiga aba "Configurações" da página Retenção.
// Salva em Company.whatsapp_settings.

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Save, Loader2, Settings as SettingsIcon, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const DEFAULTS = {
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
};

export default function CRMTransactionalTab({ company }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...(company?.whatsapp_settings || {}) }));

  useEffect(() => {
    setSettings({ ...DEFAULTS, ...(company?.whatsapp_settings || {}) });
  }, [company?.id]);

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.Company.update(company.id, { whatsapp_settings: settings }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Mensagens transacionais salvas' });
    },
  });

  const upd = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="w-4 h-4 text-[#93C5FD]" />
          <h3 className="font-bold text-white">Geral</h3>
        </div>
        <Toggle label="Sistema de retenção ativo" checked={settings.enabled !== false} onChange={v => upd('enabled', v)} />
        <div className="grid grid-cols-2 gap-3">
          <Num label="Reativar após (dias)" value={settings.reactivation_days || 30} onChange={v => upd('reactivation_days', Number(v))} min={7} max={180} />
          <Txt label="Link de avaliação" value={settings.review_link || ''} onChange={v => upd('review_link', v)} placeholder="https://g.page/r/..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Txt label="Janela início" type="time" value={settings.send_window_start || '09:00'} onChange={v => upd('send_window_start', v)} />
          <Txt label="Janela fim" type="time" value={settings.send_window_end || '20:00'} onChange={v => upd('send_window_end', v)} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 space-y-4">
        <h3 className="font-bold text-white">Tipos de mensagem</h3>
        <Toggle label="Confirmação ao agendar" checked={settings.send_confirmation !== false} onChange={v => upd('send_confirmation', v)} />
        <Toggle label="Lembrete 24h antes" checked={settings.send_reminder_24h !== false} onChange={v => upd('send_reminder_24h', v)} />
        <Toggle label="Lembrete 2h antes" checked={settings.send_reminder_2h !== false} onChange={v => upd('send_reminder_2h', v)} />
        <Toggle label="Pós-atendimento (2h depois)" checked={settings.send_post_appointment !== false} onChange={v => upd('send_post_appointment', v)} />
        <Toggle label="Reativação automática (IA)" checked={settings.send_reactivation !== false} onChange={v => upd('send_reactivation', v)} />
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 space-y-4">
        <h3 className="font-bold text-white">Modelos de mensagem</h3>
        <p className="text-xs text-white/55">
          Variáveis: <code className="bg-white/[0.06] text-[#93C5FD] px-1 rounded">{'{nome}'}</code>{' '}
          <code className="bg-white/[0.06] text-[#93C5FD] px-1 rounded">{'{barbearia}'}</code>{' '}
          <code className="bg-white/[0.06] text-[#93C5FD] px-1 rounded">{'{data}'}</code>{' '}
          <code className="bg-white/[0.06] text-[#93C5FD] px-1 rounded">{'{hora}'}</code>{' '}
          <code className="bg-white/[0.06] text-[#93C5FD] px-1 rounded">{'{link_avaliacao}'}</code>
        </p>
        <Area label="Confirmação" value={settings.msg_confirmation || ''} onChange={v => upd('msg_confirmation', v)} />
        <Area label="Lembrete 24h" value={settings.msg_reminder_24h || ''} onChange={v => upd('msg_reminder_24h', v)} />
        <Area label="Lembrete 2h" value={settings.msg_reminder_2h || ''} onChange={v => upd('msg_reminder_2h', v)} />
        <Area label="Pós-atendimento" value={settings.msg_post_appointment || ''} onChange={v => upd('msg_post_appointment', v)} />
        <div>
          <Area label="Reativação" value={settings.msg_reactivation || ''} onChange={v => upd('msg_reactivation', v)} />
          <div className="mt-2 bg-amber-400/[0.08] border border-amber-400/30 rounded-lg p-3 text-xs text-amber-100 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-200"><Zap className="w-3 h-3" /> IA de horário ideal</div>
            <p>Use <code className="bg-white/[0.08] text-amber-200 px-1 rounded">{'{horario_sugerido}'}</code> e <code className="bg-white/[0.08] text-amber-200 px-1 rounded">{'{profissional_sugerido}'}</code> para inserir o melhor encaixe.</p>
            <p>Texto entre <code className="bg-white/[0.08] text-amber-200 px-1 rounded">[[ ]]</code> só aparece quando a IA encontra um horário.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 text-white text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-60 shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15 transition-all"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar mensagens
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-white/80">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] shadow-[0_4px_12px_rgba(37,99,235,0.4)]' : 'bg-white/10'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

function Txt({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/10 rounded-lg text-white placeholder:text-white/30 [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
    </div>
  );
}

function Num({ label, value, onChange, min, max }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      <input type="number" min={min} max={max} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
    </div>
  );
}

function Area({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/60 mb-1">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
        className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/10 rounded-lg text-white placeholder:text-white/30 resize-y focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
    </div>
  );
}