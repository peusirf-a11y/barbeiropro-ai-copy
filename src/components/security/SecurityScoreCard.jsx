/**
 * SecurityScoreCard — Exibe o security score enterprise de um tenant.
 * Usado no MasterSecurityCenter e possivelmente no AppSeguranca.
 */

import { useMemo } from 'react';
import { Shield, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { computeSecurityScore, getBadgeForScore, SCORE_CATEGORIES } from '@/lib/security/securityScore';

function ScoreRing({ score, size = 80 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {object} props.data - Resultado de computeSecurityScore()
 * @param {boolean} [props.compact] - Versão compacta para listas
 */
export default function SecurityScoreCard({ data, compact = false }) {
  if (!data) return null;

  const { score, breakdown, badge, recommendations } = data;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
          <ScoreRing score={score} size={40} />
          <span className={`absolute text-[10px] font-black ${score >= 80 ? 'text-emerald-500' : score >= 55 ? 'text-amber-500' : 'text-red-500'}`}>
            {score}
          </span>
        </div>
        <div className="min-w-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.color}`}>
            {badge.icon} {badge.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
          <ScoreRing score={score} size={80} />
          <div className="absolute text-center">
            <div className={`text-xl font-black ${score >= 80 ? 'text-emerald-500' : score >= 55 ? 'text-amber-500' : 'text-red-500'}`}>
              {score}
            </div>
          </div>
        </div>
        <div>
          <div className="text-base font-bold text-foreground">Security Score</div>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
            {badge.icon} {badge.label}
          </span>
          {data.computed_at && (
            <div className="text-[10px] text-muted-foreground mt-1">
              Calculado em {new Date(data.computed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Breakdown por categoria */}
      <div className="space-y-2 mb-4">
        {Object.entries(SCORE_CATEGORIES).map(([key, cat]) => {
          const catScore = breakdown[key] || 0;
          const maxScore = cat.weight;
          const pct = maxScore > 0 ? Math.round((catScore / maxScore) * 100) : 0;
          const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-muted-foreground">{cat.label}</span>
                <span className="text-[11px] font-bold text-foreground">{catScore}/{maxScore}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recomendações */}
      {recommendations.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-1">
          <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wide flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Recomendações
          </div>
          {recommendations.map((rec, i) => (
            <div key={i} className="text-[11px] text-amber-500/90 flex items-start gap-1.5">
              <span className="text-amber-500/60 mt-0.5 flex-shrink-0">•</span>
              {rec}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}