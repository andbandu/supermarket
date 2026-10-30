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
      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT id, barcode, name, category, price, cost_price, stock, reorder_level, unit, 
               brand, image, images, color, icon_name, is_taxable,
               COALESCE(discount_price, 0.0) AS discount_price
        FROM products 
        WHERE id = $1 
        LIMIT 1
      `, id);

      if (rows && rows.length > 0) {
        const p = rows[0];
        const formatted = {
          id: String(p.id),
          barcode: String(p.barcode),
          name: String(p.name),
          category: p.category,
          price: Number(p.price),
          costPrice: Number(p.cost_price ?? 0),
          stock: Number(p.stock),
          reorderLevel: Number(p.reorder_level ?? 5),
          unit: String(p.unit ?? 'pcs'),
          brand: p.brand ? String(p.brand) : undefined,
          image: p.image ? String(p.image) : (Array.isArray(p.images) && p.images[0] ? String(p.images[0]) : undefined),
          images: Array.isArray(p.images) ? p.images : [],
          color: p.color ? String(p.color) : undefined,
          iconName: p.icon_name ? String(p.icon_name) : undefined,
          isTaxable: Boolean(p.is_taxable ?? true),
          discountPrice: Number(p.discount_price ?? 0),
        };
        return NextResponse.json({ success: true, source: 'prisma_postgresql', data: formatted });
      }
    } catch (err: unknown) {
      console.error('Prisma product get error:', err);
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (!error && data) {
        return NextResponse.json({ success: true, source: 'supabase_postgres', data });
      }
    } catch (err) {
      console.error('Supabase product get error:', err);
    }
  }

  return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.barcode !== undefined) updateData.barcode = body.barcode;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.price !== undefined) updateData.price = Number(body.price);
  if (body.costPrice !== undefined) updateData.costPrice = Number(body.costPrice);
  if (body.stock !== undefined) updateData.stock = Number(body.stock);
  if (body.reorderLevel !== undefined) updateData.reorderLevel = Number(body.reorderLevel);
  if (body.unit !== undefined) updateData.unit = body.unit;
  if (body.brand !== undefined) updateData.brand = body.brand ? String(body.brand).trim() : null;
  if (body.image !== undefined) updateData.image = body.image ? String(body.image) : null;
  if (body.images !== undefined) {
    const rawImages = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
    updateData.images = rawImages.slice(0, 4);
    if (!updateData.image && rawImages.length > 0) {
      updateData.image = rawImages[0];
    }
  }
  if (body.isTaxable !== undefined) updateData.isTaxable = Boolean(body.isTaxable);
  if (body.discountPrice !== undefined) updateData.discountPrice = Number(body.discountPrice);

  // 1. Prisma ORM (via direct SQL to support brand, image, and images array)
  if (isPrismaConfigured()) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE products SET
           name = COALESCE($2, name),
           barcode = COALESCE($3, barcode),
           category = COALESCE($4, category),
           price = COALESCE($5, price),
           cost_price = COALESCE($6, cost_price),
           stock = COALESCE($7, stock),
           reorder_level = COALESCE($8, reorder_level),
           unit = COALESCE($9, unit),
           brand = CASE WHEN $10::boolean THEN $11 ELSE brand END,
           image = CASE WHEN $12::boolean THEN $13 ELSE image END,
           images = CASE WHEN $14::boolean THEN $15::text[] ELSE images END,
           is_taxable = COALESCE($16, is_taxable),
           discount_price = COALESCE($17, discount_price),
           updated_at = NOW()
         WHERE id = $1`,
        id,
        body.name !== undefined ? String(body.name) : null,
        body.barcode !== undefined ? String(body.barcode) : null,
        body.category !== undefined ? String(body.category) : null,
        body.price !== undefined ? Number(body.price) : null,
        body.costPrice !== undefined ? Number(body.costPrice) : null,
        body.stock !== undefined ? Number(body.stock) : null,
        body.reorderLevel !== undefined ? Number(body.reorderLevel) : null,
        body.unit !== undefined ? String(body.unit) : null,
        body.brand !== undefined,
        body.brand ? String(body.brand).trim() : null,
        (body.image !== undefined || body.images !== undefined),
        updateData.image ? String(updateData.image) : null,
        body.images !== undefined,
        (updateData.images as string[]) || [],
        body.isTaxable !== undefined ? Boolean(body.isTaxable) : null,
        body.discountPrice !== undefined ? Number(body.discountPrice) : null
      );

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: { id, ...updateData } });
    } catch (err: unknown) {
      console.error('Prisma update product error:', err);
    }
  }

  // 2. Direct Supabase Client
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const supaUpdate: Record<string, unknown> = { ...updateData };
      if ('costPrice' in supaUpdate) {
        supaUpdate.cost_price = supaUpdate.costPrice;
        delete supaUpdate.costPrice;
      }
      if ('reorderLevel' in supaUpdate) {
        supaUpdate.reorder_level = supaUpdate.reorderLevel;
        delete supaUpdate.reorderLevel;
      }
      if ('isTaxable' in supaUpdate) {
        supaUpdate.is_taxable = supaUpdate.isTaxable;
        delete supaUpdate.isTaxable;
      }
      if ('discountPrice' in supaUpdate) {
        supaUpdate.discount_price = supaUpdate.discountPrice;
        delete supaUpdate.discountPrice;
      }
      const { data, error } = await supabase.from('products').update(supaUpdate).eq('id', id).select().single();
      if (!error) {
        return NextResponse.json({ success: true, source: 'supabase_postgres', data });
      }
    } catch (err) {
      console.error('Supabase update product error:', err);
    }
  }

  return NextResponse.json({ success: false, error: 'Database update failed' }, { status: 500 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;
  const body = await request.json();
  const restockAmount = Number(body.restockAmount || 0);

  if (isPrismaConfigured()) {
    try {
      const updated = await prisma.product.update({
        where: { id },
        data: {
          stock: { increment: restockAmount },
        },
      });

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: updated });
    } catch (err: unknown) {
      console.error('Prisma restock error:', err);
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', id).single();
      if (prod) {
        const newStock = (prod.stock || 0) + restockAmount;
        const { data: updated, error } = await supabase
          .from('products')
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (!error) {
          return NextResponse.json({ success: true, source: 'supabase_postgres', data: updated });
        }
      }
    } catch (err) {
      console.error('Supabase restock error:', err);
    }
  }

  return NextResponse.json({ success: false, error: 'Restock failed in database' }, { status: 500 });
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
      await prisma.product.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, source: 'prisma_postgresql', message: `Product ${id} deleted` });
    } catch (err: unknown) {
      console.error('Prisma delete error:', err);
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) {
        return NextResponse.json({ success: true, source: 'supabase_postgres', message: `Product ${id} deleted` });
      }
    } catch (err) {
      console.error('Supabase delete error:', err);
    }
  }

  return NextResponse.json({ success: false, error: 'Delete failed in database' }, { status: 500 });
}
