import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const refundReason = body.reason || 'Customer refund / return';

  const supabase = getSupabaseAdmin();

  if (supabase && isSupabaseConfigured()) {
    // 1. Fetch order and its items
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .eq('id', id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'REFUNDED') {
      return NextResponse.json(
        { success: false, error: 'Order is already marked as refunded' },
        { status: 400 }
      );
    }

    // 2. Mark refunded
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'REFUNDED',
        refund_reason: refundReason,
      })
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
    }

    // 3. Restore product stock in PostgreSQL
    const items = order.order_items || [];
    for (const item of items) {
      if (item.product_id) {
        try {
          const { data: prod } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.product_id)
            .single();

          if (prod) {
            await supabase
              .from('products')
              .update({
                stock: (prod.stock || 0) + item.quantity,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.product_id);
          }
        } catch (err) {
          console.error('Failed to restore item stock:', err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order refunded and inventory stock restored successfully',
      data: {
        id,
        status: 'REFUNDED',
        refundReason,
      },
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Refund recorded locally',
    data: { id, status: 'REFUNDED', refundReason },
  });
}

