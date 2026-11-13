// InsightsCard.jsx — Painel de Insights Inteligentes de Negócio
// Superfície: #FFFFFF | Borda: #E5E7EF | Acentos: #171827, #59658F, #B5D7E8 | Ícones: Lucide strokeWidth=1.75
import { Link } from 'react-router-dom';
import { Sparkles, AlertTriangle, Clock, Zap, ArrowRight } from 'lucide-react';

const ICON_MAP = { warning: AlertTriangle, clock: Clock, zap: Zap };
const LEVEL_STYLES = {
  high: {
    bg: 'bg-rose-50/70 dark:bg-rose-950/20',
    border: 'border-rose-200 dark:border-rose-800/40',
    iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300',
    text: 'text-rose-900 dark:text-rose-200',
  },
  medium: {
    bg: 'bg-amber-50/70 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800/40',
    iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300',
    text: 'text-amber-900 dark:text-amber-200',
  },
  low: {
    bg: 'bg-[#EFF6FF]/70 dark:bg-blue-950/20',
    border: 'border-[#DBEAFE] dark:border-blue-800/40',
    iconBg: 'bg-[#DBEAFE] text-[#2563EB] dark:bg-blue-900/50 dark:text-blue-300',
    text: 'text-[#171827] dark:text-white',
  },
};

export default function InsightsCard({ alerts = [] }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] p-4 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 flex items-center justify-center font-bold">
          <Sparkles className="w-4 h-4 text-[#2563EB]" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="font-extrabold text-[#171827] dark:text-white text-base tracking-tight">
            Insights & Oportunidades
          </h3>
          <p className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">
            Diagnósticos automatizados para aumento de receita e retenção
          </p>
        </div>
      </div>

      <div className="mt-4">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-[#55596A] dark:text-[#8F9BBF] text-xs">
            ✨ Todos os indicadores operacionais estão estáveis e dentro da meta.
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert) => {
              const Icon = ICON_MAP[alert.icon] || AlertTriangle;
              const s = LEVEL_STYLES[alert.level] || LEVEL_STYLES.medium;
              return (
                <Link
                  key={alert.id}
                  to={alert.href}
                  className={`group block rounded-xl border p-3.5 transition-all duration-200 hover:shadow-sm ${s.bg} ${s.border}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
                      <Icon className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold leading-snug ${s.text}`}>
                        {alert.title}
                      </div>
                      <p className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] mt-0.5 leading-relaxed">
                        {alert.desc}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#59658F] group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-1" strokeWidth={1.75} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}