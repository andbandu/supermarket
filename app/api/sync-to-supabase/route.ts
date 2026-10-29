import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { readLocalDb } from '@/lib/localDb';

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const prismaReady = isPrismaConfigured();
  const supabaseReady = isSupabaseConfigured();

  if (!prismaReady && !supabaseReady) {
    return NextResponse.json({
      success: false,
      error: 'No database configured. Please add DATABASE_URL or Supabase keys to .env.local',
      help: 'Retrieve DATABASE_URL from Supabase Project Settings -> Database',
    }, { status: 400 });
  }

  const localDb = readLocalDb();
  const orders = localDb.orders || [];
  const products = localDb.products || [];

  let syncedOrdersCount = 0;
  let syncedProductsCount = 0;

  // 1. Sync via Prisma ORM
  if (prismaReady) {
    try {
      // Sync products first
      for (const p of products) {
        await prisma.product.upsert({
          where: { id: p.id },
          update: {
            barcode: p.barcode,
            name: p.name,
            category: p.category,
            price: p.price,
            costPrice: p.costPrice,
            stock: p.stock,
            reorderLevel: p.reorderLevel,
            unit: p.unit,
            isTaxable: p.isTaxable,
          },
          create: {
            id: p.id,
            barcode: p.barcode,
            name: p.name,
            category: p.category,
            price: p.price,
            costPrice: p.costPrice,
            stock: p.stock,
            reorderLevel: p.reorderLevel,
            unit: p.unit,
            isTaxable: p.isTaxable,
          },
        });
        syncedProductsCount++;
      }

      // Sync orders
      for (const order of orders) {
        const existing = await prisma.order.findUnique({
          where: { id: order.id },
        });

        if (!existing) {
          await prisma.order.create({
            data: {
              id: order.id,
              receiptNumber: order.receiptNumber,
              timestamp: new Date(order.timestamp),
              subtotal: order.subtotal,
              discountAmount: order.discountAmount,
              taxAmount: order.taxAmount,
              total: order.total,
              paymentMethod: order.paymentMethod,
              amountTendered: order.amountTendered,
              changeGiven: order.changeGiven,
              cashierName: order.cashierName,
              status: order.status,
              refundReason: order.refundReason,
              notes: order.notes,
              items: {
                create: order.items.map((i) => ({
                  productId: i.productId.startsWith('custom-') ? null : i.productId,
                  productName: i.productName,
                  barcode: i.barcode,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  discountPercent: i.discountPercent,
                  totalPrice: i.totalPrice,
                })),
              },
            },
          });
          syncedOrdersCount++;
        }
      }

      return NextResponse.json({
        success: true,
        source: 'prisma_postgresql',
        message: `Successfully synced ${syncedOrdersCount} orders and ${syncedProductsCount} products to Supabase PostgreSQL via Prisma.`,
        data: { syncedOrdersCount, syncedProductsCount },
      });
    } catch (err: unknown) {
      console.error('Prisma sync error:', err);
      return NextResponse.json({
        success: false,
        error: err instanceof Error ? err.message : 'Prisma sync failed',
      }, { status: 500 });
    }
  }

  // 2. Sync via Supabase Client
  const supabase = getSupabaseAdmin();
  if (supabase && supabaseReady) {
    try {
      for (const p of products) {
        await supabase.from('products').upsert({
          id: p.id,
          barcode: p.barcode,
          name: p.name,
          category: p.category,
          price: p.price,
          cost_price: p.costPrice,
          stock: p.stock,
          reorder_level: p.reorderLevel,
          unit: p.unit,
          is_taxable: p.isTaxable,
        });
        syncedProductsCount++;
      }

      for (const order of orders) {
        const { data: existing } = await supabase
          .from('orders')
          .select('id')
          .eq('id', order.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('orders').insert({
            id: order.id,
            receipt_number: order.receiptNumber,
            timestamp: order.timestamp,
            subtotal: order.subtotal,
            discount_amount: order.discountAmount,
            tax_amount: order.taxAmount,
            total: order.total,
            payment_method: order.paymentMethod,
            amount_tendered: order.amountTendered,
            change_given: order.changeGiven,
            cashier_name: order.cashierName,
            status: order.status,
            notes: order.notes,
          });

          if (order.items && order.items.length > 0) {
            await supabase.from('order_items').insert(
              order.items.map((i) => ({
                order_id: order.id,
                product_id: i.productId.startsWith('custom-') ? null : i.productId,
                product_name: i.productName,
                barcode: i.barcode,
                quantity: i.quantity,
                unit_price: i.unitPrice,
                discount_percent: i.discountPercent,
                total_price: i.totalPrice,
              }))
            );
          }
          syncedOrdersCount++;
        }
      }

      return NextResponse.json({
        success: true,
        source: 'supabase_postgres',
        message: `Successfully synced ${syncedOrdersCount} orders to Supabase PostgreSQL.`,
        data: { syncedOrdersCount, syncedProductsCount },
      });
    } catch (err: unknown) {
      return NextResponse.json({
        success: false,
        error: err instanceof Error ? err.message : 'Supabase sync failed',
      }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, error: 'Database sync could not proceed' }, { status: 500 });
}

