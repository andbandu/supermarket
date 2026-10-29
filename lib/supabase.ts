import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('https://') &&
    (supabaseServiceKey || supabaseAnonKey)
  );
}

// Server-side privileged client (uses SERVICE_ROLE_KEY for admin operations like stock deduction)
let serverClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!serverClient) {
    serverClient = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverClient;
}

// Public client for browser / client components
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}

