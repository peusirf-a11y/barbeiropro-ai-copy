/**
 * DangerConfirmModal — Modal de confirmação para ações destrutivas.
 *
 * Exige que o usuário digite uma palavra-chave para confirmar.
 * Para ações críticas, exibe impacto claro e motivo opcional.
 */

import { useState } from 'react';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';

const SEVERITY_CONFIG = {
  high: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeLabel: 'Ação de Alto Risco',
    buttonBg: 'bg-amber-500 hover:bg-amber-600',
  },
  critical: {
    icon: ShieldAlert,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    badgeLabel: 'Ação Irreversível',
    buttonBg: 'bg-red-600 hover:bg-red-700',
  },
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {function} props.onClose
 * @param {function} props.onConfirm - chamado com { reason } quando confirmado
 * @param {string} props.title - Título da ação
 * @param {string} props.description - Descrição do que será feito
 * @param {string[]} props.impacts - Lista de impactos da ação
 * @param {string} props.confirmWord - Palavra que o usuário deve digitar (ex: "EXCLUIR")
 * @param {'high'|'critical'} props.severity
 * @param {boolean} [props.requireReason] - Exigir motivo
 * @param {boolean} [props.loading]
 */
export default function DangerConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirmar ação',
  description,
  impacts = [],
  confirmWord = 'CONFIRMAR',
  severity = 'high',
  requireReason = false,
  loading = false,
}) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');

  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.high;
  const Icon = config.icon;
  const isValid = typed === confirmWord && (!requireReason || reason.trim().length > 3);

  const handleConfirm = () => {
    if (!isValid || loading) return;
    onConfirm({ reason: reason.trim() });
  };

  const handleClose = () => {
    if (loading) return;
    setTyped('');
    setReason('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-2xl border shadow-xl ${config.bg} ${config.border}`}>
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-black/10">
          <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full mb-1 ${config.badgeBg} ${config.badgeText}`}>
              {config.badgeLabel}
            </div>
            <h2 className="text-base font-black text-[#111827] leading-tight">{title}</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-black/10 text-gray-400 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {description && (
            <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
          )}

          {impacts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Impactos:</div>
              <ul className="space-y-1">
                {impacts.map((impact, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className={`mt-0.5 flex-shrink-0 ${config.iconColor}`}>•</span>
                    {impact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Confirmação digitada */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">
              Digite <code className="font-mono text-xs font-black text-gray-800 bg-white/70 px-1.5 py-0.5 rounded">{confirmWord}</code> para confirmar:
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={confirmWord}
              disabled={loading}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm font-mono transition-all focus:outline-none ${
                typed && typed !== confirmWord
                  ? 'border-red-300 bg-red-50'
                  : typed === confirmWord
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-black/15 bg-white'
              }`}
            />
          </div>

          {/* Motivo opcional/obrigatório */}
          {requireReason && (
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5">
                Motivo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="Descreva o motivo desta ação…"
                disabled={loading}
                className="w-full px-3 py-2.5 border border-black/15 bg-white rounded-lg text-sm resize-none focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-black/10">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-black/15 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${config.buttonBg}`}
          >
            {loading ? 'Processando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}