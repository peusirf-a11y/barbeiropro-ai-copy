// Componente oficial de Rodapé (Footer.jsx) — O CORTE (https://ocorte.app)
// Design mobile-first, semântico, acessível e harmonizado com a paleta dark moderna.
import { Link } from 'react-router-dom';
import { Mail, Globe, ShieldCheck, ExternalLink } from 'lucide-react';
import BrandMark from '@/components/BrandMark';

export default function Footer() {
  return (
    <footer
      role="contentinfo"
      aria-label="Rodapé institucional O CORTE"
      className="relative border-t border-white/10 bg-[#040611] text-white pt-14 pb-10 px-4 sm:px-6 lg:px-8 footer-dark font-inter"
    >
      {/* Proteção de contraste caso a página pai tenha classe .light */}
      <style>{`
        .footer-dark { border-color: rgba(255,255,255,0.10) !important; }
        .footer-dark .footer-body { color: rgba(255,255,255,0.65) !important; }
        .footer-dark .footer-label { color: rgba(255,255,255,0.50) !important; }
        .footer-dark .footer-link { color: rgba(255,255,255,0.82) !important; transition: color .15s ease; }
        .footer-dark .footer-link:hover { color: #ffffff !important; }
        .footer-dark .footer-divider { border-color: rgba(255,255,255,0.10) !important; }
        .footer-dark .footer-meta { color: rgba(255,255,255,0.55) !important; }
      `}</style>

      {/* Linha luminosa superior */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[#60A5FA]/45 to-transparent"
      />

      <div className="max-w-7xl mx-auto">
        {/* Grid Principal: 4 Colunas Responsivas (Mobile-First) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 pb-12">
          {/* Coluna 1: Marca & Proposta de Valor */}
          <div className="lg:col-span-4 space-y-4">
            <Link to="/landing" aria-label="Ir para a página inicial do O CORTE" className="inline-block">
              <BrandMark size={36} tone="dark" />
            </Link>
            <p className="text-sm leading-relaxed footer-body max-w-sm">
              A plataforma definitiva de gestão, agendamento inteligente, clubes de assinatura e crescimento recorrente para barbearias modernas.
            </p>
            <div className="inline-flex items-center gap-2 text-xs text-[#93C5FD] bg-[#2563EB]/15 border border-[#60A5FA]/25 px-3 py-1.5 rounded-full">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <a
                href="https://ocorte.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:underline"
              >
                ocorte.app
              </a>
            </div>
          </div>

          {/* Coluna 2: Navegação Rápida */}
          <nav aria-label="Navegação rápida" className="lg:col-span-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider mb-4 footer-label">
              Navegação
            </h2>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="/landing#beneficios" className="footer-link">
                  Recursos
                </a>
              </li>
              <li>
                <Link to="/checkout" className="footer-link">
                  Planos
                </Link>
              </li>
              <li>
                <Link to="/login" className="footer-link">
                  Entrar
                </Link>
              </li>
              <li>
                <Link to="/parceiros" className="footer-link">
                  Programa de Parceiros
                </Link>
              </li>
            </ul>
          </nav>

          {/* Coluna 3: Institucional & Legal */}
          <nav aria-label="Links legais e privacidade" className="lg:col-span-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider mb-4 footer-label">
              Legal & Conformidade
            </h2>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/privacidade" className="footer-link inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                  <span>Política de Privacidade</span>
                </Link>
              </li>
              <li>
                <Link to="/termos" className="footer-link">
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </nav>

          {/* Coluna 4: Canal Oficial de Contato & Suporte */}
          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider footer-label">
              Atendimento & LGPD
            </h2>
            <p className="text-xs leading-relaxed footer-body">
              Precisa de suporte técnico, ajuda com sua assinatura ou deseja exercer seus direitos de titular de dados?
            </p>
            <a
              href="mailto:suporte@ocorte.app"
              aria-label="Enviar e-mail para suporte@ocorte.app"
              className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#60A5FA]/40 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#2563EB]/20 border border-[#60A5FA]/30 flex items-center justify-center text-[#93C5FD] flex-shrink-0">
                  <Mail className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-white/45">
                    E-mail Oficial
                  </span>
                  <span className="block text-xs sm:text-sm font-bold text-white group-hover:text-[#93C5FD] truncate transition-colors">
                    suporte@ocorte.app
                  </span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-white/35 group-hover:text-[#93C5FD] flex-shrink-0 transition-colors" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Linha Inferior: Copyright 2026 & Domínio Oficial */}
        <div className="pt-7 border-t footer-divider flex flex-col sm:flex-row items-center justify-between gap-4 text-xs footer-meta">
          <p>© 2026 O CORTE. Todos os direitos reservados.</p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <a
              href="https://ocorte.app"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link font-medium"
            >
              https://ocorte.app
            </a>
            <span className="hidden sm:inline text-white/20" aria-hidden="true">•</span>
            <a href="mailto:suporte@ocorte.app" className="footer-link font-medium">
              suporte@ocorte.app
            </a>
            <span className="hidden sm:inline text-white/20" aria-hidden="true">•</span>
            <div className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span>Sistemas operacionais</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
