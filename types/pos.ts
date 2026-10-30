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
  brand?: string;
  image?: string;
  images?: string[]; // Up to 4 WebP product images for storefront & mobile app
  iconName?: string;
  color?: string;
  isTaxable: boolean;
}

export const PRODUCT_UNITS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'pack', label: 'Pack / Packet' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'can', label: 'Can' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'litre', label: 'Litre (L)' },
  { value: 'ml', label: 'Millilitre (ml)' },
  { value: 'box', label: 'Box / Carton' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'tin', label: 'Tin' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'roll', label: 'Roll' },
] as const;

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

