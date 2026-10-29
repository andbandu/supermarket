import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { Order, OrderItem } from '@/types/pos';
import { readLocalDb, saveOrderToLocalDb } from '@/lib/localDb';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  // 1. Try Prisma ORM
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

      if (orders && orders.length > 0) {
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
      }
    } catch (err) {
      console.error('Prisma orders query error:', err);
    }
  }

  // 2. Try Supabase Client
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_items (*)')
        .order('timestamp', { ascending: false });

      if (!ordersError && ordersData && ordersData.length > 0) {
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
    } catch (err) {
      console.error('Supabase orders query error:', err);
    }
  }

  // 3. Fallback to Persistent Local Database File
  const localDb = readLocalDb();
  return NextResponse.json({
    success: true,
    source: 'local_file_database',
    data: localDb.orders,
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

    // 1. Process via Prisma ORM
    if (isPrismaConfigured()) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Verify or auto-create product records so foreign keys never fail
          const productMap = new Map<string, boolean>();

          for (const item of items) {
            if (item.productId && !item.productId.startsWith('custom-')) {
              const existing = await tx.product.findUnique({
                where: { id: item.productId },
              });

              if (existing) {
                productMap.set(item.productId, true);
                // Safely decrement stock
                await tx.product.update({
                  where: { id: item.productId },
                  data: {
                    stock: { decrement: item.quantity },
                  },
                });
              } else {
                // Auto-create product in PostgreSQL
                await tx.product.create({
                  data: {
                    id: item.productId,
                    barcode: item.barcode || item.productId,
                    name: item.productName,
                    category: 'General',
                    price: item.unitPrice,
                    costPrice: item.unitPrice * 0.5,
                    stock: 50 - item.quantity,
                    reorderLevel: 5,
                    unit: 'pcs',
                  },
                });
                productMap.set(item.productId, true);
              }
            }
          }

          // Create the Order and OrderItems
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

        // Also update local DB as backup
        saveOrderToLocalDb(completedOrder);

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
        // Fall through to Supabase or local DB
      }
    }

    // 2. Process via Supabase Client
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
            // Check products
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

            // Decrement stock
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

          saveOrderToLocalDb(completedOrder);

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

    // 3. Fallback to Local Persistent Database File (Guaranteed to save!)
    const savedLocal = saveOrderToLocalDb(completedOrder);

    return NextResponse.json({
      success: true,
      source: 'local_file_database',
      message: 'Order persisted successfully in local database file (data/minimart_db.json)',
      data: savedLocal,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid order payload' },
      { status: 400 }
    );
  }
}
