import { useEffect, useState } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, Settings, LogOut, Gift, Menu, X } from 'lucide-react';
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
  const { partner, isLoading, logout } = useCurrentPartner();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Fecha drawer ao trocar de rota
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // ESC fecha + trava scroll do body
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!isLoading && !partner) {
    return <Navigate to="/parceiro/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F1F2F7] dark:bg-[#0F101A] text-[#171827] dark:text-[#E5E7F3] font-inter">
      <AppBackgroundLayer />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#171827] border-b border-[#232538] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setOpen(true)}
              className="p-2 rounded-lg hover:bg-white/[0.08] text-white/80 hover:text-white transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <Link to="/parceiro/dashboard" className="flex items-center gap-3 min-w-0">
              <BrandMark size={32} tone="dark" />
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2563EB]/20 border border-[#2563EB]/40 text-[11px] font-bold text-[#B5D7E8]">
                <Gift className="w-3 h-3 text-[#B5D7E8]" strokeWidth={1.75} /> PARCEIRO
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {partner && (
              <div className="hidden sm:block text-right">
                <div className="text-[11px] text-[#59658F] dark:text-white/50 leading-none">Olá,</div>
                <div className="text-sm font-bold text-white mt-0.5">{partner.name?.split(' ')[0]}</div>
              </div>
            )}
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-rose-400 transition-colors"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer lateral (menu hambúrguer) */}
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px] animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[82%] max-w-[300px] bg-[#171827] border-r border-[#232538] shadow-[0_30px_80px_rgba(0,0,0,0.7)] flex flex-col animate-slide-up sm:animate-fade-in text-white">
            <div className="px-4 h-16 flex items-center justify-between border-b border-[#232538] flex-shrink-0">
              <BrandMark size={32} tone="dark" />
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {partner && (
              <div className="px-4 py-3 border-b border-[#232538] bg-white/[0.02]">
                <div className="text-[11px] text-[#59658F] dark:text-white/50">Conectado como</div>
                <div className="text-sm font-bold text-white truncate">{partner.name}</div>
                <div className="text-[11px] text-white/60 truncate">{partner.email}</div>
              </div>
            )}

            <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1">
              {NAV.map(item => {
                const active = location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? 'bg-[#2563EB] text-white shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-[#232538]">
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-rose-300 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.75} /> Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-10">{children}</main>
    </div>
  );
}