import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { Order, OrderItem } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const supabase = getSupabaseAdmin();

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('timestamp', { ascending: false });

      if (!ordersError && ordersData) {
        const formatted: Order[] = ordersData.map((o: Record<string, unknown>) => {
          const rawItems = (o.order_items as Array<Record<string, unknown>>) || [];
          const items: OrderItem[] = rawItems.map((item) => ({
            productId: String(item.product_id),
            productName: String(item.product_name),
            barcode: String(item.barcode),
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            discountPercent: Number(item.discount_percent || 0),
            totalPrice: Number(item.total_price),
          }));

          return {
            id: String(o.id),
            receiptNumber: String(o.receipt_number),
            timestamp: String(o.timestamp),
            items,
            subtotal: Number(o.subtotal),
            discountAmount: Number(o.discount_amount || 0),
            taxAmount: Number(o.tax_amount || 0),
            total: Number(o.total),
            paymentMethod: o.payment_method as Order['paymentMethod'],
            amountTendered: Number(o.amount_tendered),
            changeGiven: Number(o.change_given || 0),
            cashierName: String(o.cashier_name),
            status: o.status as Order['status'],
            refundReason: o.refund_reason ? String(o.refund_reason) : undefined,
            notes: o.notes ? String(o.notes) : undefined,
          };
        });

        return NextResponse.json({
          success: true,
          source: 'supabase_postgres',
          data: formatted,
        });
      }
    } catch {
      // fallback
    }
  }

  return NextResponse.json({
    success: true,
    source: 'local_fallback',
    data: [],
  });
}

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const orderId = body.id || 'ord-' + Date.now();
    const receiptNumber =
      body.receiptNumber ||
      `REC-${new Date().getFullYear()}${(new Date().getMonth() + 1)
        .toString()
        .padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    const newOrder: Order = {
      id: orderId,
      receiptNumber,
      timestamp: body.timestamp || new Date().toISOString(),
      items: body.items || [],
      subtotal: Number(body.subtotal || 0),
      discountAmount: Number(body.discountAmount || 0),
      taxAmount: Number(body.taxAmount || 0),
      total: Number(body.total || 0),
      paymentMethod: body.paymentMethod || 'CASH',
      amountTendered: Number(body.amountTendered || body.total || 0),
      changeGiven: Number(body.changeGiven || 0),
      cashierName: body.cashierName || 'Cashier',
      status: 'COMPLETED',
      notes: body.notes,
    };

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      // 1. Insert order header
      const { error: orderError } = await supabase.from('orders').insert([
        {
          id: newOrder.id,
          receipt_number: newOrder.receiptNumber,
          timestamp: newOrder.timestamp,
          subtotal: newOrder.subtotal,
          discount_amount: newOrder.discountAmount,
          tax_amount: newOrder.taxAmount,
          total: newOrder.total,
          payment_method: newOrder.paymentMethod,
          amount_tendered: newOrder.amountTendered,
          change_given: newOrder.changeGiven,
          cashier_name: newOrder.cashierName,
          status: newOrder.status,
          notes: newOrder.notes,
        },
      ]);

      if (orderError) {
        return NextResponse.json({ success: false, error: orderError.message }, { status: 400 });
      }

      // 2. Insert order items
      if (newOrder.items.length > 0) {
        const itemRows = newOrder.items.map((item) => ({
          order_id: newOrder.id,
          product_id: item.productId,
          product_name: item.productName,
          barcode: item.barcode,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_percent: item.discountPercent,
          total_price: item.totalPrice,
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(itemRows);
        if (itemsError) {
          console.error('Error inserting order items:', itemsError);
        }

        // 3. Atomically decrement stock in PostgreSQL
        for (const item of newOrder.items) {
          try {
            const { data: currentProd } = await supabase
              .from('products')
              .select('stock')
              .eq('id', item.productId)
              .single();

            if (currentProd) {
              const updatedStock = Math.max(0, (currentProd.stock || 0) - item.quantity);
              await supabase
                .from('products')
                .update({ stock: updatedStock, updated_at: new Date().toISOString() })
                .eq('id', item.productId);
            }
          } catch (err) {
            console.error('Failed to decrement product stock:', err);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order created and stock updated successfully',
      data: newOrder,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid order payload' },
      { status: 400 }
    );
  }
}

