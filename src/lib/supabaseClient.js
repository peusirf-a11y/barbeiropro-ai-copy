import { createClient } from '@supabase/supabase-js';

const HARDCODED_URL = 'https://ijitvgzcbvguacsveccy.supabase.co';
const HARDCODED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXR2Z3pjYnZndWFjc3ZlY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MjEwODcsImV4cCI6MjEwNzQ5NzA4N30.9WYMFFf6oG2KIl4TpcHDAicV6w9BocIUN6gbSlq6Q_g';

function getCleanUrl() {
  const envUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : undefined;
  const procUrl = typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL) : undefined;
  const activeUrl = envUrl || procUrl;
  if (typeof activeUrl === 'string') {
    const clean = activeUrl.trim().replace(/["';]/g, '');
    if (clean.startsWith('https://') || clean.startsWith('http://')) {
      return clean;
    }
  }
  return HARDCODED_URL;
}

function getCleanKey() {
  const envKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : undefined;
  const procKey = typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY) : undefined;
  const activeKey = envKey || procKey;
  if (typeof activeKey === 'string') {
    const clean = activeKey.trim().replace(/["';]/g, '');
    if (clean.length > 20) {
      return clean;
    }
  }
  return HARDCODED_KEY;
}

const supabaseUrl = getCleanUrl();
const supabaseAnonKey = getCleanKey();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = true;
export default supabase;
