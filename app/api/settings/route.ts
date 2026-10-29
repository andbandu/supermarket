import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { prisma, isPrismaConfigured } from '@/lib/prisma';
import { POSSettings } from '@/types/pos';
import { DEFAULT_SETTINGS } from '@/lib/mockData';

export async function GET(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  if (isPrismaConfigured()) {
    try {
      const data = await prisma.settings.findFirst({
        where: { id: 1 },
      });

      if (data) {
        const settings: POSSettings = {
          storeName: data.storeName,
          tagline: data.tagline ?? DEFAULT_SETTINGS.tagline,
          storeAddress: data.storeAddress ?? DEFAULT_SETTINGS.storeAddress,
          storePhone: data.storePhone ?? DEFAULT_SETTINGS.storePhone,
          taxRatePercent: data.taxRatePercent,
          currencySymbol: data.currencySymbol,
          receiptFooter: data.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter,
          soundEnabled: data.soundEnabled,
          activeCashier: data.activeCashier,
        };
        return NextResponse.json({ success: true, source: 'prisma_postgresql', data: settings });
      }
    } catch (err) {
      console.error('Prisma settings query error:', err);
    }
  }

  return NextResponse.json({ success: true, data: DEFAULT_SETTINGS });
}

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body: Partial<POSSettings> = await request.json();

    if (isPrismaConfigured()) {
      const data = await prisma.settings.upsert({
        where: { id: 1 },
        update: {
          storeName: body.storeName,
          tagline: body.tagline,
          storeAddress: body.storeAddress,
          storePhone: body.storePhone,
          taxRatePercent: body.taxRatePercent,
          currencySymbol: body.currencySymbol,
          receiptFooter: body.receiptFooter,
          soundEnabled: body.soundEnabled,
          activeCashier: body.activeCashier,
        },
        create: {
          id: 1,
          storeName: body.storeName ?? DEFAULT_SETTINGS.storeName,
          tagline: body.tagline ?? DEFAULT_SETTINGS.tagline,
          storeAddress: body.storeAddress ?? DEFAULT_SETTINGS.storeAddress,
          storePhone: body.storePhone ?? DEFAULT_SETTINGS.storePhone,
          taxRatePercent: body.taxRatePercent ?? DEFAULT_SETTINGS.taxRatePercent,
          currencySymbol: body.currencySymbol ?? DEFAULT_SETTINGS.currencySymbol,
          receiptFooter: body.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter,
          soundEnabled: body.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
          activeCashier: body.activeCashier ?? DEFAULT_SETTINGS.activeCashier,
        },
      });

      return NextResponse.json({ success: true, source: 'prisma_postgresql', data });
    }

    return NextResponse.json({ success: true, data: body });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }
}
