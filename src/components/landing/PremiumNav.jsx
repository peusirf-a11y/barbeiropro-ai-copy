// Navbar fixa dark premium com blur. Aparece com mais opacidade ao rolar.
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import GlowButton from './GlowButton';
import BrandMark from '@/components/BrandMark';

export default function PremiumNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#050816]/80 backdrop-blur-xl border-b border-white/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <BrandMark size={36} tone="dark" />
        </Link>
        <div className="hidden md:flex items-center gap-9 text-sm font-medium text-white/65">
          <a href="#beneficios" className="hover:text-white transition-colors">Plataforma</a>
          <a href="#ia" className="hover:text-white transition-colors">IA</a>
          <a href="#recorrencia" className="hover:text-white transition-colors">Recorrência</a>
          <a href="#resultados" className="hover:text-white transition-colors">Resultados</a>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/demo/dashboard" className="hidden sm:block">
            <button className="h-10 px-4 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors">
              Demo
            </button>
          </Link>
          <Link to="/entrar">
            <button className="h-10 px-4 rounded-lg text-sm font-semibold text-white/90 hover:text-white border border-white/15 hover:border-white/30 hover:bg-white/5 transition-colors">
              Entrar
            </button>
          </Link>
          <Link to="/checkout">
            <GlowButton className="h-10 px-5 text-[13px]">Começar agora</GlowButton>
          </Link>
        </div>
      </div>
    </nav>
  );
}