import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { Order, OrderItem } from '@/types/pos';

const orderPrismaSelect = {
  id: true,
  receiptNumber: true,
  timestamp: true,
  subtotal: true,
  discountAmount: true,
  taxAmount: true,
  total: true,
  paymentMethod: true,
  amountTendered: true,
  changeGiven: true,
  cashierName: true,
  status: true,
  refundReason: true,
  notes: true,
  grossAmount: true,
  orderSource: true,
  orderType: true,
  fulfillmentStatus: true,
  customerId: true,
  deliveryAddress: true,
  deliveryCity: true,
  deliveryFee: true,
  paymentStatus: true,
  estimatedTime: true,
  customerNotes: true,
  createdAt: true,
  updatedAt: true,
  customer: true,
  items: true,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;

  if (isPrismaConfigured()) {
    try {
      const order = await prisma.order.findFirst({
        where: {
          OR: [{ id }, { receiptNumber: id }],
        },
        select: orderPrismaSelect,
      });

      if (order) {
        return NextResponse.json({ success: true, data: order });
      }
    } catch (err) {
      console.error('Prisma fetch order error:', err);
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .or(`id.eq.${id},receipt_number.eq.${id}`)
        .maybeSingle();

      if (!error && data) {
        return NextResponse.json({ success: true, data });
      }
    } catch (err) {
      console.error('Supabase fetch order error:', err);
    }
  }

  return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const {
    fulfillmentStatus,
    paymentStatus,
    estimatedTime,
    notes,
    customerNotes,
  } = body;

  const updateData: any = {};
  if (fulfillmentStatus) updateData.fulfillmentStatus = fulfillmentStatus;
  if (paymentStatus) updateData.paymentStatus = paymentStatus;
  if (estimatedTime !== undefined) updateData.estimatedTime = estimatedTime;
  if (notes !== undefined) updateData.notes = notes;
  if (customerNotes !== undefined) updateData.customerNotes = customerNotes;
  updateData.updatedAt = new Date();

  // If status is set to CANCELLED, we may want to restore inventory
  if (isPrismaConfigured()) {
    try {
      const existing = await prisma.order.findFirst({
        where: { OR: [{ id }, { receiptNumber: id }] },
        select: {
          id: true,
          fulfillmentStatus: true,
          items: true,
        },
      });

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      // Check if cancelling an active order
      const isCancelling = fulfillmentStatus === 'CANCELLED' && existing.fulfillmentStatus !== 'CANCELLED';

      const updated = await prisma.$transaction(async (tx) => {
        if (isCancelling) {
          // Restore stock
          for (const item of existing.items) {
            if (item.productId) {
              try {
                await tx.product.update({
                  where: { id: item.productId },
                  data: { stock: { increment: item.quantity } },
                });
              } catch (e) {
                console.warn('Could not restore stock on cancellation:', e);
              }
            }
          }
        }

        return await tx.order.update({
          where: { id: existing.id },
          data: updateData,
          include: { items: true },
        });
      });

      return NextResponse.json({
        success: true,
        source: 'prisma_postgresql',
        message: `Order status updated to ${fulfillmentStatus || 'updated'}`,
        data: updated,
      });
    } catch (err: any) {
      console.error('Prisma order update error:', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // Supabase fallback
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const supabaseUpdates: any = {};
      if (fulfillmentStatus) supabaseUpdates.fulfillment_status = fulfillmentStatus;
      if (paymentStatus) supabaseUpdates.payment_status = paymentStatus;
      if (estimatedTime !== undefined) supabaseUpdates.estimated_time = estimatedTime;
      if (notes !== undefined) supabaseUpdates.notes = notes;
      if (customerNotes !== undefined) supabaseUpdates.customer_notes = customerNotes;
      supabaseUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('orders')
        .update(supabaseUpdates)
        .or(`id.eq.${id},receipt_number.eq.${id}`)
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({
          success: true,
          source: 'supabase_postgres',
          message: 'Order updated',
          data,
        });
      }
    } catch (err: any) {
      console.error('Supabase update order error:', err);
    }
  }

  return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
}

