// Navbar fixa dark premium com blur. Aparece com mais opacidade ao rolar.
// Suporte a navegação suave para âncoras tanto no modo padrão quanto lançamento,
// menu mobile integrado e sem elementos <button> aninhados dentro de <a>.
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import GlowButton from './GlowButton';
import BrandMark from '@/components/BrandMark';
import PWAInstallButton from '@/components/PWAInstallButton';

const NAV_ITEMS = [
  { label: 'Plataforma', id: 'beneficios', fallbacks: ['beneficios', 'problemas', 'solucao'] },
  { label: 'IA & Retenção', id: 'ia', fallbacks: ['ia', 'solucao'] },
  { label: 'Recorrência', id: 'recorrencia', fallbacks: ['recorrencia', 'beneficios'] },
  { label: 'Resultados', id: 'resultados', fallbacks: ['resultados', 'social-proof'] },
  { label: 'Preços', id: 'precos', fallbacks: ['precos', 'oferta'] },
];

export default function PremiumNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fecha menu mobile ao trocar rota
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogoClick = (e) => {
    e.preventDefault();
    setMobileOpen(false);
    if (location.pathname === '/landing' || location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/landing');
    }
  };

  const handleNavClick = (e, item) => {
    e.preventDefault();
    setMobileOpen(false);

    const isLanding = location.pathname === '/landing' || location.pathname === '/' || location.pathname === '/lancamento';
    if (!isLanding) {
      navigate(`/landing#${item.id}`);
      return;
    }

    const targets = [item.id, ...(item.fallbacks || [])];
    for (const targetId of targets) {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.location.hash = item.id;
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || mobileOpen
            ? 'bg-[#050816]/95 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/40'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between gap-2">
          {/* Logo interativo */}
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center cursor-pointer bg-transparent border-0 p-0 text-left outline-none"
            aria-label="Ir para o topo da página inicial"
          >
            <BrandMark size={36} tone="dark" />
          </button>

          {/* Links desktop */}
          <div className="hidden lg:flex items-center gap-7 text-sm font-medium text-white/70">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleNavClick(e, item)}
                className="hover:text-white transition-colors cursor-pointer"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Ações da direita */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <PWAInstallButton className="hidden sm:inline-flex" />

            <Link
              to="/demo/dashboard"
              className="hidden md:inline-flex h-9 px-3.5 rounded-xl text-xs sm:text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors items-center cursor-pointer"
            >
              Demo
            </Link>

            <Link
              to="/login"
              className="inline-flex h-9 px-3.5 rounded-xl text-xs sm:text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-colors items-center cursor-pointer"
            >
              Entrar
            </Link>

            <GlowButton
              to="/checkout"
              className="h-9 px-3.5 sm:px-4 text-[12px] sm:text-xs font-bold whitespace-nowrap"
            >
              Começar agora
            </GlowButton>

            {/* Botão menu mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border border-white/10 ml-1"
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu de navegação'}
            >
              {mobileOpen ? <X className="w-5 h-5" strokeWidth={1.75} /> : <Menu className="w-5 h-5" strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {/* Dropdown mobile */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-white/10 bg-[#070B18]/95 backdrop-blur-2xl px-5 py-5 space-y-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
              Navegação
            </div>
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleNavClick(e, item)}
                  className="block py-2 text-sm font-semibold text-white/85 hover:text-white transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <Link
                to="/demo/dashboard"
                onClick={() => setMobileOpen(false)}
                className="w-full py-2.5 px-3 rounded-xl text-center text-xs font-bold text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                Ver demonstração ao vivo
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="w-full py-2.5 px-3 rounded-xl text-center text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-colors"
              >
                Entrar na minha conta
              </Link>
              <GlowButton
                to="/checkout"
                onClick={() => setMobileOpen(false)}
                className="w-full h-11 text-xs font-bold justify-center mt-1"
              >
                Começar agora — 7 dias grátis
              </GlowButton>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}