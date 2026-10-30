import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

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

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase.from('held_orders').delete().eq('id', id);
      return NextResponse.json({ success: true, source: 'supabase_postgres', message: `Held order ${id} deleted` });
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ success: true, message: `Held order ${id} removed` });
}
