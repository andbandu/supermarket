import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { HeldOrder } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('held_orders')
        .select('*')
        .order('held_at', { ascending: false });

      if (!error && data) {
        const formatted: HeldOrder[] = data.map((row) => ({
          id: row.id,
          heldAt: row.held_at,
          customerNote: row.customer_note,
          items: row.items_json,
          subtotal: Number(row.subtotal),
          total: Number(row.total),
          cashierName: row.cashier_name,
        }));
        return NextResponse.json({ success: true, data: formatted });
      }
    } catch {
      // fallback
    }
  }

  return NextResponse.json({ success: true, data: [] });
}

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body: HeldOrder = await request.json();
    const supabase = getSupabaseAdmin();

    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('held_orders').insert([
        {
          id: body.id,
          held_at: body.heldAt || new Date().toISOString(),
          customer_note: body.customerNote,
          items_json: body.items,
          subtotal: body.subtotal,
          total: body.total,
          cashier_name: body.cashierName,
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

