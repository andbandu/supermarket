import { PrismaClient } from '@prisma/client';
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from '../lib/mockData';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Minimart POS Database Seeding...');

  // 1. Seed Store Settings
  console.log('⚙️  Seeding Settings...');
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      storeName: DEFAULT_SETTINGS.storeName,
      tagline: DEFAULT_SETTINGS.tagline,
      storeAddress: DEFAULT_SETTINGS.storeAddress,
      storePhone: DEFAULT_SETTINGS.storePhone,
      taxRatePercent: DEFAULT_SETTINGS.taxRatePercent,
      currencySymbol: DEFAULT_SETTINGS.currencySymbol,
      receiptFooter: DEFAULT_SETTINGS.receiptFooter,
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      activeCashier: DEFAULT_SETTINGS.activeCashier,
    },
    create: {
      id: 1,
      storeName: DEFAULT_SETTINGS.storeName,
      tagline: DEFAULT_SETTINGS.tagline,
      storeAddress: DEFAULT_SETTINGS.storeAddress,
      storePhone: DEFAULT_SETTINGS.storePhone,
      taxRatePercent: DEFAULT_SETTINGS.taxRatePercent,
      currencySymbol: DEFAULT_SETTINGS.currencySymbol,
      receiptFooter: DEFAULT_SETTINGS.receiptFooter,
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      activeCashier: DEFAULT_SETTINGS.activeCashier,
    },
  });

  // 2. Seed Initial Products
  console.log(`📦 Seeding ${INITIAL_PRODUCTS.length} Minimart Products...`);
  for (const product of INITIAL_PRODUCTS) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        barcode: product.barcode,
        name: product.name,
        category: product.category,
        price: product.price,
        costPrice: product.costPrice,
        stock: product.stock,
        reorderLevel: product.reorderLevel,
        unit: product.unit,
        color: product.color,
        iconName: product.iconName,
        isTaxable: product.isTaxable,
      },
      create: {
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        category: product.category,
        price: product.price,
        costPrice: product.costPrice,
        stock: product.stock,
        reorderLevel: product.reorderLevel,
        unit: product.unit,
        color: product.color,
        iconName: product.iconName,
        isTaxable: product.isTaxable,
      },
    });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

