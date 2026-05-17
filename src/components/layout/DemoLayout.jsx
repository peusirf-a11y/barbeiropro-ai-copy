/**
 * DemoLayout — Espelho visual EXATO do AppLayout.
 * Mesma estrutura: sidebar dark, header desktop c/ info, header mobile c/ back,
 * MobileBottomTabs com drawer, banner demo discreto.
 */
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Calendar, Users, Briefcase, DollarSign, BarChart2, Zap,
  LayoutDashboard, X, Scissors, Wallet, MoreHorizontal,
  ChevronLeft, Lock, Package, Repeat, Percent, Star, Gift,
  UserCheck, Settings, CreditCard, MessageSquare,
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

// Abas da bottom nav (mobile) — espelha MobileBottomTabs do AppLayout
const BOTTOM_TABS = [
  { key: 'dashboard',  label: 'Dashboard', icon: LayoutDashboard, path: '/demo/dashboard' },
  { key: 'agenda',     label: 'Agenda',    icon: Calendar,        path: '/demo/agenda' },
  { key: 'clientes',   label: 'Clientes',  icon: Users,           path: '/demo/clientes' },
  { key: 'financeiro', label: 'Financeiro',icon: DollarSign,      path: '/demo/financeiro' },
];

// Sub-rotas não existem na demo, mas mantemos mapeamento por coerência
const MAIN_DEMO_ROUTES = new Set([
  '/demo/dashboard', '/demo/agenda', '/demo/clientes', '/demo/financeiro',
]);

export default function DemoLayout({ children }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const isSubRoute = !MAIN_DEMO_ROUTES.has(location.pathname);

  const SidebarContent = (
    <>
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <Link to="/demo/dashboard" className="group min-w-0 transition-transform group-hover:scale-[1.02]">
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
      {/* Mobile top bar — idêntico ao AppLayout */}
      <header
        className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5 flex items-center justify-between px-4 gap-2"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(56px + env(safe-area-inset-top, 0px))',
        }}
      >
        {isSubRoute ? (
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 -ml-2 px-2 py-2 rounded-lg active:bg-gray-100 text-[#0F172A] min-w-0"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5 flex-shrink-0" />
            <span className="text-[15px] font-semibold truncate">Voltar</span>
          </button>
        ) : (
          <Link to="/demo/dashboard" className="min-w-0" aria-label="Dashboard">
            <BrandMark size={32} tone="light" />
          </Link>
        )}
        {/* Badge demo mobile */}
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 ring-1 ring-amber-200">
          Demo
        </span>
      </header>

      {/* Desktop sidebar — DARK, idêntico ao AppLayout */}
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

      {/* Desktop top header — banner demo + CTA (idêntico em altura/estrutura ao AppLayout) */}
      <header className="hidden lg:flex lg:ml-64 sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5 h-16 items-center justify-between px-8 gap-3">
        <div className="flex items-center gap-2.5 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            Demonstração
          </span>
          <span className="text-gray-500">Você está visualizando dados de exemplo.</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#1d4ed8] transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
          >
            Criar conta grátis →
          </Link>
          {/* Avatar placeholder — igual ao AppLayout */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
            B
          </div>
        </div>
      </header>

      {/* Main content — mesmo padding que AppLayout */}
      <main className="lg:ml-64 min-h-[calc(100vh-4rem)] pb-[calc(58px+env(safe-area-inset-bottom,0px))] lg:pb-0 animate-fade-in">
        {children}
      </main>

      {/* Bottom tab bar mobile — estrutura idêntica ao MobileBottomTabs */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-black/10 select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch h-[58px]">
          {BOTTOM_TABS.map((tab) => {
            const active = location.pathname === tab.path;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                to={tab.path}
                onClick={(e) => {
                  if (active) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-gray-100 ${active ? 'text-[#2563EB]' : 'text-gray-500'}`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Icon className={`w-[22px] h-[22px] transition-transform ${active ? 'scale-110' : ''}`} />
                <span className={`text-[10px] font-semibold tracking-tight ${active ? 'text-[#2563EB]' : 'text-gray-500'}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
          {/* Botão "Mais" — abre o drawer (igual ao AppLayout) */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-500 active:bg-gray-100 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <MoreHorizontal className="w-[22px] h-[22px]" />
            <span className="text-[10px] font-semibold tracking-tight">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}