import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  const { partner, logout } = useCurrentPartner();
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

  return (
    <div className="min-h-screen text-white font-inter">
      <AppBackgroundLayer />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#050816]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setOpen(true)}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-white/80 hover:text-white"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/parceiro/dashboard" className="flex items-center gap-3 min-w-0">
              <BrandMark size={32} tone="dark" />
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2563EB]/15 border border-[#60A5FA]/25 text-[11px] font-bold text-[#93C5FD]">
                <Gift className="w-3 h-3" /> PARCEIRO
              </span>
            </Link>
          </div>
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
      </header>

      {/* Drawer lateral (menu hambúrguer) */}
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px] animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[82%] max-w-[300px] bg-[#0A1124] border-r border-white/8 shadow-[0_30px_80px_rgba(0,0,0,0.7)] flex flex-col animate-slide-up sm:animate-fade-in">
            <div className="px-4 h-16 flex items-center justify-between border-b border-white/8 flex-shrink-0">
              <BrandMark size={32} tone="dark" />
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/70"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {partner && (
              <div className="px-4 py-3 border-b border-white/8">
                <div className="text-[11px] text-white/45">Conectado como</div>
                <div className="text-sm font-bold truncate">{partner.name}</div>
                <div className="text-[11px] text-white/55 truncate">{partner.email}</div>
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
                        ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white shadow-[0_8px_24px_rgba(37,99,235,0.4)]'
                        : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-white/8">
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-rose-300 hover:bg-rose-500/10"
              >
                <LogOut className="w-4 h-4" /> Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-10">{children}</main>
    </div>
  );
}