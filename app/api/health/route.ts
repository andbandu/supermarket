import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  const supabaseConfigured = isSupabaseConfigured();
  let dbStatus = 'Not Connected (using Local Fallback)';
  let productsCount = 0;

  if (supabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { count, error } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });
        if (!error) {
          dbStatus = 'Connected to Supabase PostgreSQL';
          productsCount = count || 0;
        } else {
          dbStatus = `Supabase Error: ${error.message}`;
        }
      } catch (err: unknown) {
        dbStatus = `Connection failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }

  return NextResponse.json({
    status: 'online',
    version: '1.0.0',
    service: 'Minimart POS Secure API',
    database: {
      type: 'PostgreSQL (Supabase)',
      configured: supabaseConfigured,
      status: dbStatus,
      productsCount,
    },
    auth: {
      method: 'x-api-key or Bearer token',
      status: 'authenticated',
    },
    timestamp: new Date().toISOString(),
  });
}

