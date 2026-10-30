import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { Order, OrderItem } from '@/types/pos';

// Safe select fields for Prisma queries to prevent selecting dropped/normalized columns (e.g. customer_name)
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

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { searchParams } = new URL(request.url);
  const sourceFilter = searchParams.get('source'); // 'POS' | 'ONLINE' | null
  const statusFilter = searchParams.get('status');

  // 1. Prisma ORM (Primary PostgreSQL connection)
  if (isPrismaConfigured()) {
    try {
      const whereClause: any = {};
      if (sourceFilter === 'POS') {
        whereClause.orderSource = 'POS';
      } else if (sourceFilter === 'ONLINE') {
        whereClause.orderSource = { not: 'POS' };
      }
      if (statusFilter) {
        whereClause.fulfillmentStatus = statusFilter;
      }

      const orders = await prisma.order.findMany({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        select: orderPrismaSelect,
        orderBy: {
          timestamp: 'desc',
        },
      });

      const formatted: Order[] = orders.map((o: any) => {
        const items: OrderItem[] = o.items.map((item: any) => ({
          productId: item.productId || '',
          productName: item.productName,
          barcode: item.barcode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          totalPrice: item.totalPrice,
        }));

        const calculatedGross = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

        return {
          id: o.id,
          receiptNumber: o.receiptNumber,
          timestamp: o.timestamp.toISOString(),
          items,
          grossAmount: o.grossAmount != null ? Number(o.grossAmount) : Number(calculatedGross.toFixed(2)),
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

          // Unified Online Orders extensions
          orderSource: (o.orderSource as Order['orderSource']) || 'POS',
          orderType: (o.orderType as Order['orderType']) || 'IN_STORE',
          fulfillmentStatus: (o.fulfillmentStatus as Order['fulfillmentStatus']) || 'COMPLETED',
          customerId: o.customerId ?? undefined,
          customerName: o.customer?.name ?? undefined,
          customerPhone: o.customer?.phone ?? undefined,
          customerEmail: o.customer?.email ?? undefined,
          deliveryAddress: o.deliveryAddress ?? o.customer?.address ?? undefined,
          deliveryCity: o.deliveryCity ?? o.customer?.city ?? undefined,
          deliveryFee: o.deliveryFee != null ? Number(o.deliveryFee) : 0,
          paymentStatus: (o.paymentStatus as Order['paymentStatus']) || 'PAID',
          estimatedTime: o.estimatedTime ?? undefined,
          customerNotes: o.customerNotes ?? undefined,
          customer: o.customer
            ? {
                id: o.customer.id,
                name: o.customer.name,
                phone: o.customer.phone,
                email: o.customer.email ?? undefined,
                address: o.customer.address ?? undefined,
                city: o.customer.city ?? undefined,
                defaultAddress: o.customer.defaultAddress ?? undefined,
                totalOrders: o.customer.totalOrders,
                totalSpent: o.customer.totalSpent,
              }
            : undefined,
          updatedAt: o.updatedAt ? o.updatedAt.toISOString() : undefined,
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
      let query = supabase
        .from('orders')
        .select('*, order_items(*), online_customers(*)')
        .order('timestamp', { ascending: false });

      if (sourceFilter === 'POS') {
        query = query.eq('order_source', 'POS');
      } else if (sourceFilter === 'ONLINE') {
        query = query.neq('order_source', 'POS');
      }
      if (statusFilter) {
        query = query.eq('fulfillment_status', statusFilter);
      }

      const { data: ordersData, error: ordersError } = await query;

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

          const calculatedGross = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

          return {
            id: String(o.id),
            receiptNumber: String(o.receipt_number),
            timestamp: String(o.timestamp),
            items,
            grossAmount: o.gross_amount != null ? Number(o.gross_amount) : Number(calculatedGross.toFixed(2)),
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

            // Unified Online Orders extensions
            orderSource: (o.order_source as Order['orderSource']) || 'POS',
            orderType: (o.order_type as Order['orderType']) || 'IN_STORE',
            fulfillmentStatus: (o.fulfillment_status as Order['fulfillmentStatus']) || 'COMPLETED',
            customerId: o.customer_id ? String(o.customer_id) : undefined,
            customerName: o.online_customers?.name ? String(o.online_customers.name) : undefined,
            customerPhone: o.online_customers?.phone ? String(o.online_customers.phone) : undefined,
            customerEmail: o.online_customers?.email ? String(o.online_customers.email) : undefined,
            deliveryAddress: o.delivery_address ? String(o.delivery_address) : undefined,
            deliveryCity: o.delivery_city ? String(o.delivery_city) : undefined,
            deliveryFee: o.delivery_fee != null ? Number(o.delivery_fee) : 0,
            paymentStatus: (o.payment_status as Order['paymentStatus']) || 'PAID',
            estimatedTime: o.estimated_time ? String(o.estimated_time) : undefined,
            customerNotes: o.customer_notes ? String(o.customer_notes) : undefined,
            updatedAt: o.updated_at ? String(o.updated_at) : undefined,
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
    const orderSource: Order['orderSource'] = body.orderSource || 'POS';
    const orderType: Order['orderType'] = body.orderType || (orderSource === 'POS' ? 'IN_STORE' : 'DELIVERY');
    const fulfillmentStatus: Order['fulfillmentStatus'] =
      body.fulfillmentStatus || (orderSource === 'POS' ? 'COMPLETED' : 'PENDING');

    const prefix = orderSource === 'MOBILE_APP' ? 'APP' : orderSource === 'STOREFRONT' ? 'WEB' : 'REC';
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const receiptNumber =
      body.receiptNumber ||
      `${prefix}-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const items: OrderItem[] = body.items || [];
    const subtotal = Number(body.subtotal || 0);
    const discountAmount = Number(body.discountAmount || 0);
    const taxAmount = Number(body.taxAmount || 0);
    const deliveryFee = Number(body.deliveryFee || 0);
    const total = Number(body.total || subtotal + deliveryFee - discountAmount + taxAmount);
    const paymentMethod = body.paymentMethod || 'CASH';
    const paymentStatus: Order['paymentStatus'] =
      body.paymentStatus || (paymentMethod === 'CASH' && orderSource !== 'POS' ? 'UNPAID' : 'PAID');
    const amountTendered = Number(body.amountTendered || (paymentStatus === 'PAID' ? total : 0));
    const changeGiven = Number(body.changeGiven || 0);
    const cashierName = body.cashierName || (orderSource === 'POS' ? 'Cashier' : 'Online Platform');
    const notes = body.notes;
    const grossAmount = Number(
      body.grossAmount ||
      items.reduce((sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0), 0) ||
      subtotal
    );

    let customerId = body.customerId || null;
    let customerName = body.customerName || null;
    let customerPhone = body.customerPhone || null;
    let customerEmail = body.customerEmail || null;
    let deliveryAddress = body.deliveryAddress || null;
    let deliveryCity = body.deliveryCity || null;
    const estimatedTime = body.estimatedTime || null;
    const customerNotes = body.customerNotes || null;

    // Relational normalization: Link customer_id to online_customers
    if (isPrismaConfigured()) {
      try {
        if (!customerId && customerPhone) {
          const existingCust = await prisma.onlineCustomer.findUnique({
            where: { phone: customerPhone },
          });
          if (existingCust) {
            customerId = existingCust.id;
            customerName = customerName || (existingCust as any).name;
            customerEmail = customerEmail || (existingCust as any).email;
            deliveryAddress = deliveryAddress || (existingCust as any).address;
            deliveryCity = deliveryCity || (existingCust as any).city;
          } else if (customerName) {
            const newCust = await (prisma.onlineCustomer as any).create({
              data: {
                id: 'cust-' + Date.now(),
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
                address: deliveryAddress,
                city: deliveryCity,
                defaultAddress: deliveryAddress && deliveryCity ? `${deliveryAddress}, ${deliveryCity}` : deliveryAddress,
              },
            });
            customerId = newCust.id;
          }
        }
      } catch (custLinkErr) {
        console.warn('Customer relational normalization notice:', custLinkErr);
      }
    }

    const completedOrder: Order = {
      id: orderId,
      receiptNumber,
      timestamp: body.timestamp || new Date().toISOString(),
      items,
      grossAmount,
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
      orderSource,
      orderType,
      fulfillmentStatus,
      customerId: customerId ?? undefined,
      customerName: customerName ?? undefined,
      customerPhone: customerPhone ?? undefined,
      customerEmail: customerEmail ?? undefined,
      deliveryAddress: deliveryAddress ?? undefined,
      deliveryCity: deliveryCity ?? undefined,
      deliveryFee,
      paymentStatus,
      estimatedTime: estimatedTime ?? undefined,
      customerNotes: customerNotes ?? undefined,
    };

    // 1. Process via Prisma ORM (Atomic Transaction)
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

          // If customer provided, update their total spent & orders count
          if (customerId) {
            try {
              await tx.onlineCustomer.update({
                where: { id: customerId },
                data: {
                  totalOrders: { increment: 1 },
                  totalSpent: { increment: total },
                },
              });
            } catch (custErr) {
              console.warn('Customer stats update error:', custErr);
            }
          }

          // Create the unified Order with all OrderItems
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
              grossAmount,
              orderSource,
              orderType,
              fulfillmentStatus,
              customerId,
              deliveryAddress,
              deliveryCity,
              deliveryFee,
              paymentStatus,
              estimatedTime,
              customerNotes,
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
            } as any,
            select: orderPrismaSelect,
          });

          return createdOrder;
        });

        return NextResponse.json({
          success: true,
          source: 'prisma_postgresql',
          message: 'Order created in PostgreSQL via Prisma',
          data: {
            ...completedOrder,
            id: result.id,
            receiptNumber: result.receiptNumber,
            timestamp: result.timestamp.toISOString(),
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
            gross_amount: grossAmount,
            order_source: orderSource,
            order_type: orderType,
            fulfillment_status: fulfillmentStatus,
            customer_id: customerId,
            delivery_address: deliveryAddress,
            delivery_city: deliveryCity,
            delivery_fee: deliveryFee,
            payment_status: paymentStatus,
            estimated_time: estimatedTime,
            customer_notes: customerNotes,
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
            message: 'Order created in Supabase PostgreSQL',
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
