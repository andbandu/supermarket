import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Setting up online_orders table in Supabase PostgreSQL...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS online_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      delivery_address TEXT,
      order_type TEXT NOT NULL DEFAULT 'DELIVERY',
      status TEXT NOT NULL DEFAULT 'PENDING',
      payment_method TEXT NOT NULL DEFAULT 'COD',
      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      items_json JSONB NOT NULL DEFAULT '[]',
      gross_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      total NUMERIC(10, 2) NOT NULL,
      customer_notes TEXT,
      internal_notes TEXT,
      estimated_time TEXT,
      channel TEXT NOT NULL DEFAULT 'STOREFRONT',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders (status);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_online_orders_created_at ON online_orders (created_at DESC);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_online_orders_phone ON online_orders (customer_phone);`);

  console.log('online_orders table and indices ensured.');

  // Check count
  const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM online_orders`);
  const count = countRes[0]?.count || 0;

  if (count === 0) {
    console.log('Seeding initial online orders for storefront & mobile app...');

    const sampleOrders = [
      {
        id: 'ord-online-101',
        order_number: 'APP-20261030-101',
        customer_name: 'Nimalka Fernando',
        customer_phone: '+94 77 458 9120',
        customer_email: 'nimalka.f@gmail.com',
        delivery_address: 'No. 45/2, Alfred House Gardens, Colombo 03',
        order_type: 'DELIVERY',
        status: 'PENDING',
        payment_method: 'COD',
        payment_status: 'UNPAID',
        items_json: JSON.stringify([
          {
            productId: 'prod-001',
            productName: 'Elephant House Cream Soda 400ml (PET)',
            barcode: '479101100001',
            quantity: 3,
            unitPrice: 136.00,
            totalPrice: 408.00,
            unit: 'bottle'
          },
          {
            productId: 'prod-006',
            productName: 'Highland Pasteurized Fresh Milk 1L',
            barcode: '479101100006',
            quantity: 2,
            unitPrice: 480.00,
            totalPrice: 960.00,
            unit: 'bottle'
          },
          {
            productId: 'prod-009',
            productName: 'Maliban Lemon Puff Biscuits 200g',
            barcode: '479101100009',
            quantity: 2,
            unitPrice: 220.00,
            totalPrice: 440.00,
            unit: 'pack'
          }
        ]),
        gross_amount: 1880.00,
        delivery_fee: 250.00,
        discount_amount: 72.00,
        tax_amount: 0.00,
        total: 2058.00,
        customer_notes: 'Please ring bell upon arrival. Cash on delivery.',
        internal_notes: 'New customer from Android Mobile App',
        estimated_time: '35 mins',
        channel: 'MOBILE_APP',
      },
      {
        id: 'ord-online-102',
        order_number: 'WEB-20261030-102',
        customer_name: 'Roshan Wickramasinghe',
        customer_phone: '+94 71 889 3450',
        customer_email: 'roshan.w@outlook.com',
        delivery_address: 'In-Store Pickup Counter',
        order_type: 'PICKUP',
        status: 'PREPARING',
        payment_method: 'ONLINE',
        payment_status: 'PAID',
        items_json: JSON.stringify([
          {
            productId: 'prod-003',
            productName: 'Milo Chocolate Malt UHT Pack 180ml',
            barcode: '479101100003',
            quantity: 6,
            unitPrice: 150.00,
            totalPrice: 900.00,
            unit: 'pack'
          },
          {
            productId: 'prod-010',
            productName: 'Munchee Hawaiian Cookies 200g',
            barcode: '479101100010',
            quantity: 2,
            unitPrice: 260.00,
            totalPrice: 520.00,
            unit: 'pack'
          }
        ]),
        gross_amount: 1420.00,
        delivery_fee: 0.00,
        discount_amount: 0.00,
        tax_amount: 0.00,
        total: 1420.00,
        customer_notes: 'Will pick up during lunch hour around 1:00 PM.',
        internal_notes: 'Paid online via Payment Gateway',
        estimated_time: 'Pickup ready at 12:45 PM',
        channel: 'STOREFRONT',
      },
      {
        id: 'ord-online-103',
        order_number: 'APP-20261030-103',
        customer_name: 'Dilani Jayasuriya',
        customer_phone: '+94 76 332 1980',
        customer_email: 'dilani.j@gmail.com',
        delivery_address: '12/A, Station Road, Bambalapitiya, Colombo 04',
        order_type: 'DELIVERY',
        status: 'READY_FOR_PICKUP',
        payment_method: 'CARD',
        payment_status: 'PAID',
        items_json: JSON.stringify([
          {
            productId: 'prod-007',
            productName: 'Red Bull Energy Drink 250ml Can',
            barcode: '479101100007',
            quantity: 4,
            unitPrice: 850.00,
            totalPrice: 3400.00,
            unit: 'can'
          },
          {
            productId: 'prod-004',
            productName: 'Knuckles Natural Mineral Water 1L',
            barcode: '479101100004',
            quantity: 3,
            unitPrice: 140.00,
            totalPrice: 420.00,
            unit: 'bottle'
          }
        ]),
        gross_amount: 3820.00,
        delivery_fee: 250.00,
        discount_amount: 0.00,
        tax_amount: 0.00,
        total: 4070.00,
        customer_notes: 'Hand over to security if I am not available.',
        internal_notes: 'Packed and waiting for delivery rider',
        estimated_time: 'Ready for rider pickup',
        channel: 'MOBILE_APP',
      },
      {
        id: 'ord-online-104',
        order_number: 'WEB-20261029-094',
        customer_name: 'Dhanushka Perera',
        customer_phone: '+94 70 234 5678',
        customer_email: 'dhanushka.p@yahoo.com',
        delivery_address: 'No. 88, Galle Road, Colombo 03',
        order_type: 'DELIVERY',
        status: 'COMPLETED',
        payment_method: 'COD',
        payment_status: 'PAID',
        items_json: JSON.stringify([
          {
            productId: 'prod-002',
            productName: 'Coca-Cola Mega 400ml Bottle',
            barcode: '479101100002',
            quantity: 2,
            unitPrice: 240.00,
            totalPrice: 480.00,
            unit: 'bottle'
          }
        ]),
        gross_amount: 480.00,
        delivery_fee: 200.00,
        discount_amount: 0.00,
        tax_amount: 0.00,
        total: 680.00,
        customer_notes: 'Delivered yesterday',
        internal_notes: 'Cash collected by driver',
        estimated_time: 'Delivered',
        channel: 'STOREFRONT',
      }
    ];

    for (const o of sampleOrders) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO online_orders (
          id, order_number, customer_name, customer_phone, customer_email, delivery_address,
          order_type, status, payment_method, payment_status, items_json, gross_amount,
          delivery_fee, discount_amount, tax_amount, total, customer_notes, internal_notes,
          estimated_time, channel, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
        ) ON CONFLICT (id) DO NOTHING`,
        o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_email, o.delivery_address,
        o.order_type, o.status, o.payment_method, o.payment_status, o.items_json, o.gross_amount,
        o.delivery_fee, o.discount_amount, o.tax_amount, o.total, o.customer_notes, o.internal_notes,
        o.estimated_time, o.channel
      );
    }
    console.log('Seeded online orders successfully.');
  }

  const finalCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM online_orders`);
  console.log(`Current online orders in database: ${finalCount[0]?.count}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

