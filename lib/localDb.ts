import fs from 'fs';
import path from 'path';
import { Order, Product, CashierShift, POSSettings } from '@/types/pos';
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from '@/lib/mockData';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'minimart_db.json');

interface LocalDatabase {
  products: Product[];
  orders: Order[];
  shift: CashierShift;
  settings: POSSettings;
}

function getDefaultDb(): LocalDatabase {
  return {
    products: INITIAL_PRODUCTS,
    orders: [],
    shift: {
      id: 'shift-current',
      cashierName: DEFAULT_SETTINGS.activeCashier,
      startedAt: new Date().toISOString(),
      startingFloat: 5000.0,
      cashDrops: 0,
      isClosed: false,
    },
    settings: DEFAULT_SETTINGS,
  };
}

export function readLocalDb(): LocalDatabase {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getDefaultDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read local database file, using defaults:', err);
    return getDefaultDb();
  }
}

export function writeLocalDb(data: Partial<LocalDatabase>): LocalDatabase {
  try {
    const current = readLocalDb();
    const updated: LocalDatabase = {
      ...current,
      ...data,
    };
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('Failed to write to local database file:', err);
    return getDefaultDb();
  }
}

// Order operations
export function saveOrderToLocalDb(order: Order): Order {
  const db = readLocalDb();
  // Filter out if duplicate
  const existingIdx = db.orders.findIndex(
    (o) => o.id === order.id || o.receiptNumber === order.receiptNumber
  );

  let updatedOrders: Order[];
  if (existingIdx >= 0) {
    updatedOrders = [...db.orders];
    updatedOrders[existingIdx] = order;
  } else {
    updatedOrders = [order, ...db.orders];
  }

  // Decrement stock in local DB products
  const updatedProducts = db.products.map((prod) => {
    const item = order.items.find((i) => i.productId === prod.id);
    if (item) {
      return {
        ...prod,
        stock: Math.max(0, prod.stock - item.quantity),
      };
    }
    return prod;
  });

  writeLocalDb({
    orders: updatedOrders,
    products: updatedProducts,
  });

  return order;
}

export function refundOrderInLocalDb(orderIdOrReceipt: string, reason: string): Order | null {
  const db = readLocalDb();
  const order = db.orders.find(
    (o) => o.id === orderIdOrReceipt || o.receiptNumber === orderIdOrReceipt
  );

  if (!order || order.status === 'REFUNDED') return order || null;

  const refundedOrder: Order = {
    ...order,
    status: 'REFUNDED',
    refundReason: reason,
  };

  const updatedOrders = db.orders.map((o) =>
    o.id === order.id ? refundedOrder : o
  );

  // Restore stock
  const updatedProducts = db.products.map((prod) => {
    const item = order.items.find((i) => i.productId === prod.id);
    if (item) {
      return {
        ...prod,
        stock: prod.stock + item.quantity,
      };
    }
    return prod;
  });

  writeLocalDb({
    orders: updatedOrders,
    products: updatedProducts,
  });

  return refundedOrder;
}

