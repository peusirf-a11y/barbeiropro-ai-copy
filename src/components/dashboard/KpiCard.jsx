// KpiCard premium dark — glass com glow do tom no ícone e gradiente sutil no fundo.
// API mantida: { label, value, sub, icon, tone, delta }.

import { TrendingUp, TrendingDown } from 'lucide-react';

const TONES = {
  blue:    { glow: 'rgba(96,165,250,0.35)',  icon: 'text-[#93C5FD]', tint: 'from-blue-500/10',    ring: 'ring-blue-400/20' },
  green:   { glow: 'rgba(52,211,153,0.30)',  icon: 'text-emerald-300', tint: 'from-emerald-500/10', ring: 'ring-emerald-400/20' },
  amber:   { glow: 'rgba(251,191,36,0.30)',  icon: 'text-amber-300',   tint: 'from-amber-500/10',   ring: 'ring-amber-400/20' },
  red:     { glow: 'rgba(248,113,113,0.30)', icon: 'text-rose-300',    tint: 'from-rose-500/10',    ring: 'ring-rose-400/20' },
  gray:    { glow: 'rgba(148,163,184,0.25)', icon: 'text-slate-300',   tint: 'from-slate-500/10',   ring: 'ring-slate-400/20' },
};

export default function KpiCard({ label, value, sub, icon: Icon, tone = 'blue', delta }) {
  const t = TONES[tone] || TONES.blue;
  const isPositive = typeof delta === 'number' && delta >= 0;
  return (
    <div className="group relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 overflow-hidden transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5 hover:bg-white/[0.04]">
      {/* Tint gradiente do tom no canto */}
      <div className={`absolute inset-0 bg-gradient-to-br ${t.tint} to-transparent opacity-60 pointer-events-none`} />

      <div className="relative flex items-start justify-between mb-3">
        <div className={`relative w-10 h-10 rounded-xl bg-white/[0.04] ring-1 ${t.ring} flex items-center justify-center`}>
          <span
            className="absolute inset-0 rounded-xl blur-md opacity-60"
            style={{ background: t.glow }}
            aria-hidden="true"
          />
          {Icon && <Icon className={`relative w-5 h-5 ${t.icon}`} />}
        </div>
        {typeof delta === 'number' && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${
            isPositive
              ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/20'
              : 'bg-rose-500/10 text-rose-300 ring-rose-400/20'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <div className="relative text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1">{label}</div>
      <div className="relative text-2xl lg:text-[28px] font-black tracking-tight leading-none bg-gradient-to-b from-white to-white/75 bg-clip-text text-transparent">{value}</div>
      {sub && <div className="relative text-xs text-white/50 mt-2">{sub}</div>}
    </div>
  );
}