import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
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

    if (isPrismaConfigured()) {
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
    }

    return NextResponse.json({ success: true, data: body });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}
