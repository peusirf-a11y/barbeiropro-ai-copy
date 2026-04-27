import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Calendar, Users, Briefcase, DollarSign, BarChart2, Zap, LayoutDashboard, Scissors, Menu, X } from 'lucide-react';
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
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleExitDemo = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    try { localStorage.removeItem('demo_mode'); } catch (err) {}
    window.location.href = '/';
  };

  const SidebarContent = (
    <>
      <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center overflow-hidden shadow-[var(--shadow-sm)] flex-shrink-0">
            <Logo size={40} className="rounded-none" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[15px] text-[#0F172A] tracking-tight truncate">Barbearia Demo</div>
            <div className="text-[11px] text-gray-400 font-medium">BarberTrimly</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Fechar menu">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-[#2563EB]/10 text-[#2563EB]'
                  : 'text-gray-600 hover:bg-[#F7F8FB] hover:text-[#0F172A] active:bg-gray-100'
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
          <Link to="/checkout" className="block">
            <button
              onClick={() => { try { localStorage.removeItem('demo_mode'); } catch (e) {} }}
              className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-[var(--shadow-sm)] hover:shadow-brand active:scale-[0.98]"
            >
              Contratar BarberTrimly
            </button>
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F7F8FB] font-inter">
      {/* Demo Banner */}
      <div className="bg-brand-gradient text-white py-2 px-3 sm:px-4 flex items-center justify-between sm:justify-center gap-2 sm:gap-3 sticky top-0 z-[60] text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-medium min-w-0">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse flex-shrink-0" />
          <span className="hidden sm:inline">Modo Demonstração — dados fictícios</span>
          <span className="sm:hidden truncate">Demo</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 ml-2">
          <button
            type="button"
            onClick={handleExitDemo}
            className="text-xs text-white/80 hover:text-white underline-offset-2 hover:underline"
          >
            ← Sair da demo
          </button>
          <Link to="/checkout">
            <span className="bg-white text-[#2563EB] text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white/90 transition-colors">
              Contratar
            </span>
          </Link>
        </div>
        {/* Mobile exit — touch-friendly, z-index acima de tudo */}
        <button
          type="button"
          onClick={handleExitDemo}
          onTouchEnd={handleExitDemo}
          className="sm:hidden relative z-[70] inline-flex items-center justify-center h-9 px-4 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-bold whitespace-nowrap touch-manipulation"
          aria-label="Sair do modo demo"
        >
          Sair
        </button>
      </div>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-9 z-30 bg-white/95 backdrop-blur border-b border-black/5 h-14 flex items-center justify-between px-4">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700" aria-label="Abrir menu">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center overflow-hidden">
            <Logo size={32} className="rounded-none" />
          </div>
          <span className="font-bold text-[15px] text-[#0F172A] tracking-tight">Demo</span>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 min-h-screen bg-white border-r border-black/5 flex-col sticky top-10 h-screen overflow-hidden">
          {SidebarContent}
        </aside>

        {/* Mobile drawer */}
        <div className={`lg:hidden fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
          <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} />
          <aside className={`absolute left-0 top-0 bottom-0 w-[82%] max-w-[300px] bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>
            {SidebarContent}
          </aside>
        </div>

        {/* Main content */}
        <main className="flex-1 min-h-screen animate-fade-in min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}