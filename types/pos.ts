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
  discountPrice?: number; // Native individual item discounted selling price (LKR)
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
  discountPrice?: number; // Discounted unit selling price (LKR)
  customPrice?: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'QR' | 'SPLIT';

export type OrderSource = 'POS' | 'STOREFRONT' | 'MOBILE_APP';
export type OrderType = 'IN_STORE' | 'DELIVERY' | 'PICKUP';
export type FulfillmentStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED';
export type OrderPaymentStatus = 'PAID' | 'UNPAID' | 'REFUNDED';

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
  grossAmount?: number; // Gross amount before any discounts
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
  appliedDiscountId?: string;
  appliedDiscountName?: string;
  appliedDiscountCode?: string;
  notes?: string;

  // Unified Online Orders extensions
  orderSource?: OrderSource;
  orderType?: OrderType;
  fulfillmentStatus?: FulfillmentStatus;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryFee?: number;
  paymentStatus?: OrderPaymentStatus;
  estimatedTime?: string;
  customerNotes?: string;
  customer?: OnlineCustomer;
  updatedAt?: string;
}

export interface OnlineCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  defaultAddress?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt?: string;
  updatedAt?: string;
}

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'CATEGORY_PERCENT' | 'PRODUCT_DISCOUNT_PRICE';
export type DiscountScope = 'ORDER' | 'CATEGORY' | 'PRODUCT';

export interface Discount {
  id: string;
  name: string;
  code?: string;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  targetCategory?: ProductCategory;
  targetProductId?: string;
  targetProductName?: string;
  minOrderAmount?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  usageCount: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  color?: string;
  isActive: boolean;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  origin?: string;
  logo?: string;
  isActive: boolean;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}


