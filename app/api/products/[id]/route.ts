import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;

  if (isPrismaConfigured()) {
    try {
      const product = await prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: product });
    } catch (err: unknown) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Database error' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: false, error: 'Database not connected' }, { status: 404 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;
  const body = await request.json();

  if (isPrismaConfigured()) {
    try {
      const updateData: Record<string, unknown> = {};

      if (body.name !== undefined) updateData.name = body.name;
      if (body.barcode !== undefined) updateData.barcode = body.barcode;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.price !== undefined) updateData.price = Number(body.price);
      if (body.costPrice !== undefined) updateData.costPrice = Number(body.costPrice);
      if (body.stock !== undefined) updateData.stock = Number(body.stock);
      if (body.reorderLevel !== undefined) updateData.reorderLevel = Number(body.reorderLevel);
      if (body.unit !== undefined) updateData.unit = body.unit;
      if (body.isTaxable !== undefined) updateData.isTaxable = Boolean(body.isTaxable);

      const updated = await prisma.product.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: updated });
    } catch (err: unknown) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Update failed' },
        { status: 400 }
      );
    }
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

  if (isPrismaConfigured()) {
    try {
      const updated = await prisma.product.update({
        where: { id },
        data: {
          stock: { increment: restockAmount },
        },
      });

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data: updated });
    } catch (err: unknown) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Restock failed' },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ success: true, message: 'Stock updated locally', restockAmount });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  const { id } = await params;

  if (isPrismaConfigured()) {
    try {
      await prisma.product.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, source: 'prisma_postgresql', message: `Product ${id} deleted` });
    } catch (err: unknown) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Delete failed' },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ success: true, message: `Product ${id} deleted locally` });
}
