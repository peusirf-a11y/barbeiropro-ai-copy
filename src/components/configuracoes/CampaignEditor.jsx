// Editor de UMA campanha de disparo automático (boas-vindas, recuperação, reativação, VIP, fidelização).

import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Eye } from 'lucide-react';
import { CAMPAIGN_LABELS, CAMPAIGN_DEFAULTS, renderTemplate } from '@/lib/lifecycleCampaigns';

const VARS = [
  { key: '{nome}', label: 'Nome do cliente' },
  { key: '{barbearia}', label: 'Nome da barbearia' },
  { key: '{link_agendamento}', label: 'Link de agendamento' },
];

const COLOR_CLASSES = {
  sky:     { bg: 'bg-sky-50 dark:bg-sky-400/[0.12]',       border: 'border-sky-200 dark:border-sky-400/30',       text: 'text-sky-700 dark:text-sky-200',       dot: 'bg-sky-500 dark:bg-sky-400' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-400/[0.12]',   border: 'border-amber-200 dark:border-amber-400/30',   text: 'text-amber-800 dark:text-amber-200',   dot: 'bg-amber-500 dark:bg-amber-400' },
  orange:  { bg: 'bg-orange-50 dark:bg-orange-400/[0.12]', border: 'border-orange-200 dark:border-orange-400/30', text: 'text-orange-800 dark:text-orange-200', dot: 'bg-orange-500 dark:bg-orange-400' },
  red:     { bg: 'bg-rose-50 dark:bg-rose-400/[0.12]',     border: 'border-rose-200 dark:border-rose-400/30',     text: 'text-rose-800 dark:text-rose-200',     dot: 'bg-rose-500 dark:bg-rose-400' },
  purple:  { bg: 'bg-violet-50 dark:bg-violet-400/[0.12]', border: 'border-violet-200 dark:border-violet-400/30', text: 'text-violet-800 dark:text-violet-200', dot: 'bg-violet-500 dark:bg-violet-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-400/[0.12]', border: 'border-emerald-200 dark:border-emerald-400/30', text: 'text-emerald-800 dark:text-emerald-200', dot: 'bg-emerald-500 dark:bg-emerald-400' },
};

export default function CampaignEditor({ campaignKey, value, onChange, companyName = 'Sua Barbearia' }) {
  const meta = CAMPAIGN_LABELS[campaignKey];
  const colors = COLOR_CLASSES[meta?.color] || COLOR_CLASSES.sky;
  const [expanded, setExpanded] = useState(false);

  const cfg = { ...CAMPAIGN_DEFAULTS[campaignKey], ...(value || {}) };
  const isWelcome = campaignKey === 'primeira_visita';
  const isVip = campaignKey === 'vip_inativo';

  const update = (patch) => onChange({ ...cfg, ...patch });

  const insertVar = (varKey) => {
    update({ message: (cfg.message || '') + ' ' + varKey });
  };

  const previewText = renderTemplate(cfg.message, {
    nome: 'João',
    barbearia: companyName,
    link_agendamento: 'https://app.com/agendar/sua-barbearia',
  });

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        cfg.enabled
          ? 'bg-slate-50/70 dark:bg-white/[0.04] border-slate-200 dark:border-white/12'
          : 'bg-slate-50/30 dark:bg-white/[0.015] border-slate-200/70 dark:border-white/5'
      }`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-9 h-9 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center text-base flex-shrink-0`}>
          {meta?.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 dark:text-white">{meta?.label}</span>
            {cfg.enabled ? (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                <span className={`w-1.5 h-1.5 ${colors.dot} rounded-full`} /> ATIVA
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-white/45 border border-slate-200 dark:border-white/10">
                DESLIGADA
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-white/55 mt-0.5 line-clamp-1">{meta?.desc}</p>
        </div>
        <label
          className="relative inline-flex items-center cursor-pointer flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={!!cfg.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-10 h-6 bg-slate-300 dark:bg-white/15 peer-checked:bg-gradient-to-r peer-checked:from-[#1D4ED8] peer-checked:to-[#3B82F6] peer-checked:shadow-[0_4px_12px_rgba(37,99,235,0.35)] rounded-full peer-focus:ring-2 peer-focus:ring-[#60A5FA]/30 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-4 after:shadow-sm" />
        </label>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400 dark:text-white/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 dark:text-white/40 flex-shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="p-4 pt-3 border-t border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.02] space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isWelcome ? (
              <NumberInput
                label="⏱️ Atraso após o atendimento"
                suffix="horas"
                value={cfg.delay_hours}
                onChange={(v) => update({ delay_hours: v })}
                hint="Tempo entre fim do corte e o envio do WhatsApp"
              />
            ) : (
              <NumberInput
                label="🔁 Cooldown entre tentativas"
                suffix="dias"
                value={cfg.cooldown_days}
                onChange={(v) => update({ cooldown_days: v })}
                hint="Não envia de novo nesse período"
              />
            )}
            {isVip && (
              <label className="flex items-start gap-2 px-3 py-2 border border-violet-200 dark:border-violet-400/30 rounded-lg bg-violet-50 dark:bg-violet-400/[0.08] cursor-pointer hover:bg-violet-100/70 dark:hover:bg-violet-400/[0.12]">
                <input
                  type="checkbox"
                  checked={!!cfg.alert_owner}
                  onChange={(e) => update({ alert_owner: e.target.checked })}
                  className="mt-0.5 accent-violet-600"
                />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-violet-900 dark:text-violet-200 block">Avisar a barbearia</span>
                  <span className="text-[10px] text-violet-700 dark:text-violet-300/80">Registra alerta interno quando VIP esfria</span>
                </div>
              </label>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-white/60 block mb-1.5">Variáveis (clique para inserir)</label>
            <div className="flex flex-wrap gap-1.5">
              {VARS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVar(v.key)}
                  className="text-[11px] font-mono px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-400/[0.12] text-[#2563EB] dark:text-[#93C5FD] hover:bg-blue-100 dark:hover:bg-blue-400/[0.2] border border-blue-200 dark:border-blue-400/30 transition-colors cursor-pointer"
                  title={v.label}
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-white/60 mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Mensagem enviada
            </label>
            <textarea
              value={cfg.message || ''}
              onChange={(e) => update({ message: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20 resize-none"
              placeholder="Escreva a mensagem usando as variáveis acima..."
            />
            <div className="text-[11px] text-slate-400 dark:text-white/40 mt-1">{(cfg.message || '').length} caracteres</div>
          </div>

          {cfg.message && (
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-white/60 mb-1.5 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Pré-visualização
              </label>
              <div className="bg-emerald-50 dark:bg-[#0B5C3E]/30 border border-emerald-200 dark:border-emerald-400/30 rounded-lg p-3 text-sm text-emerald-950 dark:text-emerald-50 whitespace-pre-wrap leading-relaxed shadow-sm relative backdrop-blur-sm">
                {previewText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NumberInput({ label, suffix, value, onChange, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600 dark:text-white/60 block mb-1">{label}</span>
      <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg focus-within:border-[#2563EB] dark:focus-within:border-[#60A5FA] focus-within:ring-2 focus-within:ring-[#60A5FA]/20 bg-slate-50 dark:bg-white/[0.04]">
        <input
          type="number"
          min={0}
          value={value ?? ''}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-full bg-transparent border-0 outline-none text-sm font-semibold text-slate-900 dark:text-white"
        />
        <span className="text-[11px] text-slate-500 dark:text-white/40 font-medium whitespace-nowrap">{suffix}</span>
      </div>
      {hint && <span className="text-[10px] text-slate-500 dark:text-white/40 mt-1 block">{hint}</span>}
    </label>
  );
}