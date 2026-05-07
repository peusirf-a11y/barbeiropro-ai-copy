// Bottom tab navigation para mobile (Android WebView-friendly).
// 4 abas principais + "Mais" que abre o drawer existente do AppLayout.
// - Re-clicar a aba ativa scrolla para o topo (reset da rota).
// - Safe-area-inset aplicado para devices com gestures bar / notch.
// - user-select: none para evitar highlight acidental ao tocar.

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, Wallet, DollarSign, MoreHorizontal } from 'lucide-react';

const TABS = [
  { key: 'agenda',     label: 'Agenda',     icon: Calendar,    path: '/app/agenda' },
  { key: 'clientes',   label: 'Clientes',   icon: Users,       path: '/app/clientes' },
  { key: 'caixa',      label: 'Caixa',      icon: Wallet,      path: '/app/caixa' },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign,  path: '/app/financeiro' },
];

export default function MobileBottomTabs({ allowedKeys, onOpenMore }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Filtra abas pelo papel; se nada permitido, mantém Agenda como fallback
  const visibleTabs = allowedKeys && !allowedKeys.includes('*')
    ? TABS.filter(t => allowedKeys.includes(t.key))
    : TABS;

  const handleTabClick = (e, tab) => {
    // Re-clicar aba ativa → scrolla para o topo (reset visual da rota)
    if (location.pathname === tab.path) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(tab.path);
      e.preventDefault();
    }
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-black/10 select-none"
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
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-gray-100 ${
                active ? 'text-[#2563EB]' : 'text-gray-500'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Icon className={`w-[22px] h-[22px] transition-transform ${active ? 'scale-110' : ''}`} />
              <span className={`text-[10px] font-semibold tracking-tight ${active ? 'text-[#2563EB]' : 'text-gray-500'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
        {/* Aba Mais — abre o drawer com todas as outras rotas */}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-500 active:bg-gray-100 transition-colors"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <MoreHorizontal className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-semibold tracking-tight">Mais</span>
        </button>
      </div>
    </nav>
  );
}