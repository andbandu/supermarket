export type ProductCategory =
  | 'All'
  | 'Beverages'
  | 'Snacks & Candy'
  | 'Bakery & Fresh'
  | 'Ready-to-Eat'
  | 'Dairy & Frozen'
  | 'Household & Personal'
  | 'Essentials';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  price: number;
  costPrice: number;
  stock: number;
  reorderLevel: number;
  unit: string;
  image?: string;
  iconName?: string;
  color?: string;
  isTaxable: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number; // 0 to 100
  customPrice?: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'QR' | 'SPLIT';

export interface OrderItem {
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  receiptNumber: string;
  timestamp: string; // ISO string
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  changeGiven: number;
  cashierName: string;
  status: 'COMPLETED' | 'REFUNDED' | 'HELD';
  refundReason?: string;
  notes?: string;
}

export interface HeldOrder {
  id: string;
  heldAt: string;
  customerNote: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  cashierName: string;
}

export interface CashierShift {
  id: string;
  cashierName: string;
  startedAt: string;
  endedAt?: string;
  startingFloat: number;
  cashDrops: number;
  actualDrawerCash?: number;
  notes?: string;
  isClosed: boolean;
}

export interface POSSettings {
  storeName: string;
  tagline: string;
  storeAddress: string;
  storePhone: string;
  taxRatePercent: number; // e.g. 7 for 7%
  currencySymbol: string; // e.g. '$'
  receiptFooter: string;
  soundEnabled: boolean;
  activeCashier: string;
}

