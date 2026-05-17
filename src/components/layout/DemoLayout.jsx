/**
 * DemoLayout — Espelho visual EXATO do AppLayout.
 * Sidebar idêntica, banner discreto de demonstração no topo.
 * Mais navegação = mais paridade com o sistema real.
 */
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Calendar, Users, Briefcase, DollarSign, BarChart2, Zap,
  LayoutDashboard, Menu, X, Scissors, Star, Repeat,
} from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import NavList from '@/components/layout/NavList';

const navItems = [
  { key: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard, path: '/demo/dashboard' },
  { key: 'agenda',        label: 'Agenda',        icon: Calendar,        path: '/demo/agenda' },
  { key: 'clientes',      label: 'Clientes',      icon: Users,           path: '/demo/clientes' },
  { key: 'servicos',      label: 'Serviços',      icon: Briefcase,       path: '/demo/servicos' },
  { key: 'profissionais', label: 'Profissionais', icon: Scissors,        path: '/demo/profissionais' },
  { key: 'financeiro',    label: 'Financeiro',    icon: DollarSign,      path: '/demo/financeiro' },
  { key: 'relatorios',    label: 'Relatórios',    icon: BarChart2,       path: '/demo/relatorios' },
  { key: 'ai-growth',     label: 'AI Growth',     icon: Zap,             path: '/demo/ai-growth', badge: 'AI' },
];

export default function DemoLayout({ children }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const SidebarContent = (
    <>
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <Link to="/demo/dashboard" className="group min-w-0">
          <BrandMark size={42} tone="dark" subtitle="Modo demonstração" />
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-white/10 text-gray-300"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <NavList items={navItems} />

      <div className="px-3 py-4 border-t border-white/5 mt-auto">
        <Link
          to="/"
          className="flex items-center justify-center gap-2 text-sm text-white bg-[#2563EB] hover:bg-[#1d4ed8] transition-colors w-full px-3 py-2.5 rounded-xl font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.35)]"
        >
          Criar minha conta grátis →
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F7F8FB] font-inter">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5 h-14 flex items-center justify-between px-4">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/demo/dashboard">
          <BrandMark size={32} tone="light" />
        </Link>
        {/* Banner mobile */}
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 ring-1 ring-amber-200">
          Demo
        </span>
      </header>

      {/* Desktop sidebar */}
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

      {/* Desktop top header — banner demo + CTA */}
      <header className="hidden lg:flex lg:ml-64 sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5 h-16 items-center justify-between px-8 gap-3">
        <div className="flex items-center gap-2.5 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            Demonstração
          </span>
          <span className="text-gray-500">Você está visualizando dados de exemplo.</span>
        </div>
        <Link
          to="/"
          className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#1d4ed8] transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
        >
          Criar conta grátis →
        </Link>
      </header>

      {/* Mobile bottom nav (espelha AppLayout) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-black/5 flex items-stretch h-16 safe-area-inset-bottom">
        {navItems.slice(0, 5).map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.key}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${isActive ? 'text-[#2563EB]' : 'text-gray-400'}`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-[#2563EB]' : 'text-gray-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <main className="lg:ml-64 min-h-[calc(100vh-4rem)] pb-16 lg:pb-0 animate-fade-in">
        {children}
      </main>
    </div>
  );
}