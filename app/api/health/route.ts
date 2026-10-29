import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  const prismaConfigured = isPrismaConfigured();
  let dbStatus = 'Not Connected (using Local Fallback)';
  let productsCount = 0;

  if (prismaConfigured) {
    try {
      const count = await prisma.product.count();
      dbStatus = 'Connected to PostgreSQL via Prisma ORM';
      productsCount = count;
    } catch (err: unknown) {
      dbStatus = `Prisma connection failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({
    status: 'online',
    version: '1.0.0',
    service: 'Minimart POS Secure API',
    orm: 'Prisma ORM (v6)',
    database: {
      type: 'PostgreSQL (Supabase)',
      prismaConfigured,
      supabaseConfigured: isSupabaseConfigured(),
      status: dbStatus,
      productsCount,
    },
    auth: {
      method: 'x-api-key or Bearer token',
      status: 'authenticated',
    },
    timestamp: new Date().toISOString(),
  });
}
