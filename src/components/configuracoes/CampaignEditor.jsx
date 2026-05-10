// Editor de UMA campanha de lifecycle.
// - Toggle enabled
// - Editor de mensagem com chips de variáveis ({nome}, {barbearia}, {link_agendamento})
// - Preview em tempo real
// - Cooldown configurável (ou delay_hours, no caso do welcome)
//
// Recebe a chave da campanha + valor atual + onChange(newCfg).

import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Eye } from 'lucide-react';
import { CAMPAIGN_LABELS, CAMPAIGN_DEFAULTS, renderTemplate } from '@/lib/lifecycleCampaigns';

const VARS = [
  { key: '{nome}', label: 'Nome do cliente' },
  { key: '{barbearia}', label: 'Nome da barbearia' },
  { key: '{link_agendamento}', label: 'Link de agendamento' },
];

const COLOR_CLASSES = {
  sky:     { bg: 'bg-sky-50',     ring: 'ring-sky-200',     text: 'text-sky-700',     dot: 'bg-sky-500' },
  amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  orange:  { bg: 'bg-orange-50',  ring: 'ring-orange-200',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  red:     { bg: 'bg-red-50',     ring: 'ring-red-200',     text: 'text-red-700',     dot: 'bg-red-500' },
  purple:  { bg: 'bg-purple-50',  ring: 'ring-purple-200',  text: 'text-purple-700',  dot: 'bg-purple-500' },
  emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
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
    <div className={`rounded-xl border border-black/5 overflow-hidden transition-all ${cfg.enabled ? 'bg-white' : 'bg-gray-50/60'}`}>
      {/* Header — sempre visível */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-9 h-9 rounded-lg ${colors.bg} ring-1 ${colors.ring} flex items-center justify-center text-base flex-shrink-0`}>
          {meta?.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-[#111827]">{meta?.label}</span>
            {cfg.enabled ? (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.ring.replace('ring-', 'border-')}`}>
                <span className={`w-1.5 h-1.5 ${colors.dot} rounded-full`} /> ATIVA
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                DESLIGADA
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{meta?.desc}</p>
        </div>
        {/* Toggle — não dispara expand */}
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
          <div className="w-10 h-6 bg-gray-200 peer-checked:bg-[#2563EB] rounded-full peer-focus:ring-2 peer-focus:ring-[#2563EB]/20 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-4 after:shadow-sm" />
        </label>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {/* Corpo expansível */}
      {expanded && (
        <div className="p-4 pt-2 border-t border-black/5 bg-white space-y-4 animate-fade-in">
          {/* Cooldown / delay */}
          <div className="grid grid-cols-2 gap-3">
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
              <label className="flex items-start gap-2 px-3 py-2 border border-black/10 rounded-lg bg-purple-50/40 cursor-pointer hover:bg-purple-50">
                <input
                  type="checkbox"
                  checked={!!cfg.alert_owner}
                  onChange={(e) => update({ alert_owner: e.target.checked })}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-purple-900 block">Avisar a barbearia</span>
                  <span className="text-[10px] text-purple-700/80">Registra alerta interno quando VIP esfria</span>
                </div>
              </label>
            )}
          </div>

          {/* Variáveis disponíveis */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">Variáveis (clique para inserir)</label>
            <div className="flex flex-wrap gap-1.5">
              {VARS.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVar(v.key)}
                  className="text-[11px] font-mono px-2 py-1 rounded-md bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] border border-[#DBEAFE] transition-colors"
                  title={v.label}
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          {/* Mensagem */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Mensagem enviada
            </label>
            <textarea
              value={cfg.message || ''}
              onChange={(e) => update({ message: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-black/10 rounded-lg text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 resize-none"
              placeholder="Escreva a mensagem usando as variáveis acima..."
            />
            <div className="text-[11px] text-gray-400 mt-1">{(cfg.message || '').length} caracteres</div>
          </div>

          {/* Preview */}
          {cfg.message && (
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Pré-visualização
              </label>
              <div className="bg-[#E5F8D7] border border-[#C8EBA0] rounded-lg p-3 text-sm text-[#1F2937] whitespace-pre-wrap leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.05)] relative">
                <div className="absolute -left-1 top-2 w-3 h-3 bg-[#E5F8D7] rotate-45 border-l border-b border-[#C8EBA0]" />
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
      <span className="text-xs font-semibold text-gray-500 block mb-1">{label}</span>
      <div className="flex items-center gap-2 px-3 py-2 border border-black/10 rounded-lg focus-within:ring-2 focus-within:ring-[#2563EB]/20 bg-white">
        <input
          type="number"
          min={0}
          value={value ?? ''}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-full bg-transparent border-0 outline-none text-sm font-semibold text-[#111827]"
        />
        <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">{suffix}</span>
      </div>
      {hint && <span className="text-[10px] text-gray-400 mt-1 block">{hint}</span>}
    </label>
  );
}