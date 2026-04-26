import { Link, useLocation } from 'react-router-dom';
import { Calendar, Users, Briefcase, DollarSign, BarChart2, Zap, Settings, UserCheck, LayoutDashboard, LogOut, Scissors } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/app/dashboard' },
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
    <div className="min-h-screen bg-[#F7F8FB] font-inter flex">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-white border-r border-black/5 flex flex-col fixed h-screen overflow-y-auto z-40">
        <div className="px-6 py-5 border-b border-black/5">
          <Link to="/app/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center overflow-hidden shadow-[var(--shadow-sm)] transition-transform group-hover:scale-105">
              <Logo size={40} className="rounded-none" />
            </div>
            <div>
              <div className="font-bold text-[15px] text-[#0F172A] tracking-tight">BarberTrimly</div>
              <div className="text-[11px] text-gray-400 font-medium">Painel de gestão</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-[#2563EB]/10 text-[#2563EB]'
                    : 'text-gray-600 hover:bg-[#F7F8FB] hover:text-[#0F172A]'
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 transition-transform ${active ? '' : 'group-hover:scale-110'}`} />
                <span>{item.label}</span>
                {item.label === 'AI Growth' && (
                  <span className="ml-auto text-[10px] bg-brand-gradient text-white font-bold px-1.5 py-0.5 rounded-md tracking-wide">AI</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-black/5">
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-3 text-sm text-gray-500 hover:text-red-500 transition-colors w-full px-3 py-2.5 rounded-xl hover:bg-red-50 font-medium"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen animate-fade-in">
        {children}
      </main>
    </div>
  );
}