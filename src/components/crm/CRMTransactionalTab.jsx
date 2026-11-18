// Central única de parâmetros gerais de WhatsApp (janela de envio, link de avaliação)
// e modelos de mensagens transacionais (confirmação, lembretes, pós-atendimento e reativação).
// Salva em Company.whatsapp_settings — sem duplicação de prazos de Lifecycle.

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Save, Loader2, Settings as SettingsIcon, Zap, MessageSquare, Clock, Star, ChevronDown, ChevronUp } from 'lucide-react';
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

const MESSAGE_ITEMS = [
  {
    key: 'send_confirmation',
    msgKey: 'msg_confirmation',
    title: 'Confirmação ao agendar',
    desc: 'Enviada automaticamente assim que o cliente agenda um horário.',
    badge: 'Agenda',
  },
  {
    key: 'send_reminder_24h',
    msgKey: 'msg_reminder_24h',
    title: 'Lembrete 24h antes',
    desc: 'Disparo preventivo um dia antes do atendimento.',
    badge: 'Lembrete',
  },
  {
    key: 'send_reminder_2h',
    msgKey: 'msg_reminder_2h',
    title: 'Lembrete 2h antes',
    desc: 'Reforço no dia do corte para zerar faltas.',
    badge: 'Lembrete',
  },
  {
    key: 'send_post_appointment',
    msgKey: 'msg_post_appointment',
    title: 'Pós-atendimento e Avaliação (2h depois)',
    desc: 'Coleta feedback e envia o link de avaliação cadastrado acima.',
    badge: 'Avaliação',
  },
  {
    key: 'send_reactivation',
    msgKey: 'msg_reactivation',
    title: 'Reativação rápida com sugestão de horário (IA)',
    desc: 'Sugere encaixe automático para clientes que precisam retornar.',
    badge: 'IA Encaixe',
    hasAiHint: true,
  },
];

