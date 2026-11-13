// QuickActions.jsx — Ações Rápidas Corporativas do Dashboard
// Superfície: #FFFFFF | Borda: #E5E7EF | Ícones: Lucide strokeWidth=1.75
import { Link } from 'react-router-dom';
import { CalendarPlus, UserPlus, Wallet, ArrowRight } from 'lucide-react';

export default function QuickActions({ showFinance = true }) {
  const actions = [
    {
      label: 'Novo Agendamento',
      desc: 'Horário na bancada',
      href: '/app/agenda',
      icon: CalendarPlus,
      iconBg: 'bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40',
      show: true,
    },
    {
      label: 'Cadastrar Cliente',
      desc: 'Novo registro e perfil',
      href: '/app/clientes',
      icon: UserPlus,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40',
      show: true,
    },
    {
      label: 'Controle de Caixa',
      desc: 'Abertura, DRE e saídas',
      href: '/app/caixa',
      icon: Wallet,
      iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40',
      show: showFinance,
    },
  ].filter((a) => a.show);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            to={a.href}
            className="group rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md hover:border-[#B5D7E8] dark:hover:border-[#59658F] hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.iconBg}`}>
              <Icon className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[#171827] dark:text-white truncate">
                {a.label}
              </div>
              <div className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] truncate font-medium mt-0.5">
                {a.desc}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#59658F] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all flex-shrink-0" strokeWidth={1.75} />
          </Link>
        );
      })}
    </div>
  );
}