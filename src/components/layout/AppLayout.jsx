import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Calendar, Users, Briefcase, DollarSign, BarChart2, Zap, Settings, UserCheck, LayoutDashboard, LogOut, X, MessageSquare, CreditCard, Lock, Wallet, Package, Percent, Star, Scissors, Gift, Repeat, ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BrandMark from '@/components/BrandMark';
import NavList from '@/components/layout/NavList';
import MobileBottomTabs from '@/components/layout/MobileBottomTabs';
import ImpersonationBanner from '@/components/master/ImpersonationBanner';
import BillingPastDueBanner from '@/components/billing/BillingPastDueBanner';
import PageTransition from '@/components/layout/PageTransition';
import { useTeamRole } from '@/lib/useTeamRole';
import { useCompany } from '@/hooks/useCompany';
import { isPastDueLimited } from '@/lib/billingMode';
import UnitSwitcher from '@/components/units/UnitSwitcher';

// Rotas "principais" do mobile — quando estamos numa subrota fora dessa lista,
// o header mobile mostra um botão de Voltar em vez do logo.
const MAIN_MOBILE_ROUTES = new Set([
  '/app/dashboard',
  '/app/agenda',
  '/app/clientes',
  '/app/caixa',
]);

// Mapeia início do path → título mostrado no header mobile quando voltar
function getSubRouteTitle(pathname) {
  const map = [
    ['/app/configuracoes/unidades', 'Unidades'],
    ['/app/configuracoes/pagamentos', 'Pagamentos'],
    ['/app/configuracoes/assinatura', 'Assinatura'],
    ['/app/configuracoes', 'Configurações'],
    ['/app/bloqueios', 'Bloqueios'],
    ['/app/servicos', 'Serviços'],
    ['/app/combos', 'Combos'],
    ['/app/planos', 'Planos'],
    ['/app/profissionais', 'Profissionais'],
    ['/app/comissoes', 'Comissões'],
    ['/app/relatorios', 'Relatórios'],
    ['/app/ai-growth', 'AI Growth'],
    ['/app/crm', 'CRM & Retenção'],
    ['/app/retencao', 'CRM & Retenção'],
    ['/app/avaliacoes', 'Avaliações'],
    ['/app/indicacoes', 'Indique e ganhe'],
    ['/app/equipe', 'Equipe'],
    ['/app/assinatura-bloqueada', 'Assinatura'],
  ];
  for (const [prefix, title] of map) {
    if (pathname.startsWith(prefix)) return title;
  }
  return '';
}

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
  { key: 'crm',           label: 'CRM',           icon: MessageSquare,   path: '/app/crm' },
  { key: 'avaliacoes',    label: 'Avaliações',    icon: Star,            path: '/app/avaliacoes' },
  { key: 'indicacoes',    label: 'Indique e ganhe',icon: Gift,           path: '/app/indicacoes' },
  { key: 'equipe',        label: 'Equipe',        icon: UserCheck,       path: '/app/equipe' },
  { key: 'assinatura',    label: 'Assinatura',    icon: CreditCard,      path: '/app/configuracoes/assinatura' },
  { key: 'configuracoes', label: 'Configurações', icon: Settings,        path: '/app/configuracoes' },
];

import { ROLE_PERMISSIONS } from '@/lib/rolePermissions';
import { NAV_KEY_FEATURE_MAP, hasFeature } from '@/lib/featureGate';
import { useQuery } from '@tanstack/react-query';

