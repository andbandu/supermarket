import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { CashierShift } from '@/types/pos';
import { DEFAULT_SETTINGS } from '@/lib/mockData';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  if (isPrismaConfigured()) {
    try {
      const shift = await prisma.shift.findFirst({
        orderBy: { startedAt: 'desc' },
      });

      if (shift) {
        const formatted: CashierShift = {
          id: shift.id,
          cashierName: shift.cashierName,
          startedAt: shift.startedAt.toISOString(),
          endedAt: shift.endedAt ? shift.endedAt.toISOString() : undefined,
          startingFloat: shift.startingFloat,
          cashDrops: shift.cashDrops,
          actualDrawerCash: shift.actualDrawerCash ?? undefined,
          notes: shift.notes ?? undefined,
          isClosed: shift.isClosed,
        };
        return NextResponse.json({ success: true, source: 'prisma_postgresql', data: formatted });
      }
    } catch (err) {
      console.error('Prisma shift query error:', err);
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from('shifts')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const formatted: CashierShift = {
          id: data.id,
          cashierName: data.cashier_name,
          startedAt: data.started_at,
          endedAt: data.ended_at || undefined,
          startingFloat: Number(data.starting_float),
          cashDrops: Number(data.cash_drops || 0),
          actualDrawerCash: data.actual_drawer_cash !== null ? Number(data.actual_drawer_cash) : undefined,
          notes: data.notes || undefined,
          isClosed: Boolean(data.is_closed),
        };
        return NextResponse.json({ success: true, source: 'supabase_postgres', data: formatted });
      }
    } catch (err) {
      console.error('Supabase shift query error:', err);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: 'shift-' + Date.now(),
      cashierName: DEFAULT_SETTINGS.activeCashier,
      startedAt: new Date().toISOString(),
      startingFloat: 5000.0,
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

    if (isPrismaConfigured()) {
      try {
        const saved = await prisma.shift.upsert({
          where: { id: body.id },
          update: {
            cashierName: body.cashierName,
            startedAt: new Date(body.startedAt),
            endedAt: body.endedAt ? new Date(body.endedAt) : null,
            startingFloat: body.startingFloat,
            cashDrops: body.cashDrops,
            actualDrawerCash: body.actualDrawerCash,
            notes: body.notes,
            isClosed: body.isClosed,
          },
          create: {
            id: body.id,
            cashierName: body.cashierName,
            startedAt: new Date(body.startedAt),
            endedAt: body.endedAt ? new Date(body.endedAt) : null,
            startingFloat: body.startingFloat,
            cashDrops: body.cashDrops,
            actualDrawerCash: body.actualDrawerCash,
            notes: body.notes,
            isClosed: body.isClosed,
          },
        });

        return NextResponse.json({ success: true, source: 'prisma_postgresql', data: saved });
      } catch (err) {
        console.error('Prisma shift save error:', err);
      }
    }

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('shifts').upsert({
          id: body.id,
          cashier_name: body.cashierName,
          started_at: new Date(body.startedAt).toISOString(),
          ended_at: body.endedAt ? new Date(body.endedAt).toISOString() : null,
          starting_float: body.startingFloat,
          cash_drops: body.cashDrops,
          actual_drawer_cash: body.actualDrawerCash,
          notes: body.notes,
          is_closed: body.isClosed,
        });
        return NextResponse.json({ success: true, source: 'supabase_postgres', data: body });
      } catch (err) {
        console.error('Supabase shift save error:', err);
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
