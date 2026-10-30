import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { OnlineCustomer } from '@/types/pos';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('q')?.toLowerCase();

  if (isPrismaConfigured()) {
    try {
      const whereClause: any = search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined;

      const customers = await (prisma.onlineCustomer as any).findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
      });

      const formatted: OnlineCustomer[] = customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email ?? undefined,
        address: c.address ?? undefined,
        city: c.city ?? undefined,
        defaultAddress: c.defaultAddress || (c.address && c.city ? `${c.address}, ${c.city}` : c.address || undefined),
        totalOrders: c.totalOrders,
        totalSpent: c.totalSpent,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: formatted });
    } catch (err) {
      console.error('Prisma query customers error:', err);
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase && isSupabaseConfigured()) {
    try {
      let query = supabase.from('online_customers').select('*').order('updated_at', { ascending: false });
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%`
        );
      }
      const { data, error } = await query;
      if (!error && data) {
        const formatted: OnlineCustomer[] = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email || undefined,
          address: c.address || undefined,
          city: c.city || undefined,
          defaultAddress:
            c.default_address || (c.address && c.city ? `${c.address}, ${c.city}` : c.address || undefined),
          totalOrders: Number(c.total_orders || 0),
          totalSpent: Number(c.total_spent || 0),
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));
        return NextResponse.json({ success: true, source: 'supabase_postgres', data: formatted });
      }
    } catch (err) {
      console.error('Supabase query customers error:', err);
    }
  }

  return NextResponse.json({ success: true, data: [] });
}

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const id = body.id || 'cust-' + Date.now();
    const { name, phone, email, address, city } = body;
    const defaultAddress =
      body.defaultAddress || (address && city ? `${address}, ${city}` : address || city || null);

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Name and Phone are required' }, { status: 400 });
    }

    if (isPrismaConfigured()) {
      const customer = await (prisma.onlineCustomer as any).upsert({
        where: { phone },
        update: {
          name,
          email,
          address: address || null,
          city: city || null,
          defaultAddress,
          updatedAt: new Date(),
        },
        create: {
          id,
          name,
          phone,
          email,
          address: address || null,
          city: city || null,
          defaultAddress,
        },
      });

      return NextResponse.json({
        success: true,
        source: 'prisma_postgresql',
        data: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email ?? undefined,
          address: (customer as any).address ?? undefined,
          city: (customer as any).city ?? undefined,
          defaultAddress: customer.defaultAddress ?? undefined,
          totalOrders: customer.totalOrders,
          totalSpent: customer.totalSpent,
        },
      });
    }

    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('online_customers')
        .upsert(
          {
            id,
            name,
            phone,
            email,
            address: address || null,
            city: city || null,
            default_address: defaultAddress,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'phone' }
        )
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({
          success: true,
          source: 'supabase_postgres',
          data: {
            id: data.id,
            name: data.name,
            phone: data.phone,
            email: data.email || undefined,
            address: data.address || undefined,
            city: data.city || undefined,
            defaultAddress: data.default_address || undefined,
            totalOrders: Number(data.total_orders || 0),
            totalSpent: Number(data.total_spent || 0),
          },
        });
      }
    }

    return NextResponse.json({ success: false, error: 'Failed to save customer' }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
