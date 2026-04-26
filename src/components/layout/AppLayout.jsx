import { Link, useLocation } from 'react-router-dom';
import { Scissors, Calendar, Users, Briefcase, DollarSign, BarChart2, Zap, Settings, UserCheck, Home, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';

const navItems = [
  { label: 'Dashboard', icon: Home, path: '/app/dashboard' },
  { label: 'Agenda', icon: Calendar, path: '/app/agenda' },
  { label: 'Clientes', icon: Users, path: '/app/clientes' },
  { label: 'Serviços', icon: Briefcase, path: '/app/servicos' },
  { label: 'Profissionais', icon: Scissors, path: '/app/profissionais' },
  { label: 'Financeiro', icon: DollarSign, path: '/app/financeiro' },
  { label: 'Relatórios', icon: BarChart2, path: '/app/relatorios' },
  { label: 'AI Growth', icon: Zap, path: '/app/ai-growth' },
  { label: 'Equipe', icon: UserCheck, path: '/app/equipe' },
  { label: 'Configurações', icon: Settings, path: '/app/configuracoes' },
];

export default function AppLayout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#F8F7F3] font-inter flex">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-white border-r border-black/10 flex flex-col fixed h-screen overflow-y-auto z-40">
        <div className="p-6 border-b border-black/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center overflow-hidden">
              <Logo size={36} className="rounded-none" />
            </div>
            <div>
              <div className="font-bold text-sm text-[#1B1C1E]">BarberTrimly</div>
              <div className="text-xs text-gray-400">Painel de gestão</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : 'text-gray-600 hover:bg-[#F8F7F3] hover:text-[#2563EB]'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {item.label === 'AI Growth' && (
                  <span className="ml-auto text-xs bg-[#60A5FA] text-white font-bold px-1.5 py-0.5 rounded">AI</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-black/10">
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors w-full px-3 py-2"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}