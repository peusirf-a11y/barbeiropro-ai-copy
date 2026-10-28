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
    bg: isDark ? '#0f0f1a' : '#F7F8FB',
    bgCard: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
    bgCardHover: isDark ? 'rgba(255,255,255,0.08)' : '#f9f9f9',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#ffffff' : '#111827',
    textMuted: isDark ? 'rgba(255,255,255,0.72)' : '#6B7280',
    textFaint: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF',
    header: isDark ? '#0f0f1a' : '#ffffff',
    headerBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    input: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
    inputBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    sectionLabel: isDark ? 'rgba(255,255,255,0.6)' : '#9CA3AF',
  };

  // Tailwind classes baseadas no tema.
  const tw = {
    scope: isDark ? 'public-dark' : 'public-light',
    bg: isDark ? 'bg-[#0f0f1a]' : 'bg-[#F7F8FB]',
    text: isDark ? 'text-[#FFFFFF]' : 'text-[#111827]',
    textMuted: isDark ? 'text-[rgba(255,255,255,0.78)]' : 'text-gray-500',
    textFaint: isDark ? 'text-[rgba(255,255,255,0.55)]' : 'text-gray-400',
    card: isDark ? 'bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.15)]' : 'bg-white border border-black/8',
    cardHover: isDark ? 'hover:bg-[rgba(255,255,255,0.10)]' : 'hover:bg-gray-50',
    header: isDark ? 'bg-[#0f0f1a] border-[rgba(255,255,255,0.15)]' : 'bg-white border-black/10',
    divider: isDark ? 'border-[rgba(255,255,255,0.15)]' : 'border-black/8',
    input: isDark
      ? 'bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.16)] text-[#FFFFFF] placeholder:text-[rgba(255,255,255,0.45)]'
      : 'bg-white border-black/10 text-[#111827] placeholder:text-gray-400',
    secondaryBtn: isDark
      ? 'text-[#FFFFFF] border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.10)]'
      : 'text-[#111827] border border-black/12 bg-gray-50 hover:bg-gray-100',
    sectionLabel: isDark ? 'text-[rgba(255,255,255,0.65)]' : 'text-gray-400',
    iconBg: isDark ? 'bg-[rgba(255,255,255,0.12)]' : 'bg-gray-100',
    iconText: isDark ? 'text-[rgba(255,255,255,0.75)]' : 'text-gray-400',
    logoutBtn: isDark ? 'bg-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.82)] hover:bg-[rgba(255,255,255,0.18)]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
    tabActive: isDark ? 'text-[#FFFFFF]' : 'text-[#111827]',
    tabInactive: isDark ? 'text-[rgba(255,255,255,0.6)] hover:text-[rgba(255,255,255,0.9)]' : 'text-gray-400 hover:text-gray-600',
    tabBorder: isDark ? 'border-[rgba(255,255,255,0.15)]' : 'border-black/8',
    themeBtn: isDark
      ? 'bg-[rgba(15,15,26,0.75)] text-[#FFFFFF] hover:bg-[rgba(15,15,26,0.9)]'
      : 'bg-white/85 text-gray-700 hover:bg-white',
  };

  return { theme, isDark, toggle, t, tw };
}