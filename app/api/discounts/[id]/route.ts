import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;

  if (isPrismaConfigured()) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM discounts WHERE id = $1 LIMIT 1`,
        id
      );
      if (rows && rows.length > 0) {
        return NextResponse.json({ success: true, source: 'prisma_postgresql', data: rows[0] });
      }
    } catch (err) {
      console.error('Prisma discount get error:', err);
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('discounts').select('*').eq('id', id).single();
      if (!error && data) {
        return NextResponse.json({ success: true, source: 'supabase_postgres', data });
      }
    } catch (err) {
      console.error('Supabase discount get error:', err);
    }
  }

  return NextResponse.json({ success: false, error: 'Discount not found' }, { status: 404 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;

  try {
    const body = await request.json();

    if (isPrismaConfigured()) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE discounts SET
             name = COALESCE($2, name),
             code = CASE WHEN $3::boolean THEN $4 ELSE code END,
             type = COALESCE($5, type),
             value = COALESCE($6, value),
             scope = COALESCE($7, scope),
             target_category = CASE WHEN $8::boolean THEN $9 ELSE target_category END,
             target_product_id = CASE WHEN $10::boolean THEN $11 ELSE target_product_id END,
             target_product_name = CASE WHEN $12::boolean THEN $13 ELSE target_product_name END,
             min_order_amount = COALESCE($14, min_order_amount),
             is_active = COALESCE($15, is_active),
             description = CASE WHEN $16::boolean THEN $17 ELSE description END,
             usage_count = CASE WHEN $18::boolean THEN usage_count + $19::int ELSE usage_count END,
             updated_at = NOW()
           WHERE id = $1`,
          id,
          body.name !== undefined ? String(body.name).trim() : null,
          body.code !== undefined,
          body.code ? String(body.code).trim().toUpperCase() : null,
          body.type !== undefined ? String(body.type) : null,
          body.value !== undefined ? Number(body.value) : null,
          body.scope !== undefined ? String(body.scope) : null,
          body.targetCategory !== undefined,
          body.targetCategory || null,
          body.targetProductId !== undefined,
          body.targetProductId || null,
          body.targetProductName !== undefined,
          body.targetProductName || null,
          body.minOrderAmount !== undefined ? Number(body.minOrderAmount) : null,
          body.isActive !== undefined ? Boolean(body.isActive) : null,
          body.description !== undefined,
          body.description || null,
          body.incrementUsage !== undefined,
          body.incrementUsage ? 1 : 0
        );

        // Fetch updated discount to sync product native discount if applicable
        const updatedRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT scope, target_product_id, value, is_active FROM discounts WHERE id = $1 LIMIT 1`,
          id
        );
        if (updatedRows && updatedRows.length > 0) {
          const disc = updatedRows[0];
          if (disc.scope === 'PRODUCT' && disc.target_product_id) {
            const priceVal = disc.is_active ? Number(disc.value) : 0;
            await prisma.$executeRawUnsafe(
              `UPDATE products SET discount_price = $1, updated_at = NOW() WHERE id = $2`,
              priceVal,
              disc.target_product_id
            );
          }
        }

        return NextResponse.json({
          success: true,
          source: 'prisma_postgresql',
          data: { id, ...body },
        });
      } catch (err) {
        console.error('Prisma update discount error:', err);
      }
    }

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      try {
        const updateData: Record<string, unknown> = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.code !== undefined) updateData.code = body.code ? body.code.toUpperCase() : null;
        if (body.type !== undefined) updateData.type = body.type;
        if (body.value !== undefined) updateData.value = Number(body.value);
        if (body.scope !== undefined) updateData.scope = body.scope;
        if (body.targetCategory !== undefined) updateData.target_category = body.targetCategory;
        if (body.targetProductId !== undefined) updateData.target_product_id = body.targetProductId;
        if (body.targetProductName !== undefined) updateData.target_product_name = body.targetProductName;
        if (body.minOrderAmount !== undefined) updateData.min_order_amount = Number(body.minOrderAmount);
        if (body.isActive !== undefined) updateData.is_active = Boolean(body.isActive);
        if (body.description !== undefined) updateData.description = body.description;

        const { data, error } = await supabase.from('discounts').update(updateData).eq('id', id).select().single();
        if (!error) {
          if (data && data.scope === 'PRODUCT' && data.target_product_id) {
            const priceVal = data.is_active ? Number(data.value) : 0;
            await supabase.from('products').update({ discount_price: priceVal }).eq('id', data.target_product_id);
          }
          return NextResponse.json({ success: true, source: 'supabase_postgres', data });
        }
      } catch (err) {
        console.error('Supabase update discount error:', err);
      }
    }

    return NextResponse.json({ success: false, error: 'Database update failed' }, { status: 500 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid request payload' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;

  if (isPrismaConfigured()) {
    try {
      // If this discount targeted an item, reset the item's native discount
      const existingRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT scope, target_product_id FROM discounts WHERE id = $1 LIMIT 1`,
        id
      );
      if (existingRows && existingRows.length > 0) {
        const disc = existingRows[0];
        if (disc.scope === 'PRODUCT' && disc.target_product_id) {
          await prisma.$executeRawUnsafe(
            `UPDATE products SET discount_price = 0, updated_at = NOW() WHERE id = $1`,
            disc.target_product_id
          );
        }
      }

      await prisma.$executeRawUnsafe(`DELETE FROM discounts WHERE id = $1`, id);
      return NextResponse.json({
        success: true,
        source: 'prisma_postgresql',
        message: `Discount ${id} deleted`,
      });
    } catch (err) {
      console.error('Prisma discount delete error:', err);
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data: existing } = await supabase.from('discounts').select('scope, target_product_id').eq('id', id).single();
      if (existing && existing.scope === 'PRODUCT' && existing.target_product_id) {
        await supabase.from('products').update({ discount_price: 0 }).eq('id', existing.target_product_id);
      }
      const { error } = await supabase.from('discounts').delete().eq('id', id);
      if (!error) {
        return NextResponse.json({
          success: true,
          source: 'supabase_postgres',
          message: `Discount ${id} deleted`,
        });
      }
    } catch (err) {
      console.error('Supabase discount delete error:', err);
    }
  }

  return NextResponse.json({ success: false, error: 'Failed to delete discount' }, { status: 500 });
}

