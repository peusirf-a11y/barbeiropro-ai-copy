// Ações rápidas — botões grandes para fluxos prioritários.
// Visual horizontal, ícones coloridos, hover com elevação.

import { Link } from 'react-router-dom';
import { CalendarPlus, UserPlus, Wallet, ArrowRight } from 'lucide-react';

export default function QuickActions({ showFinance = true }) {
  const actions = [
    {
      label: 'Novo agendamento',
      desc: 'Agende um cliente',
      href: '/app/agenda',
      icon: CalendarPlus,
      bg: 'bg-[#EFF6FF]',
      iconColor: 'text-[#2563EB]',
      show: true,
    },
    {
      label: 'Novo cliente',
      desc: 'Cadastre rapidamente',
      href: '/app/clientes',
      icon: UserPlus,
      bg: 'bg-[#ECFDF5]',
      iconColor: 'text-emerald-600',
      show: true,
    },
    {
      label: 'Abrir caixa',
      desc: 'Inicie o dia financeiro',
      href: '/app/caixa',
      icon: Wallet,
      bg: 'bg-[#FFFBEB]',
      iconColor: 'text-amber-600',
      show: showFinance,
    },
  ].filter(a => a.show);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {actions.map(a => (
        <Link
          key={a.href}
          to={a.href}
          className="group bg-white rounded-2xl border border-black/5 p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3"
        >
          <div className={`w-11 h-11 rounded-xl ${a.bg} flex items-center justify-center flex-shrink-0`}>
            <a.icon className={`w-5 h-5 ${a.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[#111827]">{a.label}</div>
            <div className="text-xs text-[#6B7280] truncate">{a.desc}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}