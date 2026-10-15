import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://ijitvgzcbvguacsveccy.supabase.co').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXR2Z3pjYnZndWFjc3ZlY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MjEwODcsImV4cCI6MjEwNzQ5NzA4N30.9WYMFFf6oG2KIl4TpcHDAicV6w9BocIUN6gbSlq6Q_g').trim();

// Use same-origin proxy in browser to avoid cross-origin / iframe sandbox network blocks
const getEffectiveUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/supabase-proxy`;
  }
  return rawUrl;
};

const effectiveUrl = getEffectiveUrl();

export const isSupabaseConfigured = Boolean(rawUrl && supabaseAnonKey);

export const supabase = createClient(effectiveUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-client-info': 'barberpass-web',
    },
  },
});
