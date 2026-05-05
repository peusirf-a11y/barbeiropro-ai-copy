// Layout do painel Master — sidebar fixa à esquerda, header no topo e conteúdo dinâmico à direita.
// Responsivo: no mobile, sidebar vira drawer (menu hambúrguer).
import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, CreditCard, DollarSign, Users, Settings, Menu, X, LogOut, Shield } from 'lucide-react';
import Logo from '@/components/Logo';

const navItems = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: '/master/dashboard' },
  { label: 'Barbearias',    icon: Building2,       path: '/master/barbearias' },
  { label: 'Assinaturas',   icon: CreditCard,      path: '/master/assinaturas' },
  { label: 'Financeiro',    icon: DollarSign,      path: '/master/financeiro' },
  { label: 'Usuários',      icon: Users,           path: '/master/usuarios' },
  { label: 'Configurações', icon: Settings,        path: '/master/configuracoes' },
];

export default function MasterLayout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Fecha o drawer ao trocar de rota
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Lock body scroll quando drawer aberto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const SidebarContent = (
    <>
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <Link to="/master/dashboard" className="flex items-center gap-3 group min-w-0">
          <div className="w-10 h-10 bg-[#0B1020] rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.35)] flex-shrink-0 overflow-hidden">
            <Logo size={36} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[15px] text-white tracking-wider truncate">O CORTE</div>
            <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
              <Shield className="w-3 h-3" /> Super Admin
            </div>
          </div>
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-white/10 text-gray-300"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/5 space-y-1">
        <Link
          to="/app/dashboard"
          className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors w-full px-3 py-2.5 rounded-xl hover:bg-white/5 font-medium"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sair do Master
        </Link>
      </div>
    </>
  );

  // Título dinâmico baseado na rota ativa
  const activeNav = navItems.find(i => location.pathname.startsWith(i.path));
  const pageTitle = activeNav?.label || 'Master';

  return (
    <div className="min-h-screen bg-[#F7F8FB] font-inter">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5 h-14 flex items-center justify-between px-4 gap-2">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-[#0B1020] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <Logo size={28} />
          </div>
          <span className="font-bold text-[15px] text-[#0F172A] tracking-tight truncate">{pageTitle}</span>
        </div>
        <div className="w-9" />
      </header>

      {/* Desktop sidebar — DARK, fixed */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-[#0B1020] border-r border-white/5 flex-col fixed h-screen overflow-hidden z-40">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-[82%] max-w-[300px] bg-[#0B1020] flex flex-col shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {SidebarContent}
        </aside>
      </div>

      {/* Desktop top header */}
      <header className="hidden lg:flex lg:ml-64 sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5 h-16 items-center justify-between px-8 gap-3">
        <div>
          <div className="text-[11px] text-gray-400 leading-none uppercase tracking-wider font-semibold">Painel Master · O CORTE</div>
          <h1 className="text-lg font-bold text-[#0F172A] mt-0.5 tracking-tight">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xs text-gray-500 hover:text-[#2563EB] px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors font-medium">
            ← Landing
          </Link>
          <Link to="/app/dashboard" className="text-xs text-gray-500 hover:text-[#2563EB] px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors font-medium">
            App →
          </Link>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="lg:ml-64 min-h-[calc(100vh-4rem)] animate-fade-in">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}