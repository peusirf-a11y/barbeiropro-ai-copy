import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Calendar, Users, Briefcase, DollarSign, BarChart2, Zap, Settings, UserCheck, LayoutDashboard, LogOut, Menu, X, MessageSquare, CreditCard, Lock, Wallet, Package, Percent, Star, Scissors, Gift } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Logo from '@/components/Logo';
import NavList from '@/components/layout/NavList';
import ImpersonationBanner from '@/components/master/ImpersonationBanner';
import BillingPastDueBanner from '@/components/billing/BillingPastDueBanner';
import { useTeamRole } from '@/lib/useTeamRole';
import { useCompany } from '@/hooks/useCompany';
import { isPastDueLimited } from '@/lib/billingMode';

// key = identificador no rolePermissions; default visível para todos os papéis com acesso à rota
const navItemsAll = [
  { key: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard, path: '/app/dashboard' },
  { key: 'agenda',        label: 'Agenda',        icon: Calendar,        path: '/app/agenda' },
  { key: 'bloqueios',     label: 'Bloqueios',     icon: Lock,            path: '/app/bloqueios' },
  { key: 'clientes',      label: 'Clientes',      icon: Users,           path: '/app/clientes' },
  { key: 'servicos',      label: 'Serviços',      icon: Briefcase,       path: '/app/servicos' },
  { key: 'combos',        label: 'Combos',        icon: Package,         path: '/app/combos' },
  { key: 'profissionais', label: 'Profissionais', icon: Scissors,        path: '/app/profissionais' },
  { key: 'caixa',         label: 'Caixa',         icon: Wallet,          path: '/app/caixa' },
  { key: 'financeiro',    label: 'Financeiro',    icon: DollarSign,      path: '/app/financeiro' },
  { key: 'comissoes',     label: 'Comissões',     icon: Percent,         path: '/app/comissoes' },
  { key: 'relatorios',    label: 'Relatórios',    icon: BarChart2,       path: '/app/relatorios' },
  { key: 'ai-growth',     label: 'AI Growth',     icon: Zap,             path: '/app/ai-growth', badge: 'AI' },
  { key: 'retencao',      label: 'Retenção',      icon: MessageSquare,   path: '/app/retencao' },
  { key: 'avaliacoes',    label: 'Avaliações',    icon: Star,            path: '/app/avaliacoes' },
  { key: 'indicacoes',    label: 'Indique e ganhe',icon: Gift,           path: '/app/indicacoes' },
  { key: 'equipe',        label: 'Equipe',        icon: UserCheck,       path: '/app/equipe' },
  { key: 'assinatura',    label: 'Assinatura',    icon: CreditCard,      path: '/app/configuracoes/assinatura' },
  { key: 'configuracoes', label: 'Configurações', icon: Settings,        path: '/app/configuracoes' },
];

import { ROLE_PERMISSIONS } from '@/lib/rolePermissions';

export default function AppLayout({ children }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { data: teamRole } = useTeamRole();
  const { company } = useCompany();
  const showPastDue = isPastDueLimited(company);

  // Filtra menu por papel. Sem papel definido (loading/super_admin/owner antigo) → mostra tudo.
  const allowed = teamRole?.role && ROLE_PERMISSIONS[teamRole.role]
    ? ROLE_PERMISSIONS[teamRole.role]
    : null;
  const navItems = allowed && !allowed.includes('*')
    ? navItemsAll.filter(i => allowed.includes(i.key))
    : navItemsAll;

  // Fechar drawer ao trocar de rota
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const SidebarContent = (
    <>
      <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
        <Link to="/app/dashboard" className="flex items-center gap-3 group min-w-0">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center overflow-hidden shadow-[var(--shadow-sm)] transition-transform group-hover:scale-105 flex-shrink-0">
            <Logo size={40} className="rounded-none" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[15px] text-[#0F172A] tracking-tight truncate">BarberTrimly</div>
            <div className="text-[11px] text-gray-400 font-medium">Painel de gestão</div>
          </div>
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <NavList items={navItems} />

      <div className="px-3 py-4 border-t border-black/5">
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 text-sm text-gray-500 hover:text-red-500 transition-colors w-full px-3 py-2.5 rounded-xl hover:bg-red-50 font-medium"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sair
        </button>
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
        <Link to="/app/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center overflow-hidden">
            <Logo size={32} className="rounded-none" />
          </div>
          <span className="font-bold text-[15px] text-[#0F172A] tracking-tight">BarberTrimly</span>
        </Link>
        <div className="w-9" />
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-white border-r border-black/5 flex-col fixed h-screen overflow-hidden z-40">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-[82%] max-w-[300px] bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {SidebarContent}
        </aside>
      </div>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen animate-fade-in">
        <ImpersonationBanner />
        {showPastDue && <BillingPastDueBanner />}
        {children}
      </main>
    </div>
  );
}