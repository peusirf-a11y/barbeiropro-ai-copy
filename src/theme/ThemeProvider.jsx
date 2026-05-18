// ThemeProvider — fundação do sistema dual-theme premium.
//
// Responsabilidades:
//  - Mantém estado global do tema (dark | light | system).
//  - Aplica classe no <html> (Tailwind dark mode + tokens em :root.light).
//  - Persiste em localStorage ("ocorte_theme") + no User.preferred_theme (best-effort).
//  - Detecta preferência do SO via matchMedia.
//  - Sincroniza entre abas via storage event.
//  - Atualiza meta theme-color (status bar mobile).
//  - Anti-FOUC: o tema inicial é aplicado no <head> via script inline (ver index.html).
//
// Importante: NÃO força reload nem destroi sessões.

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'ocorte_theme';
const THEME_COLORS = { dark: '#050816', light: '#F4F7FB' };

/** Resolve "system" para "dark" ou "light" baseado no SO. */
function resolveSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Lê preferência salva no localStorage (sincrono). */
function readStoredPreference() {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'dark' || v === 'light' || v === 'system' ? v : 'system';
}

/** Aplica a classe correta no <html> e atualiza meta theme-color. */
function applyThemeToDOM(resolved) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  root.setAttribute('data-theme', resolved);

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', THEME_COLORS[resolved] || THEME_COLORS.dark);
}

export function ThemeProvider({ children }) {
  // "preference" é o que o usuário escolheu (pode ser "system").
  // "resolved" é o tema realmente aplicado (sempre "dark" ou "light").
  const [preference, setPreferenceState] = useState(() => readStoredPreference());
  const [resolved, setResolved] = useState(() => {
    const pref = readStoredPreference();
    return pref === 'system' ? resolveSystemTheme() : pref;
  });

  // Aplica no DOM sempre que `resolved` muda.
  useEffect(() => { applyThemeToDOM(resolved); }, [resolved]);

  // Reage a mudanças no SO quando preference === "system".
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setResolved(e.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [preference]);

  // Sincroniza entre abas.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue === 'dark' || e.newValue === 'light' || e.newValue === 'system' ? e.newValue : 'system';
      setPreferenceState(next);
      setResolved(next === 'system' ? resolveSystemTheme() : next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Hidratação do User.preferred_theme — best-effort, sem bloquear UI.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (cancelled || !me?.preferred_theme) return;
        // Se o usuário NUNCA tocou localmente (sem chave), respeita o que está no DB.
        const hasLocal = typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY);
        if (!hasLocal && (me.preferred_theme === 'dark' || me.preferred_theme === 'light' || me.preferred_theme === 'system')) {
          setPreferenceState(me.preferred_theme);
          setResolved(me.preferred_theme === 'system' ? resolveSystemTheme() : me.preferred_theme);
        }
      } catch { /* anônimo — ignora */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const setPreference = useCallback((next) => {
    if (next !== 'dark' && next !== 'light' && next !== 'system') return;
    setPreferenceState(next);
    const nextResolved = next === 'system' ? resolveSystemTheme() : next;
    setResolved(nextResolved);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* quota/ssr */ }
    // Persistência no usuário — best-effort, não bloqueia.
    base44.auth.updateMe({ preferred_theme: next }).catch(() => { /* anônimo */ });
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setPreference]);

  const value = useMemo(() => ({
    theme: resolved,                 // "dark" | "light" — o que está aplicado
    preference,                       // "dark" | "light" | "system" — o que o user escolheu
    isDark: resolved === 'dark',
    isLight: resolved === 'light',
    setTheme: setPreference,
    toggle,
  }), [resolved, preference, setPreference, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback seguro pra componentes renderizados fora do provider (storybook, testes).
    return { theme: 'dark', preference: 'system', isDark: true, isLight: false, setTheme: () => {}, toggle: () => {} };
  }
  return ctx;
}