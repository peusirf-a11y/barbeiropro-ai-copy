// Insights/alertas inteligentes inline (não-flutuante).
// Mostra insights operacionais com call-to-action discreto.

import { Link } from 'react-router-dom';
import { Sparkles, AlertTriangle, Clock, Zap, ArrowRight } from 'lucide-react';

const ICON_MAP = { warning: AlertTriangle, clock: Clock, zap: Zap };
const LEVEL_STYLES = {
  high:   { bg: 'bg-red-50',    border: 'border-red-100',    icon: 'text-red-600',    dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-50',  border: 'border-amber-100',  icon: 'text-amber-600',  dot: 'bg-amber-500' },
  low:    { bg: 'bg-blue-50',   border: 'border-blue-100',   icon: 'text-blue-600',   dot: 'bg-blue-500' },
};

export default function InsightsCard({ alerts = [] }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="font-bold text-[#111827] text-base">Insights inteligentes</h3>
      </div>
      <p className="text-xs text-[#6B7280] mb-4 ml-9">Sugestões para melhorar a operação</p>

      {alerts.length === 0 ? (
        <div className="text-center py-6 text-[#6B7280] text-sm">
          ✨ Tudo certo por aqui! Nenhum alerta no momento.
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.map(alert => {
            const Icon = ICON_MAP[alert.icon] || AlertTriangle;
            const s = LEVEL_STYLES[alert.level] || LEVEL_STYLES.medium;
            return (
              <Link
                key={alert.id}
                to={alert.href}
                className={`block ${s.bg} border ${s.border} rounded-xl p-3.5 hover:shadow-[var(--shadow-sm)] transition-all duration-200 group`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${s.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#111827] leading-snug">{alert.title}</div>
                    <p className="text-xs text-[#6B7280] mt-0.5">{alert.desc}</p>
                  </div>
                  <ArrowRight className={`w-4 h-4 ${s.icon} group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-1`} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}