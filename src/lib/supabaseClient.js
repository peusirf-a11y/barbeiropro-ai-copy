import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (import.meta.env.VITE_SUPABASE_URL || 'https://ijitvgzcbvguacsveccy.supabase.co').trim();

const supabaseAnonKey = 
  (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXR2Z3pjYnZndWFjc3ZlY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3MTEwOTUsImV4cCI6MjA0MjI4NzA5NX0.WYMFFf6oG2KIl4TpcHDAicV6w9BocIUN6gbSlq6Q_ga').trim();

export let supabase;

try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} catch (err) {
  console.error("Falha ao inicializar o Supabase:", err);
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase não inicializado') }),
      signUp: async () => ({ data: null, error: new Error('Supabase não inicializado') }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: null, error: new Error('Supabase não inicializado') }),
      verifyOtp: async () => ({ data: null, error: new Error('Supabase não inicializado') }),
      updateUser: async () => ({ data: null, error: new Error('Supabase não inicializado') }),
    },
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
      eq: function() { return this; },
      single: function() { return Promise.resolve({ data: null, error: null }); },
    }),
  };
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabase);

export default supabase;