export default function CRMTransactionalTab({ company, hasLifecycleLink = true }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...(company?.whatsapp_settings || {}) }));
  const [expandedKey, setExpandedKey] = useState('send_confirmation');

  useEffect(() => {
    setSettings({ ...DEFAULTS, ...(company?.whatsapp_settings || {}) });
  }, [company?.id]);

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.Company.update(company.id, { whatsapp_settings: settings }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['my-company'] });
      toast({ title: 'Configurações e modelos de WhatsApp salvos' });
    },
  });

  const upd = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <div className="space-y-6">
      {/* 1. Parâmetros Gerais Centralizados (Local único para janela de envio e link de avaliação) */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-400/25 flex items-center justify-center">
              <SettingsIcon className="w-4 h-4 text-[#2563EB] dark:text-[#93C5FD]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Parâmetros Gerais de Envio</h3>
              <p className="text-xs text-slate-500 dark:text-white/55">
                Central único para ativação global do WhatsApp, janela de horário e link de avaliação.
              </p>
            </div>
          </div>
        </div>

        <Toggle
          label="Envio automático de WhatsApp ativo"
          hint="Controla todos os disparos automáticos (lembretes, pós-atendimento e campanhas)."
          checked={settings.enabled !== false}
          onChange={(v) => upd('enabled', v)}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <Txt
            label="Janela de envio — Início"
            icon={Clock}
            type="time"
            value={settings.send_window_start || '09:00'}
            onChange={(v) => upd('send_window_start', v)}
          />
          <Txt
            label="Janela de envio — Fim"
            icon={Clock}
            type="time"
            value={settings.send_window_end || '20:00'}
            onChange={(v) => upd('send_window_end', v)}
          />
          <Txt
            label="Link de avaliação (Google / externo)"
            icon={Star}
            value={settings.review_link || ''}
            onChange={(v) => upd('review_link', v)}
            placeholder="https://g.page/r/..."
          />
        </div>

        {hasLifecycleLink && (
          <p className="text-xs text-slate-500 dark:text-white/55 pt-1">
            Os prazos em dias para classificar clientes em risco, inativos ou perdidos ficam centralizados em{' '}
            <Link to="/app/crm?tab=lifecycle" className="font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline">
              CRM & Retenção → Lifecycle
            </Link>
            .
          </p>
        )}
      </div>

      {/* 2. Mensagens Transacionais de Agenda & Pós-atendimento (toggle + modelo juntos) */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-400/25 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Mensagens de Agenda & Pós-Atendimento</h3>
              <p className="text-xs text-slate-500 dark:text-white/55">
                Ative cada gatilho e personalize o texto correspondente. Variáveis:{' '}
                <code className="bg-slate-100 dark:bg-white/[0.06] text-[#2563EB] dark:text-[#93C5FD] px-1 rounded">{'{nome}'}</code>{' '}
                <code className="bg-slate-100 dark:bg-white/[0.06] text-[#2563EB] dark:text-[#93C5FD] px-1 rounded">{'{barbearia}'}</code>{' '}
                <code className="bg-slate-100 dark:bg-white/[0.06] text-[#2563EB] dark:text-[#93C5FD] px-1 rounded">{'{data}'}</code>{' '}
                <code className="bg-slate-100 dark:bg-white/[0.06] text-[#2563EB] dark:text-[#93C5FD] px-1 rounded">{'{hora}'}</code>{' '}
                <code className="bg-slate-100 dark:bg-white/[0.06] text-[#2563EB] dark:text-[#93C5FD] px-1 rounded">{'{link_avaliacao}'}</code>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {MESSAGE_ITEMS.map((item) => {
            const isChecked = settings[item.key] !== false;
            const isExpanded = expandedKey === item.key;
            return (
              <div
                key={item.key}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isChecked
                    ? 'border-slate-200 dark:border-white/12 bg-slate-50/60 dark:bg-white/[0.03]'
                    : 'border-slate-200/70 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.015]'
                }`}
              >
                <div
                  onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                  className="flex items-center justify-between gap-3 p-3.5 sm:p-4 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-400/15 text-[#2563EB] dark:text-[#93C5FD] border border-blue-200 dark:border-blue-400/25">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-white/55 mt-0.5">{item.desc}</p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => upd(item.key, !isChecked)}
                      aria-label={`Alternar ${item.title}`}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] shadow-[0_4px_12px_rgba(37,99,235,0.35)]'
                          : 'bg-slate-300 dark:bg-white/15'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isChecked ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 dark:text-white/40 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-white/40 flex-shrink-0" />
                  )}
                </div>

                {isExpanded && (
                  <div className="p-3.5 sm:p-4 pt-2 border-t border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.015] space-y-2.5">
                    <Area
                      label={`Modelo — ${item.title}`}
                      value={settings[item.msgKey] || ''}
                      onChange={(v) => upd(item.msgKey, v)}
                    />
                    {item.hasAiHint && (
                      <div className="bg-amber-50 dark:bg-amber-400/[0.08] border border-amber-200 dark:border-amber-400/30 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-100 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                          <Zap className="w-3 h-3" /> IA de horário ideal
                        </div>
                        <p>
                          Use <code className="bg-amber-100 dark:bg-white/[0.08] text-amber-900 dark:text-amber-200 px-1 rounded">{'{horario_sugerido}'}</code> e{' '}
                          <code className="bg-amber-100 dark:bg-white/[0.08] text-amber-900 dark:text-amber-200 px-1 rounded">{'{profissional_sugerido}'}</code> para inserir o melhor encaixe.
                        </p>
                        <p>
                          Texto entre <code className="bg-amber-100 dark:bg-white/[0.08] text-amber-900 dark:text-amber-200 px-1 rounded">[[ ]]</code> só aparece quando a IA encontra um horário.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 text-white text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-60 shadow-sm ring-1 ring-white/15 transition-all cursor-pointer"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar parâmetros e modelos
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white/90">{label}</div>
        {hint && <div className="text-xs text-slate-500 dark:text-white/55 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
          checked
            ? 'bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] shadow-[0_4px_12px_rgba(37,99,235,0.35)]'
            : 'bg-slate-300 dark:bg-white/15'
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function Txt({ label, value, onChange, placeholder, type = 'text', icon: Icon }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-white/65 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-white/45" />}
        <span>{label}</span>
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 dark:[color-scheme:dark] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
      />
    </div>
  );
}

function Area({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-white/65 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 resize-y focus:outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20"
      />
    </div>
  );
}