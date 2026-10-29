import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  if (supabase && isSupabaseConfigured()) {
    const { error } = await supabase.from('held_orders').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true, message: `Held order ${id} deleted` });
}

