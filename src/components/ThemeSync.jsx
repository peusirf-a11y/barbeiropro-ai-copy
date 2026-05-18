// ThemeSync — força tema DARK em todo o app (padrão visual premium global).
// Mantemos a classe `dark` no <html> para que utilitários dark: do Tailwind
// funcionem nos componentes shadcn que dependem dela.

import { useEffect } from 'react';

export default function ThemeSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.add('dark');
    // Atualiza meta theme-color para a status bar do mobile (Android/iOS)
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', '#050816');
  }, []);

  return null;
}