import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Migration: Unified Orders & Online Customers ---');

  // 1. Drop temporary online_orders table if it was created
  console.log('1. Checking and removing temporary online_orders table...');
  try {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS online_orders CASCADE;`);
    console.log('Temporary online_orders table removed.');
  } catch (err) {
    console.warn('Notice removing online_orders:', err.message);
  }

  // 2. Create online_customers table
  console.log('2. Creating online_customers table if not exists...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS online_customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      default_address TEXT,
      total_orders INT DEFAULT 0,
      total_spent NUMERIC(10, 2) DEFAULT 0.00,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_online_customers_phone ON online_customers (phone);`);
  console.log('online_customers table ready.');

  // 3. Update orders table constraints and add columns
  console.log('3. Updating existing orders table with online ordering columns...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;`);
  } catch (e) {
    console.log('Constraints dropped or not present');
  }

  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(10, 2) DEFAULT 0.00;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'POS';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'IN_STORE';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'COMPLETED';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES online_customers(id) ON DELETE SET NULL;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0.00;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PAID';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_time TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_orders_order_source ON orders (order_source);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders (fulfillment_status);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);`);
  console.log('Existing orders table updated with online order columns.');

  // 4. Seed sample online customers
  console.log('4. Seeding initial online customers...');
  const sampleCustomers = [
    {
      id: 'cust-001',
      name: 'Nimalka Fernando',
      phone: '+94 77 458 9120',
      email: 'nimalka.f@gmail.com',
      default_address: 'No. 45/2, Alfred House Gardens, Colombo 03',
      total_orders: 1,
      total_spent: 2058.00,
    },
    {
      id: 'cust-002',
      name: 'Roshan Wickramasinghe',
      phone: '+94 71 889 3450',
      email: 'roshan.w@outlook.com',
      default_address: 'Store Pickup Counter (Colombo 03)',
      total_orders: 1,
      total_spent: 1420.00,
    },
    {
      id: 'cust-003',
      name: 'Dilani Jayasuriya',
      phone: '+94 76 332 1980',
      email: 'dilani.j@gmail.com',
      default_address: '12/A, Station Road, Bambalapitiya, Colombo 04',
      total_orders: 1,
      total_spent: 4070.00,
    },
    {
      id: 'cust-004',
      name: 'Kasun Bandara',
      phone: '+94 70 554 2311',
      email: 'kasun.b@yahoo.com',
      default_address: 'No. 88, Galle Road, Colombo 03',
      total_orders: 1,
      total_spent: 680.00,
    },
  ];

  for (const c of sampleCustomers) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO online_customers (id, name, phone, email, default_address, total_orders, total_spent, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         default_address = EXCLUDED.default_address,
         total_orders = EXCLUDED.total_orders,
         total_spent = EXCLUDED.total_spent,
         updated_at = NOW();`,
      c.id, c.name, c.phone, c.email, c.default_address, c.total_orders, c.total_spent
    );
  }
  console.log('Sample customers upserted.');

  // 5. Seed sample online orders into the unified orders table
  console.log('5. Seeding initial online orders in orders table...');
  const sampleOnlineOrders = [
    {
      id: 'ord-onl-1001',
      receipt_number: 'APP-20261030-001',
      order_source: 'MOBILE_APP',
      order_type: 'DELIVERY',
      fulfillment_status: 'PENDING',
      customer_id: 'cust-001',
      customer_name: 'Nimalka Fernando',
      customer_phone: '+94 77 458 9120',
      customer_email: 'nimalka.f@gmail.com',
      delivery_address: 'No. 45/2, Alfred House Gardens, Colombo 03',
      delivery_fee: 250.00,
      payment_method: 'CASH',
      payment_status: 'UNPAID',
      estimated_time: '30-40 mins',
      customer_notes: 'Please ring bell upon arrival. Keep change for 5000 note.',
      gross_amount: 1808.00,
      subtotal: 1808.00,
      discount_amount: 0.00,
      tax_amount: 0.00,
      total: 2058.00,
      amount_tendered: 0.00,
      change_given: 0.00,
      cashierName: 'Mobile Ordering Service',
      notes: 'Online Order via Android Mobile App',
      items: [
        {
          productId: 'prod-001',
          productName: 'Elephant House Cream Soda 400ml (PET)',
          barcode: '479101100001',
          quantity: 3,
          unitPrice: 136.00,
          discountPercent: 0,
          totalPrice: 408.00,
        },
        {
          productId: 'prod-006',
          productName: 'Highland Pasteurized Fresh Milk 1L',
          barcode: '479101100006',
          quantity: 2,
          unitPrice: 480.00,
          discountPercent: 0,
          totalPrice: 960.00,
        },
        {
          productId: 'prod-009',
          productName: 'Maliban Lemon Puff Biscuits 200g',
          barcode: '479101100009',
          quantity: 2,
          unitPrice: 220.00,
          discountPercent: 0,
          totalPrice: 440.00,
        },
      ],
    },
    {
      id: 'ord-onl-1002',
      receipt_number: 'WEB-20261030-002',
      order_source: 'STOREFRONT',
      order_type: 'PICKUP',
      fulfillment_status: 'PREPARING',
      customer_id: 'cust-002',
      customer_name: 'Roshan Wickramasinghe',
      customer_phone: '+94 71 889 3450',
      customer_email: 'roshan.w@outlook.com',
      delivery_address: 'Store Pickup Counter (Colombo 03)',
      delivery_fee: 0.00,
      payment_method: 'CARD',
      payment_status: 'PAID',
      estimated_time: 'Ready at 1:15 PM',
      customer_notes: 'Will pick up during lunch hour.',
      gross_amount: 1420.00,
      subtotal: 1420.00,
      discount_amount: 0.00,
      tax_amount: 0.00,
      total: 1420.00,
      amount_tendered: 1420.00,
      change_given: 0.00,
      cashierName: 'Web Storefront Bot',
      notes: 'Paid online via Payment Gateway',
      items: [
        {
          productId: 'prod-003',
          productName: 'Milo Chocolate Malt UHT Pack 180ml',
          barcode: '479101100003',
          quantity: 6,
          unitPrice: 150.00,
          discountPercent: 0,
          totalPrice: 900.00,
        },
        {
          productId: 'prod-010',
          productName: 'Munchee Hawaiian Cookies 200g',
          barcode: '479101100010',
          quantity: 2,
          unitPrice: 260.00,
          discountPercent: 0,
          totalPrice: 520.00,
        },
      ],
    },
    {
      id: 'ord-onl-1003',
      receipt_number: 'APP-20261030-003',
      order_source: 'MOBILE_APP',
      order_type: 'DELIVERY',
      fulfillment_status: 'READY',
      customer_id: 'cust-003',
      customer_name: 'Dilani Jayasuriya',
      customer_phone: '+94 76 332 1980',
      customer_email: 'dilani.j@gmail.com',
      delivery_address: '12/A, Station Road, Bambalapitiya, Colombo 04',
      delivery_fee: 250.00,
      payment_method: 'CARD',
      payment_status: 'PAID',
      estimated_time: 'Rider on route',
      customer_notes: 'Hand over to security if I do not answer the gate.',
      gross_amount: 3820.00,
      subtotal: 3820.00,
      discount_amount: 0.00,
      tax_amount: 0.00,
      total: 4070.00,
      amount_tendered: 4070.00,
      change_given: 0.00,
      cashierName: 'Mobile Ordering Service',
      notes: 'Dispatched to delivery partner',
      items: [
        {
          productId: 'prod-007',
          productName: 'Red Bull Energy Drink 250ml Can',
          barcode: '479101100007',
          quantity: 4,
          unitPrice: 850.00,
          discountPercent: 0,
          totalPrice: 3400.00,
        },
        {
          productId: 'prod-004',
          productName: 'Knuckles Natural Mineral Water 1L',
          barcode: '479101100004',
          quantity: 3,
          unitPrice: 140.00,
          discountPercent: 0,
          totalPrice: 420.00,
        },
      ],
    },
    {
      id: 'ord-onl-1004',
      receipt_number: 'WEB-20261029-088',
      order_source: 'STOREFRONT',
      order_type: 'DELIVERY',
      fulfillment_status: 'COMPLETED',
      customer_id: 'cust-004',
      customer_name: 'Kasun Bandara',
      customer_phone: '+94 70 554 2311',
      customer_email: 'kasun.b@yahoo.com',
      delivery_address: 'No. 88, Galle Road, Colombo 03',
      delivery_fee: 200.00,
      payment_method: 'CASH',
      payment_status: 'PAID',
      estimated_time: 'Delivered',
      customer_notes: 'Delivered yesterday',
      gross_amount: 480.00,
      subtotal: 480.00,
      discount_amount: 0.00,
      tax_amount: 0.00,
      total: 680.00,
      amount_tendered: 1000.00,
      change_given: 320.00,
      cashierName: 'Web Storefront Bot',
      notes: 'Delivered and cash collected',
      items: [
        {
          productId: 'prod-002',
          productName: 'Coca-Cola Mega 400ml Bottle',
          barcode: '479101100002',
          quantity: 2,
          unitPrice: 240.00,
          discountPercent: 0,
          totalPrice: 480.00,
        },
      ],
    },
  ];

  for (const o of sampleOnlineOrders) {
    const existing = await prisma.$queryRawUnsafe(`SELECT id FROM orders WHERE id = $1`, o.id);
    if (!existing || existing.length === 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO orders (
          id, receipt_number, timestamp, subtotal, discount_amount, tax_amount, total,
          payment_method, amount_tendered, change_given, cashier_name, status, notes,
          gross_amount, order_source, order_type, fulfillment_status, customer_id,
          customer_name, customer_phone, customer_email, delivery_address, delivery_fee,
          payment_status, estimated_time, customer_notes, created_at, updated_at
        ) VALUES (
          $1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW(), NOW()
        );`,
        o.id, o.receipt_number, o.subtotal, o.discount_amount, o.tax_amount, o.total,
        o.payment_method, o.amount_tendered, o.change_given, o.cashierName,
        'COMPLETED',
        o.notes, o.gross_amount, o.order_source, o.order_type, o.fulfillment_status,
        o.customer_id, o.customer_name, o.customer_phone, o.customer_email,
        o.delivery_address, o.delivery_fee, o.payment_status, o.estimated_time, o.customer_notes
      );

      // Add order items with gen_random_uuid() for uuid column
      for (const item of o.items) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO order_items (id, order_id, product_id, product_name, barcode, quantity, unit_price, discount_percent, total_price, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW());`,
          o.id, item.productId, item.productName, item.barcode, item.quantity, item.unitPrice, item.discountPercent, item.totalPrice
        );
      }
      console.log(`Seeded online order: ${o.receipt_number}`);
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE orders SET
          order_source = $2,
          order_type = $3,
          fulfillment_status = $4,
          customer_id = $5,
          customer_name = $6,
          customer_phone = $7,
          customer_email = $8,
          delivery_address = $9,
          delivery_fee = $10,
          payment_status = $11,
          estimated_time = $12,
          customer_notes = $13,
          gross_amount = $14
        WHERE id = $1;`,
        o.id, o.order_source, o.order_type, o.fulfillment_status,
        o.customer_id, o.customer_name, o.customer_phone, o.customer_email,
        o.delivery_address, o.delivery_fee, o.payment_status, o.estimated_time,
        o.customer_notes, o.gross_amount
      );
      console.log(`Updated existing order: ${o.receipt_number}`);
    }
  }

  const allOrders = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as total_orders,
           COUNT(*) FILTER (WHERE order_source != 'POS')::int as online_orders,
           COUNT(*) FILTER (WHERE fulfillment_status = 'PENDING')::int as pending_orders
    FROM orders;
  `);

  const customersCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM online_customers;`);

  console.log('--- Migration Complete ---');
  console.log(`Total orders in DB: ${allOrders[0].total_orders}`);
  console.log(`Online orders in DB: ${allOrders[0].online_orders}`);
  console.log(`Pending online orders: ${allOrders[0].pending_orders}`);
  console.log(`Online customers in DB: ${customersCount[0].count}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Migration error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
