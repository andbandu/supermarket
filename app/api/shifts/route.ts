import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { CashierShift } from '@/types/pos';
import { DEFAULT_SETTINGS } from '@/lib/mockData';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        const shift: CashierShift = {
          id: data.id,
          cashierName: data.cashier_name,
          startedAt: data.started_at,
          endedAt: data.ended_at,
          startingFloat: Number(data.starting_float),
          cashDrops: Number(data.cash_drops || 0),
          actualDrawerCash: data.actual_drawer_cash ? Number(data.actual_drawer_cash) : undefined,
          notes: data.notes,
          isClosed: Boolean(data.is_closed),
        };
        return NextResponse.json({ success: true, data: shift });
      }
    } catch {
      // fallback
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: 'shift-current',
      cashierName: DEFAULT_SETTINGS.activeCashier,
      startedAt: '2026-10-29T08:00:00.000Z',
      startingFloat: 200.0,
      cashDrops: 0,
      isClosed: false,
    },
  });
}

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body: CashierShift = await request.json();
    const supabase = getSupabaseAdmin();

    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('shifts').upsert([
        {
          id: body.id,
          cashier_name: body.cashierName,
          started_at: body.startedAt,
          ended_at: body.endedAt,
          starting_float: body.startingFloat,
          cash_drops: body.cashDrops,
          actual_drawer_cash: body.actualDrawerCash,
          notes: body.notes,
          is_closed: body.isClosed,
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

