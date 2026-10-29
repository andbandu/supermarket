import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;

  if (isPrismaConfigured()) {
    try {
      await prisma.heldOrder.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, source: 'prisma_postgresql', message: `Held order ${id} deleted` });
    } catch {
      // ignore if already deleted
    }
  }

  return NextResponse.json({ success: true, message: `Held order ${id} deleted locally` });
}
