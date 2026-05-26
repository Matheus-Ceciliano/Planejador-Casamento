import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // The app still renders a friendly setup message in AuthProvider.
  console.warn('Supabase env vars are missing.');
}

const fallbackSupabaseUrl = 'http://127.0.0.1:54321';
const fallbackSupabaseAnonKey = 'supabase-not-configured';

export const supabase = createClient(
  supabaseUrl || fallbackSupabaseUrl,
  supabaseAnonKey || fallbackSupabaseAnonKey
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
