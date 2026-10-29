import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { HeldOrder, CartItem } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  if (isPrismaConfigured()) {
    try {
      const held = await prisma.heldOrder.findMany({
        orderBy: { heldAt: 'desc' },
      });

      const formatted: HeldOrder[] = held.map((row) => ({
        id: row.id,
        heldAt: row.heldAt.toISOString(),
        customerNote: row.customerNote,
        items: row.itemsJson as unknown as CartItem[],
        subtotal: row.subtotal,
        total: row.total,
        cashierName: row.cashierName,
      }));

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: formatted });
    } catch (err) {
      console.error('Prisma held orders query error:', err);
    }
  }

  return NextResponse.json({ success: true, data: [] });
}

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body: HeldOrder = await request.json();

    if (isPrismaConfigured()) {
      await prisma.heldOrder.upsert({
        where: { id: body.id },
        update: {
          heldAt: new Date(body.heldAt || Date.now()),
          customerNote: body.customerNote,
          itemsJson: body.items as unknown as object,
          subtotal: body.subtotal,
          total: body.total,
          cashierName: body.cashierName,
        },
        create: {
          id: body.id,
          heldAt: new Date(body.heldAt || Date.now()),
          customerNote: body.customerNote,
          itemsJson: body.items as unknown as object,
          subtotal: body.subtotal,
          total: body.total,
          cashierName: body.cashierName,
        },
      });
      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: body });
    }

    return NextResponse.json({ success: true, data: body });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}
