import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { INITIAL_PRODUCTS } from '@/lib/mockData';
import { Product } from '@/types/pos';

// Helper to convert PostgreSQL snake_case to POS Product model
function mapDbProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    barcode: String(row.barcode),
    name: String(row.name),
    category: row.category as Product['category'],
    price: Number(row.price),
    costPrice: Number(row.cost_price ?? row.costPrice ?? 0),
    stock: Number(row.stock),
    reorderLevel: Number(row.reorder_level ?? row.reorderLevel ?? 5),
    unit: String(row.unit ?? 'pcs'),
    color: row.color ? String(row.color) : undefined,
    iconName: row.icon_name ? String(row.icon_name) : undefined,
    isTaxable: Boolean(row.is_taxable ?? true),
  };
}

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  const supabase = getSupabaseAdmin();

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'supabase_postgres',
          data: data.map(mapDbProduct),
        });
      }
    } catch {
      // Fallback if table not yet seeded
    }
  }

  // Graceful fallback to initial minimart products
  return NextResponse.json({
    success: true,
    source: 'local_fallback',
    note: isSupabaseConfigured()
      ? 'Supabase configured but products table is empty. Run supabase/schema.sql in Supabase SQL Editor.'
      : 'Supabase URL/Key not set in .env.local; serving standard catalog.',
    data: INITIAL_PRODUCTS,
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

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
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

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Product created successfully',
      data: newProduct,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid request payload' },
      { status: 400 }
    );
  }
}

