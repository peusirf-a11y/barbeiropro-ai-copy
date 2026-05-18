// Insights inteligentes — cards dark glass com tom semântico (high/medium/low).

import { Link } from 'react-router-dom';
import { Sparkles, AlertTriangle, Clock, Zap, ArrowRight } from 'lucide-react';

const ICON_MAP = { warning: AlertTriangle, clock: Clock, zap: Zap };
const LEVEL_STYLES = {
  high:   { tint: 'from-rose-500/10',    ring: 'ring-rose-400/25',    icon: 'text-rose-300',    glow: 'rgba(248,113,113,0.35)' },
  medium: { tint: 'from-amber-500/10',   ring: 'ring-amber-400/25',   icon: 'text-amber-300',   glow: 'rgba(251,191,36,0.35)' },
  low:    { tint: 'from-blue-500/10',    ring: 'ring-blue-400/25',    icon: 'text-blue-300',    glow: 'rgba(96,165,250,0.35)' },
};

export default function InsightsCard({ alerts = [] }) {
  return (
    <div className="relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-1">
        <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center ring-1 ring-white/15">
          <div className="absolute inset-0 rounded-lg bg-[#60A5FA] blur-md opacity-40" />
          <Sparkles className="relative w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="font-bold text-white text-base">Insights inteligentes</h3>
      </div>
      <p className="text-xs text-white/45 mb-4 ml-9">Sugestões para melhorar a operação</p>

      {alerts.length === 0 ? (
        <div className="text-center py-6 text-white/50 text-sm">
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
                className="group relative block rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 p-3.5 overflow-hidden transition-all duration-200"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${s.tint} to-transparent opacity-70 pointer-events-none`} />
                <div className="relative flex items-start gap-3">
                  <div className={`relative w-8 h-8 rounded-lg bg-white/[0.04] ring-1 ${s.ring} flex items-center justify-center flex-shrink-0`}>
                    <span className="absolute inset-0 rounded-lg blur-md opacity-50" style={{ background: s.glow }} />
                    <Icon className={`relative w-4 h-4 ${s.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white leading-snug">{alert.title}</div>
                    <p className="text-xs text-white/55 mt-0.5">{alert.desc}</p>
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