export default function AppLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isSubRoute = !MAIN_MOBILE_ROUTES.has(location.pathname);
  const subRouteTitle = isSubRoute ? getSubRouteTitle(location.pathname) : '';
  const { data: teamRole, isLoading: loadingRole } = useTeamRole();
  const { company } = useCompany();
  const showPastDue = isPastDueLimited(company);

  // A5 — Auto-trigger do backfill com lock contra loop/disparos paralelos.
  //
  // Por que precisa de lock:
  //  - O useEffect roda em cada re-render que mude as deps. Sob StrictMode,
  //    re-renders rápidos por outras causas, ou falha silenciosa do backend,
  //    podiam disparar várias chamadas simultâneas.
  //  - Backend é idempotente, mas chamadas paralelas geram:
  //      - desperdício de credits/requests
  //      - log poluído ("Matriz já existe" warns)
  //      - mascaramento de erros reais (which call failed?)
  //
  // Lock strategy:
  //  - `backfillLock.current.inFlight`: bloqueia disparos enquanto uma chamada
  //    está em voo (mesmo componente, mesma instância).
  //  - `backfillLock.current.attempted`: marca que já tentamos nesta sessão.
  //    Se falhar, NÃO retry automático — evita loop. Owner pode reload p/ retry.
  const backfillLock = useRef({ inFlight: false, attempted: false });

  useEffect(() => {
    if (!company?.id) return;
    if (company.units_backfilled_at) return;
    if (company.owner_email && teamRole?.role && teamRole.role !== 'admin') return;
    if (backfillLock.current.inFlight || backfillLock.current.attempted) return;

    backfillLock.current.inFlight = true;
    backfillLock.current.attempted = true;
    base44.functions.invoke('backfillUnits', {})
      .catch(err => {
        console.warn('[AppLayout] backfillUnits falhou (sem retry auto):', err?.message);
      })
      .finally(() => {
        backfillLock.current.inFlight = false;
      });
  }, [company?.id, company?.units_backfilled_at, teamRole?.role]);

  // Fechar drawer ao trocar de rota
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Plano da empresa (para filtrar menu por feature). Não bloqueia render.
  // ⚠️ Hook deve vir ANTES de qualquer early return (rules-of-hooks).
  const { data: plan } = useQuery({
    queryKey: ['app-layout-plan', company?.plan_id],
    queryFn: () => base44.entities.Plan.get(company.plan_id),
    enabled: !!company?.plan_id,
    staleTime: 5 * 60_000,
  });

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
  const navItemsByRole = allowed && !allowed.includes('*')
    ? navItemsAll.filter(i => allowed.includes(i.key))
    : navItemsAll;

  // Filtra menu por feature: se a key do nav tem requisito de feature e a feature
  // não está liberada (override company > plano), esconde o item.
  const navItems = navItemsByRole.filter(item => {
    const requiredFeature = NAV_KEY_FEATURE_MAP[item.key];
    if (!requiredFeature) return true;
    return hasFeature(plan, company, requiredFeature);
  });

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
          <BrandMark size={42} tone="dark" subtitle="Painel de gestão" />
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
          aria-label="Sair da conta"
          className="flex items-center gap-3 text-sm text-gray-400 hover:text-red-400 transition-colors w-full px-3 py-2.5 rounded-xl hover:bg-red-500/10 font-medium"
        >
          <LogOut className="w-[18px] h-[18px]" aria-hidden="true" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F7F8FB] font-inter">
      {/* Mobile top bar — safe-area-inset-top para devices com notch */}
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
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/app/dashboard'))}
            className="flex items-center gap-1.5 -ml-2 px-2 py-2 rounded-lg active:bg-gray-100 text-[#0F172A] min-w-0"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="text-[15px] font-semibold truncate">
              {subRouteTitle || 'Voltar'}
            </span>
          </button>
        ) : (
          <Link to="/app/dashboard" className="min-w-0" aria-label="Ir para o dashboard">
            <BrandMark size={32} tone="light" />
          </Link>
        )}
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

      {/* Main content — espaço extra no mobile para a bottom tab bar (58px + safe-area).
          No desktop (lg+) a tab bar some, então não precisamos do padding inferior. */}
      <main className="lg:ml-64 min-h-[calc(100vh-4rem)] pb-[calc(58px+env(safe-area-inset-bottom,0px))] lg:pb-0">
        <ImpersonationBanner />
        {showPastDue && <BillingPastDueBanner />}
        <PageTransition>{children}</PageTransition>
      </main>

      {/* Bottom tab bar (mobile only) */}
      <MobileBottomTabs
        allowedKeys={allowed}
        onOpenMore={() => setOpen(true)}
      />
    </div>
  );
}