import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { Category } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  if (isPrismaConfigured()) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          c.id,
          c.name,
          c.slug,
          c.description,
          COALESCE(c.icon_name, 'Package') AS "iconName",
          COALESCE(c.color, 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30') AS color,
          c.is_active AS "isActive",
          c.created_at AS "createdAt",
          c.updated_at AS "updatedAt",
          COUNT(p.id)::int AS "productCount"
        FROM categories c
        LEFT JOIN products p ON p.category = c.name
        GROUP BY c.id, c.name, c.slug, c.description, c.icon_name, c.color, c.is_active, c.created_at, c.updated_at
        ORDER BY c.name ASC
      `);

      const categories: Category[] = rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
        description: r.description ? String(r.description) : undefined,
        iconName: String(r.iconName || 'Package'),
        color: String(r.color),
        isActive: Boolean(r.isActive),
        productCount: Number(r.productCount || 0),
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
      }));

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: categories });
    } catch (err: unknown) {
      console.error('Prisma categories query error:', err);
    }
  }

  // Fallback direct Supabase
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
      if (!error && data) {
        return NextResponse.json({ success: true, source: 'supabase_postgres', data });
      }
    } catch (err: unknown) {
      console.error('Supabase categories query error:', err);
    }
  }

  return NextResponse.json({ success: true, source: 'empty_fallback', data: [] });
}

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 });
    }

    const slug = (body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) || 'cat-' + Date.now();
    const id = body.id || 'cat-' + slug;
    const description = body.description ? String(body.description).trim() : null;
    const iconName = body.iconName ? String(body.iconName) : 'Package';
    const color = body.color ? String(body.color) : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

    if (isPrismaConfigured()) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO categories (id, name, slug, description, icon_name, color, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           description = EXCLUDED.description,
           icon_name = EXCLUDED.icon_name,
           color = EXCLUDED.color,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        id, name, slug, description, iconName, color, isActive
      );

      const created: Category = {
        id,
        name,
        slug,
        description: description || undefined,
        iconName,
        color,
        isActive,
        productCount: 0,
      };

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: created });
    }

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase.from('categories').upsert({
        id, name, slug, description, icon_name: iconName, color, is_active: isActive
      }).select().single();

      if (error) throw error;
      return NextResponse.json({ success: true, source: 'supabase_postgres', data });
    }

    return NextResponse.json({ success: false, error: 'Database connection not available' }, { status: 500 });
  } catch (err: unknown) {
    console.error('Create category error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to create category' },
      { status: 500 }
    );
  }
}

