import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://ijitvgzcbvguacsveccy.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXR2Z3pjYnZndWFjc3ZlY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3MTEwOTUsImV4cCI6MjA0MjI4NzA5NX0.WYMFFf6oG2KIl4TpcHDAicV6w9BocIUN6gbSlq6Q_ga';

export let supabase = null;

try {
  console.log('[supabaseClient] Inicializando Supabase createClient...');
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  console.log('[supabaseClient] Supabase instanciado com sucesso!');
} catch (err) {
  const errorDetails = (err && (err.message + '\n' + (err.stack || ''))) || String(err);
  console.error('[supabaseClient] Falha fatal ao inicializar o Supabase:', err);
  if (typeof window !== 'undefined') {
    window.__SUPABASE_INIT_ERROR__ = errorDetails;
  }
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabase);
export default supabase;
