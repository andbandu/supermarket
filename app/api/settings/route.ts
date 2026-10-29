import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { POSSettings } from '@/types/pos';
import { DEFAULT_SETTINGS } from '@/lib/mockData';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (!error && data) {
        const settings: POSSettings = {
          storeName: data.store_name,
          tagline: data.tagline,
          storeAddress: data.store_address,
          storePhone: data.store_phone,
          taxRatePercent: Number(data.tax_rate_percent),
          currencySymbol: data.currency_symbol,
          receiptFooter: data.receipt_footer,
          soundEnabled: Boolean(data.sound_enabled),
          activeCashier: data.active_cashier,
        };
        return NextResponse.json({ success: true, data: settings });
      }
    } catch {
      // fallback
    }
  }

  return NextResponse.json({ success: true, data: DEFAULT_SETTINGS });
}

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body: Partial<POSSettings> = await request.json();
    const supabase = getSupabaseAdmin();

    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('settings').upsert([
        {
          id: 1,
          store_name: body.storeName ?? DEFAULT_SETTINGS.storeName,
          tagline: body.tagline ?? DEFAULT_SETTINGS.tagline,
          store_address: body.storeAddress ?? DEFAULT_SETTINGS.storeAddress,
          store_phone: body.storePhone ?? DEFAULT_SETTINGS.storePhone,
          tax_rate_percent: body.taxRatePercent ?? DEFAULT_SETTINGS.taxRatePercent,
          currency_symbol: body.currencySymbol ?? DEFAULT_SETTINGS.currencySymbol,
          receipt_footer: body.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter,
          sound_enabled: body.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
          active_cashier: body.activeCashier ?? DEFAULT_SETTINGS.activeCashier,
          updated_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, data: body });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}

