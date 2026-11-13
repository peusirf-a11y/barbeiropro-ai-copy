// Bottom tab navigation para mobile (Android WebView-friendly).
// 4 abas principais + "Mais" que abre o drawer existente do AppLayout.
// - Re-clicar a aba ativa scrolla para o topo (reset da rota).
// - Safe-area-inset aplicado para devices com gestures bar / notch.
// - user-select: none para evitar highlight acidental ao tocar.
// - Adaptado para o papel de barbeiro (Dashboard, Agenda, Clientes, Comissões).

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Wallet, Percent, MoreHorizontal } from 'lucide-react';

const TABS_OWNER = [
  { key: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard, path: '/app/dashboard' },
  { key: 'agenda',     label: 'Agenda',     icon: Calendar,        path: '/app/agenda' },
  { key: 'clientes',   label: 'Clientes',   icon: Users,           path: '/app/clientes' },
  { key: 'caixa',      label: 'Caixa',      icon: Wallet,          path: '/app/caixa' },
];

const TABS_BARBEIRO = [
  { key: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard, path: '/app/dashboard' },
  { key: 'agenda',     label: 'Agenda',     icon: Calendar,        path: '/app/agenda' },
  { key: 'clientes',   label: 'Clientes',   icon: Users,           path: '/app/clientes' },
  { key: 'comissoes',  label: 'Comissões',  icon: Percent,         path: '/app/comissoes' },
];

export default function MobileBottomTabs({ allowedKeys, isBarbeiro, onOpenMore }) {
  const location = useLocation();
  const navigate = useNavigate();

  const tabsBase = isBarbeiro ? TABS_BARBEIRO : TABS_OWNER;

  // Filtra abas pelo papel; se nada permitido, mantém Agenda como fallback
  const visibleTabs = allowedKeys && !allowedKeys.includes('*')
    ? tabsBase.filter(t => allowedKeys.includes(t.key))
    : tabsBase;

  const handleTabClick = (e, tab) => {
    e.preventDefault();
    const onExactRoot = location.pathname === tab.path;
    const onSubRoute = location.pathname.startsWith(tab.path + '/');
    if (onExactRoot) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (onSubRoute) {
      navigate(tab.path);
    } else {
      navigate(tab.path);
    }
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#171827]/95 backdrop-blur-xl border-t border-[#232538] select-none shadow-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-[58px]">
        {visibleTabs.map((tab) => {
          const active = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              to={tab.path}
              onClick={(e) => handleTabClick(e, tab)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                active ? 'text-[#B5D7E8]' : 'text-[#8F9BBF] hover:text-white'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Icon
                className={`w-[20px] h-[20px] transition-transform ${active ? 'scale-105 text-[#B5D7E8]' : ''}`}
                strokeWidth={1.75}
              />
              <span className={`text-[10px] font-bold tracking-tight ${active ? 'text-[#B5D7E8]' : 'text-[#8F9BBF]'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
        {/* Aba Mais — abre o drawer lateral */}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[#8F9BBF] hover:text-white active:bg-white/5 transition-colors cursor-pointer"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <MoreHorizontal className="w-[20px] h-[20px]" strokeWidth={1.75} />
          <span className="text-[10px] font-bold tracking-tight">Mais</span>
        </button>
      </div>
    </nav>
  );
}