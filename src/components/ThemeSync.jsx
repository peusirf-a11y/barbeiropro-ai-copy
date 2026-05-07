// ThemeSync — aplica/remove a classe `dark` no <html> com base em
// `prefers-color-scheme`. Renderizado uma única vez no topo da App.
// Não tem UI; apenas efeitos colaterais.

import { useEffect } from 'react';

export default function ThemeSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (isDark) => {
      const root = document.documentElement;
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    apply(mql.matches);

    const onChange = (e) => apply(e.matches);
    // Compatível com browsers antigos
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return null;
}