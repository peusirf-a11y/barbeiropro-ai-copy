// HealthBadge — selo visual de saúde do sistema (healthy/degraded/critical).
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

const CFG = {
  healthy:  { label: 'Saudável', icon: CheckCircle2,  cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30' },
  degraded: { label: 'Degradado', icon: AlertTriangle, cls: 'bg-amber-500/15 text-amber-300 ring-amber-400/30' },
  critical: { label: 'Crítico',  icon: AlertCircle,   cls: 'bg-rose-500/15 text-rose-300 ring-rose-400/30' },
};

export default function HealthBadge({ status = 'healthy', score, size = 'md' }) {
  const cfg = CFG[status] || CFG.healthy;
  const Icon = cfg.icon;
  const px = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ${cfg.cls} ${px}`}>
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      {cfg.label}
      {typeof score === 'number' && <span className="opacity-75">· {score}/100</span>}
    </span>
  );
}