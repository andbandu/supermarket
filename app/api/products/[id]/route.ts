import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  if (supabase && isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ success: false, error: 'Product not found in database' }, { status: 404 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  if (supabase && isSupabaseConfigured()) {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.barcode !== undefined) updatePayload.barcode = body.barcode;
    if (body.category !== undefined) updatePayload.category = body.category;
    if (body.price !== undefined) updatePayload.price = Number(body.price);
    if (body.costPrice !== undefined) updatePayload.cost_price = Number(body.costPrice);
    if (body.stock !== undefined) updatePayload.stock = Number(body.stock);
    if (body.reorderLevel !== undefined) updatePayload.reorder_level = Number(body.reorderLevel);
    if (body.unit !== undefined) updatePayload.unit = body.unit;
    if (body.isTaxable !== undefined) updatePayload.is_taxable = Boolean(body.isTaxable);

    const { data, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ success: true, message: 'Updated locally', data: body });
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

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    // Fetch current stock
    const { data: current, error: fetchErr } = await supabase
      .from('products')
      .select('stock')
      .eq('id', id)
      .single();

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 404 });
    }

    const newStock = Math.max(0, (current.stock || 0) + restockAmount);

    const { data, error } = await supabase
      .from('products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ success: true, message: 'Stock updated', restockAmount });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  if (supabase && isSupabaseConfigured()) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true, message: `Product ${id} deleted` });
}

