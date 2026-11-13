// MasterLayout.jsx — Shell Executivo do Super Admin (Design System BI + Premium Business SaaS)
// Header / Topbar: #171827 | Background: #F1F2F7 | Animações suaves via Framer Motion | Lucide Icons strokeWidth=1.75
import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  DollarSign,
  Users,
  Settings,
  Menu,
  X,
  LogOut,
  Shield,
  Layers,
  Activity,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  Gift,
  ChevronRight,
} from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/lib/AuthContext';
import ImpersonationCountdown from '@/components/security/ImpersonationCountdown';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/master/dashboard' },
  { label: 'Barbearias', icon: Building2, path: '/master/barbearias' },
  { label: 'Funcionalidades', icon: Layers, path: '/master/funcionalidades' },
  { label: 'Assinaturas', icon: CreditCard, path: '/master/assinaturas' },
  { label: 'Financeiro', icon: DollarSign, path: '/master/financeiro' },
  { label: 'Usuários', icon: Users, path: '/master/usuarios' },
  { label: 'Parceiros', icon: Gift, path: '/master/partners', badge: 'PRO' },
  { label: 'Auditoria', icon: Activity, path: '/master/auditoria' },
  { label: 'LGPD', icon: Lock, path: '/master/lgpd' },
  { label: 'Compliance', icon: ShieldCheck, path: '/master/compliance', badge: 'BI' },
  { label: 'Segurança', icon: ShieldAlert, path: '/master/security' },
  { label: 'Observabilidade', icon: Gauge, path: '/master/observability', badge: 'LIVE' },
  { label: 'Configurações', icon: Settings, path: '/master/configuracoes' },
];

export default function MasterLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { isImpersonating } = useImpersonationContext();

  // Fecha o drawer mobile ao navegar
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Lock body scroll quando drawer estiver aberto no mobile
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const activeNav = navItems.find((i) => location.pathname.startsWith(i.path));
  const pageTitle = activeNav?.label || 'Super Admin';

  const SidebarBody = (
    <div className="flex flex-col h-full bg-[#171827] text-white select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <Link to="/master/dashboard" className="flex items-center gap-2.5 min-w-0 group">
          <Logo size={36} className="flex-shrink-0 transition-transform group-hover:scale-105" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white leading-none">O CORTE</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#59658F]/30 text-[#B5D7E8] border border-[#59658F]/40 leading-none">
                ENTERPRISE
              </span>
            </div>
            <p className="text-[11px] text-[#59658F] font-medium truncate mt-0.5 flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#B5D7E8]" strokeWidth={1.75} /> Gestão Corporativa
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="relative z-10 lg:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors touch-manipulation cursor-pointer"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5 pointer-events-none" strokeWidth={1.75} />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#59658F]">
          Módulos Centrais
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white shadow-sm shadow-[#2563EB]/30'
                  : 'text-[#B4B9CE] hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                  isActive ? 'text-white' : 'text-[#7E8BAF] group-hover:text-white'
                }`}
                strokeWidth={1.75}
              />
              <span className="truncate flex-1 tracking-tight">{item.label}</span>

              {item.badge && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none tracking-wider ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[#59658F]/25 text-[#B5D7E8] border border-[#59658F]/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}

              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / User Profile & Logout */}
      <div className="p-3 border-t border-white/10 bg-[#131422] flex-shrink-0">
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <Shield className="w-4 h-4 text-[#B5D7E8]" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate leading-tight">
                {user?.name || user?.email?.split('@')[0] || 'Super Admin'}
              </div>
              <div className="text-[10px] text-[#7E8BAF] font-mono truncate leading-none mt-0.5">
                Nível Master 0
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#B4B9CE] hover:text-red-300 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20 touch-manipulation cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-red-400 pointer-events-none" strokeWidth={1.75} />
          <span className="pointer-events-none">Encerrar Sessão</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen bg-[#F1F2F7] dark:bg-[#0F101A] text-[#55596A] dark:text-[#E5E7F3] font-sans overflow-x-clip w-full max-w-[100vw] ${
        isImpersonating ? 'pt-9' : ''
      }`}
    >
      <ImpersonationCountdown />

      {/* Mobile Topbar — Executive #171827 */}
      <header
        className={`lg:hidden sticky ${
          isImpersonating ? 'top-9' : 'top-0'
        } z-40 bg-[#171827] text-white border-b border-white/10 h-14 flex items-center justify-between px-4 gap-3 shadow-md`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative z-10 p-1.5 -ml-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors touch-manipulation cursor-pointer"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5 pointer-events-none" strokeWidth={1.75} />
          </button>
          <Logo variant="icon-dark" size={26} className="flex-shrink-0" />
          <span className="font-bold text-sm tracking-tight text-white truncate">{pageTitle}</span>
        </div>

        <div className="relative z-10 flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#59658F]/30 text-[#B5D7E8] border border-[#59658F]/40">
            BI
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex w-64 min-h-screen border-r border-[#E5E7EF] dark:border-[#232538] flex-col fixed h-screen overflow-hidden z-40">
        {SidebarBody}
      </aside>

      {/* Mobile Animated Drawer via Framer Motion */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="mobile-drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="lg:hidden fixed inset-0 z-50 pointer-events-auto"
          >
            {/* Backdrop */}
            <div
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide-in Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute left-0 top-0 bottom-0 w-[84%] max-w-[320px] shadow-2xl z-10 overflow-hidden"
            >
              {SidebarBody}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Executive Header (#171827) */}
      <header
        className={`hidden lg:flex lg:ml-64 sticky ${
          isImpersonating ? 'top-9' : 'top-0'
        } z-40 bg-[#171827] text-white border-b border-white/10 h-16 items-center justify-between px-8 gap-4 shadow-sm`}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-[#7E8BAF]">
              <span>Ecossistema Corporativo</span>
              <ChevronRight className="w-3 h-3 text-[#59658F]" strokeWidth={1.75} />
              <span className="text-[#B5D7E8]">Centro de Controle BI</span>
            </div>
            <h1 className="text-base font-extrabold text-white tracking-tight mt-0.5 flex items-center gap-2">
              <span>{pageTitle}</span>
              {activeNav?.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#59658F]/40 text-[#B5D7E8] border border-[#59658F]/50">
                  {activeNav.badge}
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/80 font-medium">Cluster Operacional Normal</span>
          </div>

          <ThemeToggle />

          <div className="h-5 w-px bg-white/10 mx-1" />

          {/* Super Admin Avatar Badge */}
          <div className="flex items-center gap-2.5 pl-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white shadow-sm ring-1 ring-white/20">
              <Shield className="w-4 h-4 text-[#B5D7E8]" strokeWidth={1.75} />
            </div>
            <div className="hidden sm:block text-left leading-none">
              <div className="text-xs font-bold text-white tracking-tight">Super Admin</div>
              <div className="text-[10px] text-[#7E8BAF] mt-1 font-mono">auditoria ativa</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 lg:ml-64 min-h-[calc(100vh-4rem)] min-w-0">
        <motion.div
          key={location.pathname}
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 min-w-0"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}