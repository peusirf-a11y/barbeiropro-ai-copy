import { useState, useEffect } from 'react';

const STORAGE_KEY = 'public_theme';

export function usePublicTheme() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  });

  const toggle = () => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const isDark = theme === 'dark';

  // Tokens de cor baseados no tema
  const t = {
    bg: isDark ? '#0f0f1a' : '#F7F8FB',
    bgCard: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
    bgCardHover: isDark ? 'rgba(255,255,255,0.08)' : '#f9f9f9',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#ffffff' : '#111827',
    textMuted: isDark ? 'rgba(255,255,255,0.4)' : '#6B7280',
    textFaint: isDark ? 'rgba(255,255,255,0.2)' : '#9CA3AF',
    header: isDark ? '#0f0f1a' : '#ffffff',
    headerBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    input: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
    inputBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    sectionLabel: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
  };

  // Tailwind classes baseadas no tema
  const tw = {
    bg: isDark ? 'bg-[#0f0f1a]' : 'bg-[#F7F8FB]',
    text: isDark ? 'text-white' : 'text-[#111827]',
    textMuted: isDark ? 'text-white/40' : 'text-gray-500',
    textFaint: isDark ? 'text-white/20' : 'text-gray-400',
    card: isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-black/8',
    cardHover: isDark ? 'hover:bg-white/8' : 'hover:bg-gray-50',
    header: isDark ? 'bg-[#0f0f1a] border-white/10' : 'bg-white border-black/10',
    divider: isDark ? 'border-white/10' : 'border-black/8',
    input: isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30' : 'bg-white border-black/10 text-[#111827] placeholder:text-gray-400',
    sectionLabel: isDark ? 'text-white/30' : 'text-gray-400',
    iconBg: isDark ? 'bg-white/10' : 'bg-gray-100',
    iconText: isDark ? 'text-white/40' : 'text-gray-400',
    logoutBtn: isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
    tabActive: isDark ? 'text-white' : 'text-[#111827]',
    tabInactive: isDark ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600',
    tabBorder: isDark ? 'border-white/10' : 'border-black/8',
    themeBtn: isDark
      ? 'bg-white/10 text-white/70 hover:bg-white/20'
      : 'bg-black/5 text-gray-600 hover:bg-black/10',
  };

  return { theme, isDark, toggle, t, tw };
}