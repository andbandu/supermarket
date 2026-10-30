import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await props.params;

  try {
    const body = await request.json();

    if (isPrismaConfigured()) {
      const existing = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name FROM brands WHERE id = $1 LIMIT 1`,
        id
      );

      const oldName = existing[0]?.name;

      await prisma.$executeRawUnsafe(
        `UPDATE brands SET
           name = COALESCE($2, name),
           slug = COALESCE($3, slug),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           origin = COALESCE($6, origin),
           logo = CASE WHEN $7::boolean THEN $8 ELSE logo END,
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
         WHERE id = $1`,
        id,
        body.name ? String(body.name).trim() : null,
        body.slug ? String(body.slug).trim() : null,
        body.description !== undefined,
        body.description ? String(body.description).trim() : null,
        body.origin ? String(body.origin).trim() : null,
        body.logo !== undefined,
        body.logo ? String(body.logo).trim() : null,
        body.isActive !== undefined ? Boolean(body.isActive) : null
      );

      // If brand was renamed, propagate to existing products with that brand
      if (oldName && body.name && body.name.trim() !== oldName) {
        await prisma.$executeRawUnsafe(
          `UPDATE products SET brand = $1 WHERE LOWER(TRIM(brand)) = LOWER(TRIM($2))`,
          body.name.trim(),
          oldName
        );
      }

      return NextResponse.json({ success: true, message: 'Brand updated successfully' });
    }

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('brands').update({
        name: body.name,
        slug: body.slug,
        description: body.description,
        origin: body.origin,
        logo: body.logo,
        is_active: body.isActive,
      }).eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Brand updated successfully' });
    }

    return NextResponse.json({ success: false, error: 'Database connection not available' }, { status: 500 });
  } catch (err: unknown) {
    console.error('Update brand error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update brand' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await props.params;

  try {
    if (isPrismaConfigured()) {
      await prisma.$executeRawUnsafe(`DELETE FROM brands WHERE id = $1`, id);
      return NextResponse.json({ success: true, message: 'Brand deleted successfully' });
    }

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Brand deleted' });
    }

    return NextResponse.json({ success: false, error: 'Database connection not available' }, { status: 500 });
  } catch (err: unknown) {
    console.error('Delete brand error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to delete brand' },
      { status: 500 }
    );
  }
}

