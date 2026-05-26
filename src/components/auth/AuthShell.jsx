// AuthShell — Layout premium reutilizado por todas as telas de auth pr\u00f3pria O CORTE.
//
// Visual branco gelo + card centralizado. Sem aparência Base44.

import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

export default function AuthShell({ children, footer = true }) {
  return (
    <div className="min-h-screen bg-[#F4F7FB] font-inter flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm border-b border-black/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/landing"><Logo size={32} /></Link>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Acesso seguro</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md animate-fade-in-up">{children}</div>
      </main>

      {footer && (
        <footer className="py-6 text-center text-[11px] text-gray-400">
          \u00a9 O CORTE \u00b7 <Link to="/termos-de-uso" className="hover:text-[#2563EB] underline">Termos</Link> \u00b7 <Link to="/politica-de-privacidade" className="hover:text-[#2563EB] underline">Privacidade</Link>
        </footer>
      )}
    </div>
  );
}