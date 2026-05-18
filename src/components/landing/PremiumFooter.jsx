// Footer premium dark com colunas e linha gradiente no topo.
import { Link } from 'react-router-dom';
import BrandMark from '@/components/BrandMark';

export default function PremiumFooter() {
  return (
    <footer className="relative border-t border-white/5 bg-[#040611] pt-16 pb-10 px-5 md:px-8">
      {/* Linha gradient topo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[#60A5FA]/40 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div>
            <BrandMark size={36} tone="dark" />
            <p className="text-white/45 text-sm mt-4 leading-relaxed">
              Plataforma com IA para barbearias premium escalarem com recorrência.
            </p>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-4">Plataforma</div>
            <ul className="space-y-2.5 text-sm text-white/65">
              <li><a href="#beneficios" className="hover:text-white transition-colors">Recursos</a></li>
              <li><a href="#ia" className="hover:text-white transition-colors">IA</a></li>
              <li><a href="#recorrencia" className="hover:text-white transition-colors">Recorrência</a></li>
              <li><Link to="/demo/dashboard" className="hover:text-white transition-colors">Demo</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-4">Empresa</div>
            <ul className="space-y-2.5 text-sm text-white/65">
              <li><Link to="/checkout" className="hover:text-white transition-colors">Planos</Link></li>
              <li><a href="#resultados" className="hover:text-white transition-colors">Resultados</a></li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-4">Legal</div>
            <ul className="space-y-2.5 text-sm text-white/65">
              <li><Link to="/termos-de-uso" className="hover:text-white transition-colors">Termos de uso</Link></li>
              <li><Link to="/politica-de-privacidade" className="hover:text-white transition-colors">Privacidade</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs text-white/35">© 2026 O CORTE — Todos os direitos reservados.</div>
          <div className="flex items-center gap-2 text-xs text-white/35">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            Sistemas operacionais
          </div>
        </div>
      </div>
    </footer>
  );
}