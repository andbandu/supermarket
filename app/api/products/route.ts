import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { readLocalDb, writeLocalDb } from '@/lib/localDb';
import { Product } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  // 1. Try Prisma ORM
  if (isPrismaConfigured()) {
    try {
      const dbProducts = await prisma.product.findMany({
        orderBy: { name: 'asc' },
      });

      if (dbProducts.length > 0) {
        const formatted: Product[] = dbProducts.map((p) => ({
          id: p.id,
          barcode: p.barcode,
          name: p.name,
          category: p.category as Product['category'],
          price: p.price,
          costPrice: p.costPrice,
          stock: p.stock,
          reorderLevel: p.reorderLevel,
          unit: p.unit,
          color: p.color ?? undefined,
          iconName: p.iconName ?? undefined,
          isTaxable: p.isTaxable,
        }));

        return NextResponse.json({
          success: true,
          source: 'prisma_postgresql',
          data: formatted,
        });
      }
    } catch (err) {
      console.error('Prisma product query error:', err);
    }
  }

  // 2. Try Supabase Client
  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        const formatted: Product[] = data.map((row) => ({
          id: String(row.id),
          barcode: String(row.barcode),
          name: String(row.name),
          category: row.category as Product['category'],
          price: Number(row.price),
          costPrice: Number(row.cost_price ?? 0),
          stock: Number(row.stock),
          reorderLevel: Number(row.reorder_level ?? 5),
          unit: String(row.unit ?? 'pcs'),
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

  // 3. Persistent Local File Database
  const localDb = readLocalDb();
  return NextResponse.json({
    success: true,
    source: 'local_file_database',
    data: localDb.products,
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
      color: body.color || 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      iconName: body.iconName || 'Package',
      isTaxable: body.isTaxable !== false,
    };

    // 1. Prisma
    if (isPrismaConfigured()) {
      try {
        const created = await prisma.product.create({
          data: {
            id: newProduct.id,
            barcode: newProduct.barcode,
            name: newProduct.name,
            category: newProduct.category,
            price: newProduct.price,
            costPrice: newProduct.costPrice,
            stock: newProduct.stock,
            reorderLevel: newProduct.reorderLevel,
            unit: newProduct.unit,
            color: newProduct.color,
            iconName: newProduct.iconName,
            isTaxable: newProduct.isTaxable,
          },
        });

        return NextResponse.json({
          success: true,
          source: 'prisma_postgresql',
          message: 'Product created successfully in PostgreSQL via Prisma',
          data: created,
        });
      } catch (err) {
        console.error('Prisma create product error:', err);
      }
    }

    // 2. Supabase
    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('products').insert([
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
        }
      } catch (err) {
        console.error('Supabase create product error:', err);
      }
    }

    // 3. Local DB
    const localDb = readLocalDb();
    const updatedProducts = [newProduct, ...localDb.products];
    writeLocalDb({ products: updatedProducts });

    return NextResponse.json({
      success: true,
      source: 'local_file_database',
      message: 'Product created in local database file (data/minimart_db.json)',
      data: newProduct,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid request payload' },
      { status: 400 }
    );
  }
}
