// Footer premium dark com colunas e linha gradiente no topo.
// Usa classes próprias (footer-*) com !important para escapar dos overrides
// globais do tema light em index.css (`.light .text-white/X → slate escuro`).
import { Link } from 'react-router-dom';
import BrandMark from '@/components/BrandMark';

export default function PremiumFooter() {
  return (
    <footer className="relative border-t bg-[#040611] pt-16 pb-10 px-5 md:px-8 footer-dark">
      <style>{`
        .footer-dark { border-color: rgba(255,255,255,0.10) !important; }
        .footer-dark .footer-body { color: rgba(255,255,255,0.65) !important; }
        .footer-dark .footer-label { color: rgba(255,255,255,0.55) !important; }
        .footer-dark .footer-link { color: rgba(255,255,255,0.85) !important; transition: color .15s ease; }
        .footer-dark .footer-link:hover { color: #ffffff !important; }
        .footer-dark .footer-divider { border-color: rgba(255,255,255,0.10) !important; }
        .footer-dark .footer-meta { color: rgba(255,255,255,0.55) !important; }
      `}</style>

      {/* Linha gradient topo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[#60A5FA]/40 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div>
            <BrandMark size={36} tone="dark" />
            <p className="text-sm mt-4 leading-relaxed footer-body">
              Plataforma com IA para barbearias premium escalarem com recorrência.
            </p>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-4 footer-label">Plataforma</div>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#beneficios" className="footer-link">Recursos</a></li>
              <li><a href="#ia" className="footer-link">IA</a></li>
              <li><a href="#recorrencia" className="footer-link">Recorrência</a></li>
              <li><Link to="/demo/dashboard" className="footer-link">Demo</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-4 footer-label">Empresa</div>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/checkout" className="footer-link">Planos</Link></li>
              <li><a href="#resultados" className="footer-link">Resultados</a></li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-4 footer-label">Legal</div>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/termos-de-uso" className="footer-link">Termos de uso</Link></li>
              <li><Link to="/politica-de-privacidade" className="footer-link">Privacidade</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t footer-divider flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs footer-meta">© 2026 O CORTE — Todos os direitos reservados.</div>
          <div className="flex items-center gap-2 text-xs footer-meta">
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