import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { Order, OrderItem } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  // 1. Prisma ORM (Primary PostgreSQL connection)
  if (isPrismaConfigured()) {
    try {
      const orders = await prisma.order.findMany({
        include: {
          items: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      const formatted: Order[] = orders.map((o) => {
        const items: OrderItem[] = o.items.map((item) => ({
          productId: item.productId || '',
          productName: item.productName,
          barcode: item.barcode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          totalPrice: item.totalPrice,
        }));

        return {
          id: o.id,
          receiptNumber: o.receiptNumber,
          timestamp: o.timestamp.toISOString(),
          items,
          subtotal: o.subtotal,
          discountAmount: o.discountAmount,
          taxAmount: o.taxAmount,
          total: o.total,
          paymentMethod: o.paymentMethod as Order['paymentMethod'],
          amountTendered: o.amountTendered,
          changeGiven: o.changeGiven,
          cashierName: o.cashierName,
          status: o.status as Order['status'],
          refundReason: o.refundReason ?? undefined,
          notes: o.notes ?? undefined,
        };
      });

      return NextResponse.json({
        success: true,
        source: 'prisma_postgresql',
        data: formatted,
      });
    } catch (err) {
      console.error('Prisma orders query error:', err);
    }
  }

  // 2. Direct Supabase Client
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('timestamp', { ascending: false });

      if (!ordersError && ordersData) {
        const formatted: Order[] = ordersData.map((o: any) => {
          const rawItems = o.order_items || [];
          const items: OrderItem[] = rawItems.map((item: any) => ({
            productId: item.product_id ? String(item.product_id) : '',
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
    } catch (err) {
      console.error('Supabase orders query error:', err);
    }
  }

  return NextResponse.json({
    success: true,
    source: 'empty_fallback',
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

    const items: OrderItem[] = body.items || [];
    const subtotal = Number(body.subtotal || 0);
    const discountAmount = Number(body.discountAmount || 0);
    const taxAmount = Number(body.taxAmount || 0);
    const total = Number(body.total || 0);
    const paymentMethod = body.paymentMethod || 'CASH';
    const amountTendered = Number(body.amountTendered || total);
    const changeGiven = Number(body.changeGiven || 0);
    const cashierName = body.cashierName || 'Cashier';
    const notes = body.notes;

    const completedOrder: Order = {
      id: orderId,
      receiptNumber,
      timestamp: body.timestamp || new Date().toISOString(),
      items,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      paymentMethod,
      amountTendered,
      changeGiven,
      cashierName,
      status: 'COMPLETED',
      notes,
    };

    // 1. Process via Prisma ORM (Atomic Transaction: create order + decrement stock)
    if (isPrismaConfigured()) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Check products to ensure valid foreign keys
          const productMap = new Map<string, boolean>();

          for (const item of items) {
            if (item.productId && !item.productId.startsWith('custom-')) {
              const existing = await tx.product.findUnique({
                where: { id: item.productId },
              });
              if (existing) {
                productMap.set(item.productId, true);
                // Decrement stock in database in real-time
                await tx.product.update({
                  where: { id: item.productId },
                  data: {
                    stock: {
                      decrement: item.quantity,
                    },
                  },
                });
              }
            }
          }

          // Create the Order with all OrderItems
          const createdOrder = await tx.order.create({
            data: {
              id: orderId,
              receiptNumber,
              timestamp: new Date(completedOrder.timestamp),
              subtotal,
              discountAmount,
              taxAmount,
              total,
              paymentMethod,
              amountTendered,
              changeGiven,
              cashierName,
              status: 'COMPLETED',
              notes,
              items: {
                create: items.map((i) => ({
                  productId: productMap.get(i.productId) ? i.productId : null,
                  productName: i.productName,
                  barcode: i.barcode,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  discountPercent: i.discountPercent,
                  totalPrice: i.totalPrice,
                })),
              },
            },
            include: {
              items: true,
            },
          });

          return createdOrder;
        });

        return NextResponse.json({
          success: true,
          source: 'prisma_postgresql',
          message: 'Order created and stock decremented in PostgreSQL via Prisma',
          data: {
            id: result.id,
            receiptNumber: result.receiptNumber,
            timestamp: result.timestamp.toISOString(),
            items,
            subtotal: result.subtotal,
            discountAmount: result.discountAmount,
            taxAmount: result.taxAmount,
            total: result.total,
            paymentMethod: result.paymentMethod as Order['paymentMethod'],
            amountTendered: result.amountTendered,
            changeGiven: result.changeGiven,
            cashierName: result.cashierName,
            status: 'COMPLETED',
            notes: result.notes ?? undefined,
          },
        });
      } catch (prismaErr) {
        console.error('Prisma order transaction error:', prismaErr);
      }
    }

    // 2. Direct Supabase Client
    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { error: orderError } = await supabase.from('orders').insert([
          {
            id: orderId,
            receipt_number: receiptNumber,
            timestamp: completedOrder.timestamp,
            subtotal,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            total,
            payment_method: paymentMethod,
            amount_tendered: amountTendered,
            change_given: changeGiven,
            cashier_name: cashierName,
            status: 'COMPLETED',
            notes,
          },
        ]);

        if (!orderError) {
          if (items.length > 0) {
            const productIds = items
              .map((i) => i.productId)
              .filter((id) => id && !id.startsWith('custom-'));

            const { data: existingProds } = await supabase
              .from('products')
              .select('id')
              .in('id', productIds);

            const existingSet = new Set((existingProds || []).map((p: { id: string }) => p.id));

            const itemRows = items.map((item) => ({
              order_id: orderId,
              product_id: existingSet.has(item.productId) ? item.productId : null,
              product_name: item.productName,
              barcode: item.barcode,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              discount_percent: item.discountPercent,
              total_price: item.totalPrice,
            }));

            await supabase.from('order_items').insert(itemRows);

            // Decrement stock in database in real-time
            for (const item of items) {
              if (existingSet.has(item.productId)) {
                try {
                  const { data: currentProd } = await supabase
                    .from('products')
                    .select('stock')
                    .eq('id', item.productId)
                    .single();

                  if (currentProd) {
                    const newStock = Math.max(0, (currentProd.stock || 0) - item.quantity);
                    await supabase
                      .from('products')
                      .update({ stock: newStock, updated_at: new Date().toISOString() })
                      .eq('id', item.productId);
                  }
                } catch {
                  // continue
                }
              }
            }
          }

          return NextResponse.json({
            success: true,
            source: 'supabase_postgres',
            message: 'Order created and stock decremented in Supabase PostgreSQL',
            data: completedOrder,
          });
        }
      } catch (supabaseErr) {
        console.error('Supabase order creation error:', supabaseErr);
      }
    }

    return NextResponse.json(
      { success: false, error: 'Database connection failed. Unable to record order.' },
      { status: 500 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid order payload' },
      { status: 400 }
    );
  }
}
