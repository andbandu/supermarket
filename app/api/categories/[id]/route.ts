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
      // Check existing category to handle cascading name update in products
      const existing = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name FROM categories WHERE id = $1 LIMIT 1`,
        id
      );

      const oldName = existing[0]?.name;

      await prisma.$executeRawUnsafe(
        `UPDATE categories SET
           name = COALESCE($2, name),
           slug = COALESCE($3, slug),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           icon_name = COALESCE($6, icon_name),
           color = COALESCE($7, color),
           is_active = COALESCE($8, is_active),
           updated_at = NOW()
         WHERE id = $1`,
        id,
        body.name ? String(body.name).trim() : null,
        body.slug ? String(body.slug).trim() : null,
        body.description !== undefined,
        body.description ? String(body.description).trim() : null,
        body.iconName ? String(body.iconName) : null,
        body.color ? String(body.color) : null,
        body.isActive !== undefined ? Boolean(body.isActive) : null
      );

      // If category name was renamed, propagate name to existing products in this category
      if (oldName && body.name && body.name.trim() !== oldName) {
        await prisma.$executeRawUnsafe(
          `UPDATE products SET category = $1 WHERE category = $2`,
          body.name.trim(),
          oldName
        );
      }

      return NextResponse.json({ success: true, message: 'Category updated successfully' });
    }

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('categories').update({
        name: body.name,
        slug: body.slug,
        description: body.description,
        icon_name: body.iconName,
        color: body.color,
        is_active: body.isActive,
      }).eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Category updated successfully' });
    }

    return NextResponse.json({ success: false, error: 'Database connection not available' }, { status: 500 });
  } catch (err: unknown) {
    console.error('Update category error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update category' },
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
      // Find category name
      const existing = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name FROM categories WHERE id = $1 LIMIT 1`,
        id
      );
      const catName = existing[0]?.name;

      // Delete category
      await prisma.$executeRawUnsafe(`DELETE FROM categories WHERE id = $1`, id);

      // If products exist under this category, fallback to 'Essentials' or 'Uncategorized'
      if (catName) {
        await prisma.$executeRawUnsafe(
          `UPDATE products SET category = 'Essentials' WHERE category = $1`,
          catName
        );
      }

      return NextResponse.json({ success: true, message: 'Category deleted successfully' });
    }

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Category deleted' });
    }

    return NextResponse.json({ success: false, error: 'Database connection not available' }, { status: 500 });
  } catch (err: unknown) {
    console.error('Delete category error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to delete category' },
      { status: 500 }
    );
  }
}

