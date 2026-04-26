import { Link, useLocation } from 'react-router-dom';
import { Calendar, Users, Briefcase, DollarSign, BarChart2, Zap, LayoutDashboard, Scissors } from 'lucide-react';
import Logo from '@/components/Logo';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/demo/dashboard' },
  { label: 'Agenda', icon: Calendar, path: '/demo/agenda' },
  { label: 'Clientes', icon: Users, path: '/demo/clientes' },
  { label: 'Serviços', icon: Briefcase, path: '/demo/servicos' },
  { label: 'Profissionais', icon: Scissors, path: '/demo/profissionais' },
  { label: 'Financeiro', icon: DollarSign, path: '/demo/financeiro' },
  { label: 'Relatórios', icon: BarChart2, path: '/demo/relatorios' },
  { label: 'AI Growth', icon: Zap, path: '/demo/ai-growth' },
];

export default function DemoLayout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#F7F8FB] font-inter">
      {/* Demo Banner */}
      <div className="bg-brand-gradient text-white text-center py-2.5 px-4 flex items-center justify-center gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Modo Demonstração — dados fictícios, nenhuma ação é salva
        </div>
        <div className="hidden sm:flex items-center gap-3 ml-4">
          <Link to="/" className="text-xs text-white/80 hover:text-white underline-offset-2 hover:underline">← Voltar à LP</Link>
          <a href="https://turbosaas.pro/" target="_blank" rel="noopener noreferrer">
            <span className="bg-white text-[#2563EB] text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white/90 transition-colors">
              Contratar agora
            </span>
          </a>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-white border-r border-black/5 flex flex-col sticky top-10 h-screen overflow-y-auto">
          <div className="px-6 py-5 border-b border-black/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center overflow-hidden shadow-[var(--shadow-sm)]">
                <Logo size={40} className="rounded-none" />
              </div>
              <div>
                <div className="font-bold text-[15px] text-[#0F172A] tracking-tight">Barbearia Demo</div>
                <div className="text-[11px] text-gray-400 font-medium">BarberTrimly</div>
              </div>
            </div>
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

          <div className="p-4 border-t border-black/5">
            <div className="rounded-2xl p-4 text-center bg-gradient-to-br from-[#2563EB]/5 to-[#60A5FA]/10 border border-[#2563EB]/10">
              <p className="text-xs text-gray-600 mb-3 font-medium">Gostou do que viu?</p>
              <a href="https://turbosaas.pro/" target="_blank" rel="noopener noreferrer" className="block">
                <button className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-[var(--shadow-sm)] hover:shadow-brand active:scale-[0.98]">
                  Contratar BarberTrimly
                </button>
              </a>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-screen animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}