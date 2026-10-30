import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Migrating address & city columns in online_customers and orders ---');

  // 1. Add address and city columns to online_customers
  console.log('1. Adding address and city columns to online_customers...');
  await prisma.$executeRawUnsafe(`ALTER TABLE online_customers ADD COLUMN IF NOT EXISTS address TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE online_customers ADD COLUMN IF NOT EXISTS city TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_online_customers_city ON online_customers (city);`);

  // 2. Add delivery_city column to orders
  console.log('2. Adding delivery_city column to orders...');
  await prisma.$executeRawUnsafe(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_city TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_orders_delivery_city ON orders (delivery_city);`);

  // 3. Populate address and city for sample customers
  console.log('3. Updating customer records with normalized address and city...');
  const customerUpdates = [
    {
      id: 'cust-001',
      address: 'No. 45/2, Alfred House Gardens',
      city: 'Colombo 03',
      default_address: 'No. 45/2, Alfred House Gardens, Colombo 03',
    },
    {
      id: 'cust-002',
      address: 'Store Pickup Counter',
      city: 'Colombo 03',
      default_address: 'Store Pickup Counter (Colombo 03)',
    },
    {
      id: 'cust-003',
      address: '12/A, Station Road, Bambalapitiya',
      city: 'Colombo 04',
      default_address: '12/A, Station Road, Bambalapitiya, Colombo 04',
    },
    {
      id: 'cust-004',
      address: 'No. 88, Galle Road',
      city: 'Colombo 03',
      default_address: 'No. 88, Galle Road, Colombo 03',
    },
  ];

  for (const c of customerUpdates) {
    await prisma.$executeRawUnsafe(
      `UPDATE online_customers
       SET address = $2, city = $3, default_address = $4, updated_at = NOW()
       WHERE id = $1;`,
      c.id, c.address, c.city, c.default_address
    );
  }

  // Also if any customer has null address/city but has default_address, split it
  await prisma.$executeRawUnsafe(`
    UPDATE online_customers
    SET address = COALESCE(address, default_address),
        city = COALESCE(city, 'Colombo 03')
    WHERE address IS NULL;
  `);

  // 4. Update orders table with normalized delivery_address and delivery_city
  console.log('4. Normalizing orders with delivery_address and delivery_city...');
  const orderUpdates = [
    {
      id: 'ord-onl-1001',
      delivery_address: 'No. 45/2, Alfred House Gardens',
      delivery_city: 'Colombo 03',
    },
    {
      id: 'ord-onl-1002',
      delivery_address: 'Store Pickup Counter',
      delivery_city: 'Colombo 03',
    },
    {
      id: 'ord-onl-1003',
      delivery_address: '12/A, Station Road, Bambalapitiya',
      delivery_city: 'Colombo 04',
    },
    {
      id: 'ord-onl-1004',
      delivery_address: 'No. 88, Galle Road',
      delivery_city: 'Colombo 03',
    },
  ];

  for (const o of orderUpdates) {
    await prisma.$executeRawUnsafe(
      `UPDATE orders
       SET delivery_address = $2, delivery_city = $3, updated_at = NOW()
       WHERE id = $1;`,
      o.id, o.delivery_address, o.delivery_city
    );
  }

  // Verify customers
  const customers = await prisma.$queryRawUnsafe(`
    SELECT id, name, phone, address, city FROM online_customers ORDER BY id;
  `);
  console.log('Verified online_customers:', customers);

  // Verify orders
  const orders = await prisma.$queryRawUnsafe(`
    SELECT id, receipt_number, customer_id, customer_name, delivery_address, delivery_city
    FROM orders
    WHERE order_source != 'POS'
    ORDER BY id;
  `);
  console.log('Verified online orders:', orders);

  console.log('--- Migration Complete Successfully ---');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Migration error:', e);
  await prisma.$disconnect();
  process.exit(1);
});

