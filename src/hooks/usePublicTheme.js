import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'public_theme';
const THEME_EVENT = 'public-theme-change';

export function usePublicTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const handleThemeChange = (e) => {
      const nextTheme = e?.detail || localStorage.getItem(STORAGE_KEY) || 'dark';
      setTheme(nextTheme);
    };

    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setTheme(e.newValue);
      }
    };

    window.addEventListener(THEME_EVENT, handleThemeChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, handleThemeChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (_) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
      }
      return next;
    });
  }, []);

  const isDark = theme === 'dark';

  // Tokens de cor baseados no tema
  const t = {
    bg: isDark ? '#0F101A' : '#F1F2F7',
    bgCard: isDark ? '#171827' : '#FFFFFF',
    bgCardHover: isDark ? '#1E2034' : '#F8FAFC',
    border: isDark ? '#232538' : '#E5E7EF',
    text: isDark ? '#FFFFFF' : '#171827',
    textMuted: isDark ? '#94A3B8' : '#55596A',
    textFaint: isDark ? '#64748B' : '#59658F',
    header: '#171827',
    headerBorder: isDark ? '#232538' : '#232538',
    input: isDark ? '#171827' : '#FFFFFF',
    inputBorder: isDark ? '#232538' : '#E5E7EF',
    sectionLabel: isDark ? '#94A3B8' : '#59658F',
  };

  // Tailwind classes baseadas no tema.
  const tw = {
    scope: isDark ? 'public-dark' : 'public-light',
    bg: isDark ? 'bg-[#0F101A]' : 'bg-[#F1F2F7]',
    text: isDark ? 'text-white' : 'text-[#171827]',
    textMuted: isDark ? 'text-slate-400' : 'text-[#55596A]',
    textFaint: isDark ? 'text-slate-500' : 'text-[#59658F]',
    card: isDark ? 'bg-[#171827] border border-[#232538] shadow-sm' : 'bg-white border border-[#E5E7EF] shadow-sm',
    cardHover: isDark ? 'hover:bg-[#1E2034]' : 'hover:bg-slate-50',
    header: 'bg-[#171827] border-[#232538] text-white',
    divider: isDark ? 'border-[#232538]' : 'border-[#E5E7EF]',
    input: isDark
      ? 'bg-[#171827] border-[#232538] text-white placeholder:text-slate-500 focus:border-[#2563EB]'
      : 'bg-white border-[#E5E7EF] text-[#171827] placeholder:text-slate-400 focus:border-[#2563EB]',
    secondaryBtn: isDark
      ? 'text-white border border-[#232538] bg-[#171827] hover:bg-[#1E2034]'
      : 'text-[#171827] border border-[#E5E7EF] bg-white hover:bg-slate-50',
    sectionLabel: isDark ? 'text-slate-400 font-bold uppercase tracking-wider' : 'text-[#59658F] font-bold uppercase tracking-wider',
    iconBg: isDark ? 'bg-white/[0.06]' : 'bg-slate-100',
    iconText: isDark ? 'text-slate-300' : 'text-[#59658F]',
    logoutBtn: isDark ? 'bg-white/[0.08] text-white/80 hover:bg-white/[0.15]' : 'bg-white/10 text-white/80 hover:bg-white/20',
    tabActive: isDark ? 'text-white font-bold' : 'text-[#171827] font-bold',
    tabInactive: isDark ? 'text-slate-400 hover:text-white' : 'text-[#55596A] hover:text-[#171827]',
    tabBorder: isDark ? 'border-[#232538]' : 'border-[#E5E7EF]',
    themeBtn: isDark
      ? 'bg-white/[0.08] text-white hover:bg-white/[0.15]'
      : 'bg-white/10 text-white hover:bg-white/20',
  };

  return { theme, isDark, toggle, t, tw };
}