import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { Discount } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  // 1. Prisma ORM (direct SQL query for reliability)
  if (isPrismaConfigured()) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT id, name, code, type, value, scope, target_category, 
               target_product_id, target_product_name,
               min_order_amount, start_date, end_date, is_active, usage_count, 
               description, created_at, updated_at
        FROM discounts
        ORDER BY created_at ASC
      `);

      const formatted: Discount[] = rows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        code: r.code ? String(r.code) : undefined,
        type: r.type as Discount['type'],
        value: Number(r.value),
        scope: (r.scope || 'ORDER') as Discount['scope'],
        targetCategory: r.target_category ? r.target_category : undefined,
        targetProductId: r.target_product_id ? String(r.target_product_id) : undefined,
        targetProductName: r.target_product_name ? String(r.target_product_name) : undefined,
        minOrderAmount: Number(r.min_order_amount ?? 0),
        startDate: r.start_date ? new Date(r.start_date).toISOString() : undefined,
        endDate: r.end_date ? new Date(r.end_date).toISOString() : undefined,
        isActive: Boolean(r.is_active ?? true),
        usageCount: Number(r.usage_count ?? 0),
        description: r.description ? String(r.description) : undefined,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      }));

      return NextResponse.json({
        success: true,
        source: 'prisma_postgresql',
        data: formatted,
      });
    } catch (err) {
      console.error('Prisma discounts get error:', err);
    }
  }

  // 2. Direct Supabase Client
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        const formatted: Discount[] = data.map((r: any) => ({
          id: String(r.id),
          name: String(r.name),
          code: r.code ? String(r.code) : undefined,
          type: r.type as Discount['type'],
          value: Number(r.value),
          scope: (r.scope || 'ORDER') as Discount['scope'],
          targetCategory: r.target_category ? r.target_category : undefined,
          targetProductId: r.target_product_id ? String(r.target_product_id) : undefined,
          targetProductName: r.target_product_name ? String(r.target_product_name) : undefined,
          minOrderAmount: Number(r.min_order_amount ?? 0),
          startDate: r.start_date ? new Date(r.start_date).toISOString() : undefined,
          endDate: r.end_date ? new Date(r.end_date).toISOString() : undefined,
          isActive: Boolean(r.is_active ?? true),
          usageCount: Number(r.usage_count ?? 0),
          description: r.description ? String(r.description) : undefined,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
        }));

        return NextResponse.json({
          success: true,
          source: 'supabase_postgres',
          data: formatted,
        });
      }
    } catch (err) {
      console.error('Supabase discounts get error:', err);
    }
  }

  return NextResponse.json({ success: true, source: 'empty_fallback', data: [] });
}

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const id = body.id || 'disc-' + Date.now().toString().slice(-6);

    const newDiscount: Discount = {
      id,
      name: String(body.name || 'Store Discount').trim(),
      code: body.code ? String(body.code).trim().toUpperCase() : undefined,
      type: body.type || 'PERCENTAGE',
      value: Number(body.value || 0),
      scope: body.scope || 'ORDER',
      targetCategory: body.targetCategory || undefined,
      targetProductId: body.targetProductId ? String(body.targetProductId).trim() : undefined,
      targetProductName: body.targetProductName ? String(body.targetProductName).trim() : undefined,
      minOrderAmount: Number(body.minOrderAmount || 0),
      startDate: body.startDate || new Date().toISOString(),
      endDate: body.endDate || undefined,
      isActive: body.isActive !== false,
      usageCount: 0,
      description: body.description ? String(body.description).trim() : undefined,
    };

    // 1. Prisma ORM
    if (isPrismaConfigured()) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO discounts (id, name, code, type, value, scope, target_category, target_product_id, target_product_name, min_order_amount, start_date, end_date, is_active, usage_count, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             code = EXCLUDED.code,
             type = EXCLUDED.type,
             value = EXCLUDED.value,
             scope = EXCLUDED.scope,
             target_category = EXCLUDED.target_category,
             target_product_id = EXCLUDED.target_product_id,
             target_product_name = EXCLUDED.target_product_name,
             min_order_amount = EXCLUDED.min_order_amount,
             start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date,
             is_active = EXCLUDED.is_active,
             description = EXCLUDED.description,
             updated_at = NOW()`,
          newDiscount.id,
          newDiscount.name,
          newDiscount.code || null,
          newDiscount.type,
          newDiscount.value,
          newDiscount.scope,
          newDiscount.targetCategory || null,
          newDiscount.targetProductId || null,
          newDiscount.targetProductName || null,
          newDiscount.minOrderAmount || 0,
          newDiscount.startDate ? new Date(newDiscount.startDate) : new Date(),
          newDiscount.endDate ? new Date(newDiscount.endDate) : null,
          newDiscount.isActive,
          newDiscount.usageCount,
          newDiscount.description || null
        );

        // If this discount targets a specific item natively, sync discount_price directly to the products table
        if (newDiscount.scope === 'PRODUCT' && newDiscount.targetProductId) {
          const discountPriceVal = newDiscount.isActive ? newDiscount.value : 0;
          await prisma.$executeRawUnsafe(
            `UPDATE products SET discount_price = $1, updated_at = NOW() WHERE id = $2`,
            discountPriceVal,
            newDiscount.targetProductId
          );
        }

        return NextResponse.json({
          success: true,
          source: 'prisma_postgresql',
          data: newDiscount,
        });
      } catch (err) {
        console.error('Prisma create discount error:', err);
      }
    }

    // 2. Direct Supabase Client
    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('discounts').upsert([
          {
            id: newDiscount.id,
            name: newDiscount.name,
            code: newDiscount.code || null,
            type: newDiscount.type,
            value: newDiscount.value,
            scope: newDiscount.scope,
            target_category: newDiscount.targetCategory || null,
            target_product_id: newDiscount.targetProductId || null,
            target_product_name: newDiscount.targetProductName || null,
            min_order_amount: newDiscount.minOrderAmount || 0,
            start_date: newDiscount.startDate || new Date().toISOString(),
            end_date: newDiscount.endDate || null,
            is_active: newDiscount.isActive,
            usage_count: newDiscount.usageCount,
            description: newDiscount.description || null,
          },
        ]);

        if (!error) {
          if (newDiscount.scope === 'PRODUCT' && newDiscount.targetProductId) {
            const discountPriceVal = newDiscount.isActive ? newDiscount.value : 0;
            await supabase
              .from('products')
              .update({ discount_price: discountPriceVal, updated_at: new Date().toISOString() })
              .eq('id', newDiscount.targetProductId);
          }

          return NextResponse.json({
            success: true,
            source: 'supabase_postgres',
            data: newDiscount,
          });
        }
      } catch (err) {
        console.error('Supabase create discount error:', err);
      }
    }

    return NextResponse.json({ success: false, error: 'Database save failed' }, { status: 500 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid request body' },
      { status: 400 }
    );
  }
}

