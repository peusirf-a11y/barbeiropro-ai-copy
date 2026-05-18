// Ações rápidas dark — cards glass com ícone glowing.

import { Link } from 'react-router-dom';
import { CalendarPlus, UserPlus, Wallet, ArrowRight } from 'lucide-react';

export default function QuickActions({ showFinance = true }) {
  const actions = [
    {
      label: 'Novo agendamento',
      desc: 'Agende um cliente',
      href: '/app/agenda',
      icon: CalendarPlus,
      glow: 'rgba(96,165,250,0.35)',
      iconColor: 'text-[#93C5FD]',
      ring: 'ring-blue-400/20',
      tint: 'from-blue-500/10',
      show: true,
    },
    {
      label: 'Novo cliente',
      desc: 'Cadastre rapidamente',
      href: '/app/clientes',
      icon: UserPlus,
      glow: 'rgba(52,211,153,0.30)',
      iconColor: 'text-emerald-300',
      ring: 'ring-emerald-400/20',
      tint: 'from-emerald-500/10',
      show: true,
    },
    {
      label: 'Abrir caixa',
      desc: 'Inicie o dia financeiro',
      href: '/app/caixa',
      icon: Wallet,
      glow: 'rgba(251,191,36,0.30)',
      iconColor: 'text-amber-300',
      ring: 'ring-amber-400/20',
      tint: 'from-amber-500/10',
      show: showFinance,
    },
  ].filter(a => a.show);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {actions.map(a => (
        <Link
          key={a.href}
          to={a.href}
          className="group relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-4 overflow-hidden flex items-center gap-3 transition-all duration-200 hover:border-white/15 hover:-translate-y-0.5 hover:bg-white/[0.045]"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${a.tint} to-transparent opacity-50 pointer-events-none`} />
          <div className={`relative w-11 h-11 rounded-xl bg-white/[0.04] ring-1 ${a.ring} flex items-center justify-center flex-shrink-0`}>
            <span className="absolute inset-0 rounded-xl blur-md opacity-60" style={{ background: a.glow }} />
            <a.icon className={`relative w-5 h-5 ${a.iconColor}`} />
          </div>
          <div className="relative flex-1 min-w-0">
            <div className="text-sm font-bold text-white">{a.label}</div>
            <div className="text-xs text-white/50 truncate">{a.desc}</div>
          </div>
          <ArrowRight className="relative w-4 h-4 text-white/30 group-hover:text-[#93C5FD] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}