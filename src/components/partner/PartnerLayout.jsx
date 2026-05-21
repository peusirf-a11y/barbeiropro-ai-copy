import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, Settings, LogOut, Gift } from 'lucide-react';
import AppBackgroundLayer from '@/components/layout/AppBackgroundLayer';
import BrandMark from '@/components/BrandMark';
import { useCurrentPartner } from '@/hooks/usePartnerAuth';

const NAV = [
  { path: '/parceiro/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/parceiro/indicacoes', label: 'Indicações', icon: Users },
  { path: '/parceiro/comissoes', label: 'Comissões', icon: DollarSign },
  { path: '/parceiro/configuracoes', label: 'Configurações', icon: Settings },
];

export default function PartnerLayout({ children }) {
  const { partner, logout } = useCurrentPartner();
  const location = useLocation();

  return (
    <div className="min-h-screen text-white font-inter">
      <AppBackgroundLayer />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#050816]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/parceiro/dashboard" className="flex items-center gap-3">
            <BrandMark size={32} tone="dark" />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2563EB]/15 border border-[#60A5FA]/25 text-[11px] font-bold text-[#93C5FD]">
              <Gift className="w-3 h-3" /> PARCEIRO
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {partner && (
              <div className="hidden sm:block text-right">
                <div className="text-[11px] text-white/40 leading-none">Olá,</div>
                <div className="text-sm font-bold mt-0.5">{partner.name?.split(' ')[0]}</div>
              </div>
            )}
            <button onClick={logout} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-rose-400" aria-label="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto pb-2 -mt-1">
          {NAV.map(item => {
            const active = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white shadow-[0_8px_24px_rgba(37,99,235,0.4)]'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                }`}>
                <Icon className="w-4 h-4" />{item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-10">{children}</main>
    </div>
  );
}