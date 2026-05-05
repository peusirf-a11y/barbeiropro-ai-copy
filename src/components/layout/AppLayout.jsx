import { Link, useLocation, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Calendar, Users, Briefcase, DollarSign, BarChart2, Zap, Settings, UserCheck, LayoutDashboard, LogOut, Menu, X, MessageSquare, CreditCard, Lock, Wallet, Package, Percent, Star, Scissors, Gift, Repeat } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BrandMark from '@/components/BrandMark';
import NavList from '@/components/layout/NavList';
import ImpersonationBanner from '@/components/master/ImpersonationBanner';
import BillingPastDueBanner from '@/components/billing/BillingPastDueBanner';
import { useTeamRole } from '@/lib/useTeamRole';
import { useCompany } from '@/hooks/useCompany';
import { isPastDueLimited } from '@/lib/billingMode';
import UnitSwitcher from '@/components/units/UnitSwitcher';

// key = identificador no rolePermissions; default visível para todos os papéis com acesso à rota
const navItemsAll = [
  { key: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard, path: '/app/dashboard' },
  { key: 'agenda',        label: 'Agenda',        icon: Calendar,        path: '/app/agenda' },
  { key: 'bloqueios',     label: 'Bloqueios',     icon: Lock,            path: '/app/bloqueios' },
  { key: 'clientes',      label: 'Clientes',      icon: Users,           path: '/app/clientes' },
  { key: 'servicos',      label: 'Serviços',      icon: Briefcase,       path: '/app/servicos' },
  { key: 'combos',        label: 'Combos',        icon: Package,         path: '/app/combos' },
  { key: 'planos',        label: 'Planos',        icon: Repeat,          path: '/app/planos', badge: 'NOVO' },
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
  const { data: teamRole, isLoading: loadingRole } = useTeamRole();
  const { company } = useCompany();
  const showPastDue = isPastDueLimited(company);

  // Auto-trigger do backfill: roda 1x quando o owner abre o app pós-deploy.
  // O backend é idempotente (Company.units_backfilled_at).
  useEffect(() => {
    if (!company?.id) return;
    if (company.units_backfilled_at) return;
    if (company.owner_email && teamRole?.role && teamRole.role !== 'admin') return; // só owner/admin dispara
    base44.functions.invoke('backfillUnits', {}).catch(err => {
      console.warn('[AppLayout] backfillUnits falhou (pode ser ignorado):', err?.message);
    });
  }, [company?.id, company?.units_backfilled_at, teamRole?.role]);

  // Fechar drawer ao trocar de rota
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // 🔒 Bloqueio rígido: NÃO renderizar nada até saber o role.
  // Evita flash de menu completo antes do RBAC carregar.
  if (loadingRole) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  // Filtra menu por papel. Sem teamRole (super_admin/owner antigo) → mostra tudo.
  const allowed = teamRole?.role && ROLE_PERMISSIONS[teamRole.role]
    ? ROLE_PERMISSIONS[teamRole.role]
    : null;
  const navItems = allowed && !allowed.includes('*')
    ? navItemsAll.filter(i => allowed.includes(i.key))
    : navItemsAll;

  // 🔒 Proteção extra contra acesso direto via URL — se a rota atual exigir uma key
  // que o papel não possui, redireciona para o dashboard.
  // (RoleRoute já protege, mas isso garante mesmo se alguém esquecer de envolver uma rota nova.)
  if (allowed && !allowed.includes('*')) {
    const current = navItemsAll.find(i => location.pathname.startsWith(i.path));
    if (current && !allowed.includes(current.key) && location.pathname !== '/app/dashboard') {
      return <Navigate to="/app/dashboard" replace />;
    }
  }

  const SidebarContent = (
    <>
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <Link to="/app/dashboard" className="group min-w-0 transition-transform group-hover:scale-[1.02]">
          <BrandMark size={44} tone="dark" subtitle="Painel de gestão" />
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

      <div className="px-3 py-4 border-t border-white/5">
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 text-sm text-gray-400 hover:text-red-400 transition-colors w-full px-3 py-2.5 rounded-xl hover:bg-red-500/10 font-medium"
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
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5 h-14 flex items-center justify-between px-4 gap-2">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/app/dashboard" className="min-w-0">
          <BrandMark size={30} tone="light" />
        </Link>
        <div className="ml-auto"><UnitSwitcher /></div>
      </header>

      {/* Desktop sidebar — DARK */}
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

      {/* Desktop top header — saudação + avatar */}
      <header className="hidden lg:flex lg:ml-64 sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5 h-16 items-center justify-end px-8 gap-3">
        <UnitSwitcher />
        <div className="text-right">
          <div className="text-[11px] text-gray-400 leading-none">Olá,</div>
          <div className="text-sm font-bold text-[#0F172A] mt-0.5">{company?.owner_name?.split(' ')[0] || 'Bem-vindo'}</div>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
          {(company?.owner_name?.[0] || company?.name?.[0] || 'B').toUpperCase()}
        </div>
      </header>

      {/* Main content */}
      <main className="lg:ml-64 min-h-[calc(100vh-4rem)] animate-fade-in">
        <ImpersonationBanner />
        {showPastDue && <BillingPastDueBanner />}
        {children}
      </main>
    </div>
  );
}