import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { Product } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  // 1. Prisma ORM (PostgreSQL) - Use direct SQL to guarantee brand, image, and images array support
  if (isPrismaConfigured()) {
    try {
      const dbProducts = await prisma.$queryRawUnsafe<any[]>(`
        SELECT id, barcode, name, category, price, cost_price, stock, reorder_level, unit, 
               brand, image, images, color, icon_name, is_taxable 
        FROM products 
        ORDER BY name ASC
      `);

      const formatted: Product[] = dbProducts.map((p: any) => ({
        id: String(p.id),
        barcode: String(p.barcode),
        name: String(p.name),
        category: p.category as Product['category'],
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
      }));

      return NextResponse.json({
        success: true,
        source: 'prisma_postgresql',
        data: formatted,
      });
    } catch (err) {
      console.error('Prisma product query error:', err);
    }
  }

  // 2. Direct Supabase Client
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        const formatted: Product[] = data.map((row: any) => ({
          id: String(row.id),
          barcode: String(row.barcode),
          name: String(row.name),
          category: row.category as Product['category'],
          price: Number(row.price),
          costPrice: Number(row.cost_price ?? 0),
          stock: Number(row.stock),
          reorderLevel: Number(row.reorder_level ?? 5),
          unit: String(row.unit ?? 'pcs'),
          brand: row.brand ? String(row.brand) : undefined,
          image: row.image ? String(row.image) : (row.images?.[0] ? String(row.images[0]) : undefined),
          images: Array.isArray(row.images) ? row.images : [],
          color: row.color ? String(row.color) : undefined,
          iconName: row.icon_name ? String(row.icon_name) : undefined,
          isTaxable: Boolean(row.is_taxable ?? true),
        }));

        return NextResponse.json({
          success: true,
          source: 'supabase_postgres',
          data: formatted,
        });
      }
    } catch (err) {
      console.error('Supabase product query error:', err);
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
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const id = body.id || 'prod-' + Date.now().toString().slice(-6);

    const rawImages: string[] = Array.isArray(body.images)
      ? body.images.filter((img: unknown): img is string => typeof img === 'string' && img.trim().length > 0)
      : body.image
      ? [String(body.image)]
      : [];
    const images = rawImages.slice(0, 4);
    const image = images[0] || (body.image ? String(body.image) : undefined);
    const brand = body.brand ? String(body.brand).trim() : undefined;

    const newProduct: Product = {
      id,
      barcode: String(body.barcode),
      name: String(body.name),
      category: body.category || 'Beverages',
      price: Number(body.price || 0),
      costPrice: Number(body.costPrice || 0),
      stock: Number(body.stock || 0),
      reorderLevel: Number(body.reorderLevel || 5),
      unit: body.unit || 'pcs',
      brand,
      image,
      images,
      color: body.color || 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      iconName: body.iconName || 'Package',
      isTaxable: body.isTaxable !== false,
    };

    // 1. Prisma ORM (via parameterized raw SQL for 100% robust array, brand, and image support)
    if (isPrismaConfigured()) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO products (id, barcode, name, category, price, cost_price, stock, reorder_level, unit, brand, image, images, color, icon_name, is_taxable, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET
             barcode = EXCLUDED.barcode,
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             price = EXCLUDED.price,
             cost_price = EXCLUDED.cost_price,
             stock = EXCLUDED.stock,
             reorder_level = EXCLUDED.reorder_level,
             unit = EXCLUDED.unit,
             brand = EXCLUDED.brand,
             image = EXCLUDED.image,
             images = EXCLUDED.images,
             color = EXCLUDED.color,
             icon_name = EXCLUDED.icon_name,
             is_taxable = EXCLUDED.is_taxable,
             updated_at = NOW()`,
          newProduct.id,
          newProduct.barcode,
          newProduct.name,
          newProduct.category,
          newProduct.price,
          newProduct.costPrice,
          newProduct.stock,
          newProduct.reorderLevel,
          newProduct.unit,
          newProduct.brand || null,
          newProduct.image || null,
          newProduct.images || [],
          newProduct.color || null,
          newProduct.iconName || null,
          newProduct.isTaxable
        );

        return NextResponse.json({
          success: true,
          source: 'prisma_postgresql',
          message: 'Product created successfully in PostgreSQL via Prisma',
          data: newProduct,
        });
      } catch (err) {
        console.error('Prisma create product error:', err);
      }
    }

    // 2. Direct Supabase Client
    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('products').upsert([
          {
            id: newProduct.id,
            barcode: newProduct.barcode,
            name: newProduct.name,
            category: newProduct.category,
            price: newProduct.price,
            cost_price: newProduct.costPrice,
            stock: newProduct.stock,
            reorder_level: newProduct.reorderLevel,
            unit: newProduct.unit,
            brand: newProduct.brand || null,
            image: newProduct.image || null,
            images: newProduct.images || [],
            color: newProduct.color,
            icon_name: newProduct.iconName,
            is_taxable: newProduct.isTaxable,
          },
        ]);

        if (!error) {
          return NextResponse.json({
            success: true,
            source: 'supabase_postgres',
            message: 'Product created in Supabase PostgreSQL',
            data: newProduct,
          });
        } else {
          console.error('Supabase product upsert error:', error);
        }
      } catch (err) {
        console.error('Supabase create product error:', err);
      }
    }

    return NextResponse.json(
      { success: false, error: 'Database connection failed. Unable to create product.' },
      { status: 500 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid request payload' },
      { status: 400 }
    );
  }
}
