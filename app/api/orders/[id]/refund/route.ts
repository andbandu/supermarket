import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
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

  // 1. Prisma ORM Handler (Primary)
  if (isPrismaConfigured()) {
    try {
      // Find by ID or Receipt Number
      const order = await prisma.order.findFirst({
        where: {
          OR: [{ id: id }, { receiptNumber: id }],
        },
        select: {
          id: true,
          receiptNumber: true,
          status: true,
          items: true,
        },
      });

      if (order) {
        if (order.status === 'REFUNDED') {
          return NextResponse.json(
            { success: false, error: 'Order is already marked as refunded in database.' },
            { status: 400 }
          );
        }

        // Execute atomic refund transaction in PostgreSQL
        await prisma.$transaction(async (tx) => {
          // Update order status
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'REFUNDED',
              refundReason,
            },
          });

          // Restore stock in products table
          for (const item of order.items) {
            if (item.productId) {
              try {
                await tx.product.update({
                  where: { id: item.productId },
                  data: {
                    stock: { increment: item.quantity },
                  },
                });
              } catch (err) {
                console.warn(`Could not restore stock for product ${item.productId}:`, err);
              }
            }
          }
        });

        return NextResponse.json({
          success: true,
          source: 'prisma_postgresql',
          message: 'Order refunded and inventory stock restored in PostgreSQL via Prisma',
          data: {
            id: order.id,
            receiptNumber: order.receiptNumber,
            status: 'REFUNDED',
            refundReason,
          },
        });
      }
    } catch (err: unknown) {
      console.error('Prisma refund error:', err);
    }
  }

  // 2. Direct Supabase Client Handler
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      let { data: order } = await supabase
        .from('orders')
        .select('*, order_items (*)')
        .eq('id', id)
        .maybeSingle();

      if (!order) {
        const { data: byReceipt } = await supabase
          .from('orders')
          .select('*, order_items (*)')
          .eq('receipt_number', id)
          .maybeSingle();
        order = byReceipt;
      }

      if (order) {
        if (order.status === 'REFUNDED') {
          return NextResponse.json(
            { success: false, error: 'Order is already marked as refunded in Supabase.' },
            { status: 400 }
          );
        }

        const { error: updateErr } = await supabase
          .from('orders')
          .update({
            status: 'REFUNDED',
            refund_reason: refundReason,
          })
          .eq('id', order.id);

        if (!updateErr) {
          const items = (order.order_items as Array<Record<string, unknown>>) || [];
          for (const item of items) {
            if (item.product_id) {
              try {
                const { data: prod } = await supabase
                  .from('products')
                  .select('stock')
                  .eq('id', String(item.product_id))
                  .single();

                if (prod) {
                  const restoredStock = (prod.stock || 0) + Number(item.quantity || 0);
                  await supabase
                    .from('products')
                    .update({ stock: restoredStock, updated_at: new Date().toISOString() })
                    .eq('id', String(item.product_id));
                }
              } catch (err) {
                console.error('Failed to restore item stock in Supabase:', err);
              }
            }
          }

          return NextResponse.json({
            success: true,
            source: 'supabase_postgres',
            message: 'Order refunded and inventory stock restored in Supabase PostgreSQL',
            data: {
              id: order.id,
              receiptNumber: order.receipt_number,
              status: 'REFUNDED',
              refundReason,
            },
          });
        }
      }
    } catch (err: unknown) {
      console.error('Supabase refund error:', err);
    }
  }

  return NextResponse.json(
    { success: false, error: `Order '${id}' not found in database.` },
    { status: 404 }
  );
}
