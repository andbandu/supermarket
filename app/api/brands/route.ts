import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { Brand } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  if (isPrismaConfigured()) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          b.id,
          b.name,
          b.slug,
          b.description,
          COALESCE(b.origin, 'Sri Lanka') AS origin,
          b.logo,
          b.is_active AS "isActive",
          b.created_at AS "createdAt",
          b.updated_at AS "updatedAt",
          COUNT(p.id)::int AS "productCount"
        FROM brands b
        LEFT JOIN products p ON LOWER(TRIM(p.brand)) = LOWER(TRIM(b.name))
        GROUP BY b.id, b.name, b.slug, b.description, b.origin, b.logo, b.is_active, b.created_at, b.updated_at
        ORDER BY b.name ASC
      `);

      const brands: Brand[] = rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
        description: r.description ? String(r.description) : undefined,
        origin: String(r.origin || 'Sri Lanka'),
        logo: r.logo ? String(r.logo) : undefined,
        isActive: Boolean(r.isActive),
        productCount: Number(r.productCount || 0),
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
      }));

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: brands });
    } catch (err: unknown) {
      console.error('Prisma brands query error:', err);
    }
  }

  // Fallback direct Supabase
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('brands').select('*').order('name', { ascending: true });
      if (!error && data) {
        return NextResponse.json({ success: true, source: 'supabase_postgres', data });
      }
    } catch (err: unknown) {
      console.error('Supabase brands query error:', err);
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
      return NextResponse.json({ success: false, error: 'Brand name is required' }, { status: 400 });
    }

    const slug = (body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) || 'brand-' + Date.now();
    const id = body.id || 'brand-' + slug;
    const description = body.description ? String(body.description).trim() : null;
    const origin = body.origin ? String(body.origin).trim() : 'Sri Lanka';
    const logo = body.logo ? String(body.logo).trim() : null;
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

    if (isPrismaConfigured()) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO brands (id, name, slug, description, origin, logo, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           description = EXCLUDED.description,
           origin = EXCLUDED.origin,
           logo = EXCLUDED.logo,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        id, name, slug, description, origin, logo, isActive
      );

      const created: Brand = {
        id,
        name,
        slug,
        description: description || undefined,
        origin,
        logo: logo || undefined,
        isActive,
        productCount: 0,
      };

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: created });
    }

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase.from('brands').upsert({
        id, name, slug, description, origin, logo, is_active: isActive
      }).select().single();

      if (error) throw error;
      return NextResponse.json({ success: true, source: 'supabase_postgres', data });
    }

    return NextResponse.json({ success: false, error: 'Database connection not available' }, { status: 500 });
  } catch (err: unknown) {
    console.error('Create brand error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to create brand' },
      { status: 500 }
    );
  }
}

