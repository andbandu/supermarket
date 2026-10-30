'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Product,
  CartItem,
  Order,
  HeldOrder,
  CashierShift,
  POSSettings,
  PaymentMethod,
  OrderItem,
  Discount,
  Category,
  Brand,
  OnlineCustomer,
  FulfillmentStatus,
  OrderPaymentStatus,
} from '@/types/pos';
import { soundManager } from '@/lib/sound';
import { apiClient } from '@/lib/apiClient';
import { toast } from '@/context/ToastContext';
import { formatCurrency } from '@/lib/currency';

interface POSContextType {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  cart: CartItem[];
  heldOrders: HeldOrder[];
  orders: Order[];
  onlineOrders: Order[];
  posOrders: Order[];
  pendingOnlineOrdersCount: number;
  customers: OnlineCustomer[];
  discounts: Discount[];
  appliedDiscount: Discount | null;
  settings: POSSettings;
  shift: CashierShift;
  activeTab: 'pos' | 'inventory' | 'catalog' | 'discounts' | 'orders' | 'customers' | 'history' | 'shift' | 'settings';
  setActiveTab: (tab: 'pos' | 'inventory' | 'catalog' | 'discounts' | 'orders' | 'customers' | 'history' | 'shift' | 'settings') => void;
  selectedCustomerIdForView: string | null;
  setSelectedCustomerIdForView: (id: string | null) => void;
  isPaymentModalOpen: boolean;
  setIsPaymentModalOpen: (open: boolean) => void;
  lastCompletedOrder: Order | null;
  setLastCompletedOrder: (order: Order | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;

  // Supabase & API Sync status
  dbSource: string;
  isSupabaseLive: boolean;
  isSyncing: boolean;
  isLoading: boolean;
  refreshFromApi: () => Promise<void>;

  // Cart Actions
  addToCart: (product: Product, qty?: number) => void;
  addByBarcode: (barcode: string) => boolean;
  updateQuantity: (productId: string, delta: number) => void;
  setItemQuantity: (productId: string, quantity: number) => void;
  setItemDiscount: (productId: string, discountPercent: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  // Discount Management Actions
  applyDiscountRule: (discount: Discount | null) => { success: boolean; message?: string };
  applyDiscountByCode: (code: string) => { success: boolean; message?: string };
  removeAppliedDiscount: () => void;
  createDiscountRule: (discount: Omit<Discount, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  updateDiscountRule: (id: string, discount: Partial<Discount>) => Promise<boolean>;
  toggleDiscountActive: (id: string, active: boolean) => Promise<boolean>;
  deleteDiscountRule: (id: string) => Promise<boolean>;

  // Category & Brand Management Actions
  createCategory: (category: Omit<Category, 'id' | 'productCount' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<boolean>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;
  createBrand: (brand: Omit<Brand, 'id' | 'productCount' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<boolean>;
  updateBrand: (id: string, brand: Partial<Brand>) => Promise<boolean>;
  deleteBrand: (id: string) => Promise<boolean>;

  // Online Orders & Customers Fulfillment Actions
  updateFulfillmentStatus: (
    orderId: string,
    status: FulfillmentStatus,
    estimatedTime?: string,
    notes?: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  updatePaymentStatus: (
    orderId: string,
    status: OrderPaymentStatus
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  saveCustomer: (
    customer: Partial<OnlineCustomer>
  ) => Promise<{ success: boolean; message?: string; error?: string; data?: OnlineCustomer }>;

  // Calculations
  cartGrossSubtotal: number;
  cartLineDiscount: number;
  cartOrderDiscount: number;
  cartTotalDiscount: number;
  cartSubtotal: number;
  cartTax: number;
  cartTotal: number;
  cartItemCount: number;
  formatPrice: (amount: number | string | undefined | null) => string;

  // Held Orders
  holdCurrentCart: (customerNote?: string) => void;
  resumeHeldOrder: (heldId: string) => void;
  deleteHeldOrder: (heldId: string) => void;

  // Checkout & Transactions
  processPayment: (paymentMethod: PaymentMethod, amountTendered: number, notes?: string) => Order | null;
  refundOrder: (orderId: string, reason: string) => Promise<{ success: boolean; message?: string; error?: string }>;

  // Inventory Management
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  restockProduct: (productId: string, amount: number) => void;
  deleteProduct: (productId: string) => void;

  // Settings & Shift
  updateSettings: (newSettings: Partial<POSSettings>) => void;
  performCashDrop: (amount: number, reason: string) => void;
  closeShift: (actualCashInDrawer: number, notes?: string) => void;
  startNewShift: (startingFloat: number, cashierName: string) => void;
  resetToSampleData: () => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const EMPTY_SETTINGS: POSSettings = {
  storeName: '',
  tagline: '',
  storeAddress: '',
  storePhone: '',
  taxRatePercent: 0.0,
  currencySymbol: 'LKR',
  receiptFooter: '',
  soundEnabled: true,
  activeCashier: '',
};

const EMPTY_SHIFT: CashierShift = {
  id: '',
  cashierName: '',
  startedAt: new Date().toISOString(),
  startingFloat: 0,
  cashDrops: 0,
  isClosed: false,
};

export function POSProvider({ children }: { children: React.ReactNode }) {
  // Real-time online state: initialized empty with skeleton loading until live API connects
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const [settings, setSettings] = useState<POSSettings>(EMPTY_SETTINGS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<OnlineCustomer[]>([]);
  const [shift, setShift] = useState<CashierShift>(EMPTY_SHIFT);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'catalog' | 'discounts' | 'orders' | 'customers' | 'history' | 'shift' | 'settings'>('pos');
  const [selectedCustomerIdForView, setSelectedCustomerIdForView] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isHydrated, setIsHydrated] = useState(false);

  // Sync state
  const [dbSource, setDbSource] = useState<string>('Connecting...');
  const [isSupabaseLive, setIsSupabaseLive] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Live Database synchronization (Just In Time)
  const refreshFromApi = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 1. Health check & live database indicator
      const health = await apiClient.checkHealth();
      if (health && health.database) {
        const dbStatus =
          typeof health.database === 'object' ? health.database.status : String(health.database);
        const isLive =
          typeof health.database === 'object'
            ? Boolean(
                health.database.prismaConfigured ||
                health.database.supabaseConfigured ||
                dbStatus?.includes('Connected')
              )
            : Boolean(dbStatus?.includes('Connected') || dbStatus?.includes('Supabase'));

        setDbSource(dbStatus || 'Connected');
        setIsSupabaseLive(isLive);
      }

      // 2. Fetch live products from PostgreSQL
      const prodRes = await apiClient.getProducts();
      if (prodRes && prodRes.success && Array.isArray(prodRes.data)) {
        setProducts(prodRes.data);
      }

      // 3. Fetch live orders from PostgreSQL
      const ordersRes = await apiClient.getOrders();
      if (ordersRes && ordersRes.success && Array.isArray(ordersRes.data)) {
        setOrders((prev) => {
          // Check for newly arrived pending online orders
          const prevPendingIds = new Set(
            prev.filter((o) => o.orderSource && o.orderSource !== 'POS' && o.fulfillmentStatus === 'PENDING').map((o) => o.id)
          );
          const newPending = ordersRes.data.filter(
            (o) => o.orderSource && o.orderSource !== 'POS' && o.fulfillmentStatus === 'PENDING' && !prevPendingIds.has(o.id)
          );
          if (newPending.length > 0 && prev.length > 0) {
            soundManager.playOrderAlert();
            toast.info(`🔔 ${newPending.length} new online order(s) arrived!`, 'New Incoming Order');
          }
          return ordersRes.data;
        });
      }

      // 3.1 Fetch live online customers from PostgreSQL
      const custRes = await apiClient.getCustomers();
      if (custRes && custRes.success && Array.isArray(custRes.data)) {
        setCustomers(custRes.data);
      }

      // 4. Fetch live held orders from PostgreSQL
      const heldRes = await apiClient.getHeldOrders();
      if (heldRes && heldRes.success && Array.isArray(heldRes.data)) {
        setHeldOrders(heldRes.data);
      }

      // 5. Fetch live settings from PostgreSQL
      const settingsRes = await apiClient.getSettings();
      if (settingsRes && settingsRes.success && settingsRes.data) {
        setSettings((prev) => ({ ...prev, ...settingsRes.data }));
      }

      // 6. Fetch live shift from PostgreSQL
      const shiftRes = await apiClient.getShift();
      if (shiftRes && shiftRes.success && shiftRes.data) {
        setShift(shiftRes.data);
      }

      // 7. Fetch live discounts & promotional rules from PostgreSQL
      const discRes = await apiClient.getDiscounts();
      if (discRes && discRes.success && Array.isArray(discRes.data)) {
        setDiscounts(discRes.data);
      }

      // 8. Fetch live categories from PostgreSQL
      const catRes = await apiClient.getCategories();
      if (catRes && catRes.success && Array.isArray(catRes.data)) {
        setCategories(catRes.data);
      }

      // 9. Fetch live brands from PostgreSQL
      const brandRes = await apiClient.getBrands();
      if (brandRes && brandRes.success && Array.isArray(brandRes.data)) {
        setBrands(brandRes.data);
      }
    } catch (err) {
      console.warn('Real-time database sync warning:', err);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
      setIsHydrated(true);
    }
  }, []);

  // Periodic polling for new online orders (every 30 seconds)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      refreshFromApi();
    }, 30000);
    return () => clearInterval(pollInterval);
  }, [refreshFromApi]);

  // On client mount: purge old localStorage and sync real-time state from database
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
    } catch {
      // ignore
    }
    refreshFromApi();
  }, [refreshFromApi]);

  // Sync sound manager enabled flag with live settings
  useEffect(() => {
    soundManager.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  // Calculations
  const cartGrossSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unitPrice = item.customPrice ?? item.product.price;
      return sum + unitPrice * item.quantity;
    }, 0);
  }, [cart]);

  // Line-item discounts sum (handles native discountPrice and manual percentage discounts)
  const cartLineDiscount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unitPrice = item.customPrice ?? item.product.price;
      if (item.discountPrice && item.discountPrice > 0 && item.discountPrice < unitPrice) {
        return sum + (unitPrice - item.discountPrice) * item.quantity;
      }
      if (item.discountPercent > 0) {
        return sum + unitPrice * (item.discountPercent / 100) * item.quantity;
      }
      return sum;
    }, 0);
  }, [cart]);

  // Order/Promotion Rule discount
  const cartOrderDiscount = useMemo(() => {
    if (!appliedDiscount || !appliedDiscount.isActive) return 0;
    const baseSubtotal = Math.max(0, cartGrossSubtotal - cartLineDiscount);
    if (appliedDiscount.minOrderAmount && baseSubtotal < appliedDiscount.minOrderAmount) {
      return 0;
    }

    if (appliedDiscount.type === 'PERCENTAGE') {
      return (baseSubtotal * appliedDiscount.value) / 100;
    }
    if (appliedDiscount.type === 'FIXED_AMOUNT') {
      return Math.min(baseSubtotal, appliedDiscount.value);
    }
    if (appliedDiscount.type === 'CATEGORY_PERCENT') {
      const catGross = cart.reduce((sum, item) => {
        if (item.product.category === appliedDiscount.targetCategory) {
          const unitPrice = item.customPrice ?? item.product.price;
          const afterLine = unitPrice * (1 - item.discountPercent / 100);
          return sum + afterLine * item.quantity;
        }
        return sum;
      }, 0);
      return (catGross * appliedDiscount.value) / 100;
    }
    return 0;
  }, [cart, cartGrossSubtotal, cartLineDiscount, appliedDiscount]);

  // Total discount (item discounts + order promo discount)
  const cartTotalDiscount = useMemo(() => {
    return Number((cartLineDiscount + cartOrderDiscount).toFixed(2));
  }, [cartLineDiscount, cartOrderDiscount]);

  // Net subtotal after all discounts
  const cartSubtotal = useMemo(() => {
    return Math.max(0, Number((cartGrossSubtotal - cartTotalDiscount).toFixed(2)));
  }, [cartGrossSubtotal, cartTotalDiscount]);

  const cartTax = useMemo(() => {
    if (settings.taxRatePercent <= 0) return 0;
    const taxableGross = cart.reduce((sum, item) => {
      if (!item.product.isTaxable) return sum;
      const unitPrice = item.customPrice ?? item.product.price;
      const discounted = item.discountPrice && item.discountPrice > 0 && item.discountPrice < unitPrice
        ? item.discountPrice
        : unitPrice * (1 - item.discountPercent / 100);
      return sum + discounted * item.quantity;
    }, 0);

    const discountRatio = cartGrossSubtotal > 0 ? cartSubtotal / cartGrossSubtotal : 1;
    const effectiveTaxable = taxableGross * discountRatio;
    return Number((effectiveTaxable * (settings.taxRatePercent / 100)).toFixed(2));
  }, [cart, cartGrossSubtotal, cartSubtotal, settings.taxRatePercent]);

  const cartTotal = useMemo(() => {
    return Number((cartSubtotal + cartTax).toFixed(2));
  }, [cartSubtotal, cartTax]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Online and POS Orders classification
  const onlineOrders = useMemo(() => {
    return orders.filter((o) => o.orderSource && o.orderSource !== 'POS');
  }, [orders]);

  const posOrders = useMemo(() => {
    return orders.filter((o) => !o.orderSource || o.orderSource === 'POS');
  }, [orders]);

  const pendingOnlineOrdersCount = useMemo(() => {
    return onlineOrders.filter((o) => o.fulfillmentStatus === 'PENDING').length;
  }, [onlineOrders]);

  const formatPrice = useCallback(
    (amount: number | string | undefined | null): string => {
      return formatCurrency(amount, settings.currencySymbol);
    },
    [settings.currencySymbol]
  );

  // Cart operations
  const addToCart = useCallback((product: Product, qty: number = 1) => {
    const existing = cart.find((i) => i.product.id === product.id);
    const currentQtyInCart = existing ? existing.quantity : 0;

    if (currentQtyInCart + qty > product.stock) {
      soundManager.playError();
      toast.warning(`Cannot add more "${product.name}". Only ${product.stock} left in stock.`, 'Stock Limit Reached');
      return;
    }

    soundManager.playBeep();

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + qty,
        };
        return next;
      } else {
        // Automatically apply native product discount price or active item-level discount rule
        const itemDiscountRule = discounts.find(
          (d) => d.isActive && d.scope === 'PRODUCT' && d.targetProductId === product.id
        );
        const nativeDiscountPrice =
          product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price
            ? product.discountPrice
            : itemDiscountRule && itemDiscountRule.value > 0 && itemDiscountRule.value < product.price
            ? itemDiscountRule.value
            : undefined;

        const effectiveDiscountPercent = nativeDiscountPrice
          ? Number((((product.price - nativeDiscountPrice) / product.price) * 100).toFixed(2))
          : 0;

        return [
          ...prev,
          {
            product,
            quantity: qty,
            discountPrice: nativeDiscountPrice,
            discountPercent: effectiveDiscountPercent,
          },
        ];
      }
    });
  }, [cart, discounts]);

  const addByBarcode = useCallback((barcode: string): boolean => {
    const clean = barcode.trim();
    if (!clean) return false;

    const matched = products.find(
      (p) => p.barcode === clean || p.id === clean || p.barcode.endsWith(clean)
    );

    if (matched) {
      addToCart(matched, 1);
      return true;
    } else {
      soundManager.playError();
      return false;
    }
  }, [products, addToCart]);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) => {
      const target = prev.find((i) => i.product.id === productId);
      if (!target) return prev;

      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        soundManager.playClick();
        return prev.filter((i) => i.product.id !== productId);
      }

      if (newQty > target.product.stock) {
        soundManager.playError();
        toast.warning(`Cannot exceed available stock of ${target.product.stock} units.`, 'Stock Limit Reached');
        return prev;
      }

      soundManager.playBeep();
      return prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      );
    });
  }, []);

  const setItemQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) => {
      const target = prev.find((i) => i.product.id === productId);
      if (!target) return prev;

      if (quantity > target.product.stock) {
        soundManager.playError();
        toast.warning(`Maximum available stock is ${target.product.stock}.`, 'Stock Limit Reached');
        return prev;
      }

      return prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      );
    });
  }, []);

  const setItemDiscount = useCallback((productId: string, discountPercent: number) => {
    const valid = Math.max(0, Math.min(100, discountPercent));
    soundManager.playClick();
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, discountPercent: valid } : item
      )
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    soundManager.playClick();
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    if (cart.length === 0) return;
    soundManager.playClick();
    setCart([]);
  }, [cart.length]);

  // Held Carts
  const holdCurrentCart = useCallback((customerNote?: string) => {
    if (cart.length === 0) return;

    const heldItem: HeldOrder = {
      id: 'HELD-' + Date.now().toString().slice(-6),
      heldAt: new Date().toISOString(),
      customerNote: customerNote || `Cart #${heldOrders.length + 1} (${cartItemCount} items)`,
      items: [...cart],
      subtotal: cartSubtotal,
      total: cartTotal,
      cashierName: settings.activeCashier,
    };

    setHeldOrders((prev) => [heldItem, ...prev]);
    setCart([]);
    soundManager.playClick();

    // Async sync to API
    apiClient.saveHeldOrder(heldItem).catch(() => {});
  }, [cart, heldOrders.length, cartItemCount, cartSubtotal, cartTotal, settings.activeCashier]);

  const resumeHeldOrder = useCallback((heldId: string) => {
    const held = heldOrders.find((h) => h.id === heldId);
    if (!held) return;

    if (cart.length > 0) {
      const confirmSwap = window.confirm(
        'You have items in your current cart. Merging with resumed order?'
      );
      if (confirmSwap) {
        setCart(held.items);
      } else {
        return;
      }
    } else {
      setCart(held.items);
    }

    setHeldOrders((prev) => prev.filter((h) => h.id !== heldId));
    soundManager.playSuccess();
    apiClient.deleteHeldOrder(heldId).catch(() => {});
  }, [heldOrders, cart]);

  const deleteHeldOrder = useCallback((heldId: string) => {
    setHeldOrders((prev) => prev.filter((h) => h.id !== heldId));
    soundManager.playClick();
    apiClient.deleteHeldOrder(heldId).catch(() => {});
  }, []);

  // Process checkout & sync to PostgreSQL via Next.js API
  const processPayment = useCallback(
    (paymentMethod: PaymentMethod, amountTendered: number, notes?: string): Order | null => {
      if (cart.length === 0) return null;

      const orderItems: OrderItem[] = cart.map((item) => {
        const unitPrice = item.customPrice ?? item.product.price;
        const lineTotal = item.discountPrice && item.discountPrice > 0 && item.discountPrice < unitPrice
          ? item.discountPrice * item.quantity
          : unitPrice * (1 - item.discountPercent / 100) * item.quantity;
        return {
          productId: item.product.id,
          productName: item.product.name,
          barcode: item.product.barcode,
          quantity: item.quantity,
          unitPrice: unitPrice,
          discountPercent: item.discountPercent,
          totalPrice: Number(lineTotal.toFixed(2)),
        };
      });

      const changeGiven = paymentMethod === 'CASH' ? Math.max(0, amountTendered - cartTotal) : 0;

      const orderNumber = `REC-${new Date().getFullYear()}${(new Date().getMonth() + 1)
        .toString()
        .padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const completedOrder: Order = {
        id: 'ord-' + Date.now(),
        receiptNumber: orderNumber,
        timestamp: new Date().toISOString(),
        items: orderItems,
        grossAmount: Number(cartGrossSubtotal.toFixed(2)),
        subtotal: Number(cartSubtotal.toFixed(2)),
        discountAmount: cartTotalDiscount,
        taxAmount: Number(cartTax.toFixed(2)),
        total: cartTotal,
        paymentMethod,
        amountTendered: paymentMethod === 'CASH' ? amountTendered : cartTotal,
        changeGiven: Number(changeGiven.toFixed(2)),
        cashierName: settings.activeCashier,
        status: 'COMPLETED',
        appliedDiscountId: appliedDiscount?.id,
        appliedDiscountName: appliedDiscount?.name,
        appliedDiscountCode: appliedDiscount?.code,
        notes,
      };

      // 1. Immediately update UI state (deduct stock in local products)
      setProducts((prev) =>
        prev.map((prod) => {
          const inCart = cart.find((c) => c.product.id === prod.id);
          if (inCart) {
            return {
              ...prod,
              stock: Math.max(0, prod.stock - inCart.quantity),
            };
          }
          return prod;
        })
      );

      // 2. Add to orders list
      setOrders((prev) => [completedOrder, ...prev]);

      // 3. Audio feedback
      if (paymentMethod === 'CASH') {
        soundManager.playCashDrawer();
        setTimeout(() => soundManager.playSuccess(), 250);
      } else {
        soundManager.playSuccess();
      }

      setLastCompletedOrder(completedOrder);
      setCart([]);
      if (appliedDiscount) {
        apiClient.updateDiscount(appliedDiscount.id, { incrementUsage: true }).catch(() => {});
        setAppliedDiscount(null);
      }
      setIsPaymentModalOpen(false);

      // 4. Concurrently push to Secure Next.js API -> Supabase PostgreSQL
      apiClient
        .createOrder({
          id: completedOrder.id,
          receiptNumber: completedOrder.receiptNumber,
          timestamp: completedOrder.timestamp,
          items: completedOrder.items,
          subtotal: completedOrder.subtotal,
          discountAmount: completedOrder.discountAmount,
          taxAmount: completedOrder.taxAmount,
          total: completedOrder.total,
          paymentMethod: completedOrder.paymentMethod,
          amountTendered: completedOrder.amountTendered,
          changeGiven: completedOrder.changeGiven,
          cashierName: completedOrder.cashierName,
          notes: completedOrder.notes,
        })
        .then((res) => {
          if (res && res.data) {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === completedOrder.id
                  ? { ...o, id: res.data.id, receiptNumber: res.data.receiptNumber }
                  : o
              )
            );
            refreshFromApi();
          } else if (res && !res.success) {
            console.error('Database order creation returned error:', res.error);
          }
        })
        .catch((err) => console.error('Failed to sync order to API:', err));

      return completedOrder;
    },
    [cart, cartSubtotal, cartTax, cartTotal, settings.activeCashier]
  );

  const refundOrder = useCallback(
    async (
      orderId: string,
      reason: string
    ): Promise<{ success: boolean; message?: string; error?: string }> => {
      const target = orders.find((o) => o.id === orderId || o.receiptNumber === orderId);
      if (!target || target.status === 'REFUNDED') {
        return { success: false, error: 'Order not found or already refunded' };
      }

      // Restore stock locally
      setProducts((prev) =>
        prev.map((prod) => {
          const returnedItem = target.items.find((i) => i.productId === prod.id);
          if (returnedItem) {
            return {
              ...prod,
              stock: prod.stock + returnedItem.quantity,
            };
          }
          return prod;
        })
      );

      // Update order status locally
      setOrders((prev) =>
        prev.map((o) =>
          o.id === target.id
            ? {
                ...o,
                status: 'REFUNDED',
                refundReason: reason || 'Customer requested return / refund',
              }
            : o
        )
      );

      soundManager.playClick();

      // Call API refund endpoint to update database & restore stock
      try {
        const res = await apiClient.refundOrder(target.id, reason);
        if (res && res.success) {
          await refreshFromApi();
          return {
            success: true,
            message: res.message || 'Refund successfully updated in database.',
          };
        } else {
          return { success: false, error: res?.error || 'Database refund update failed' };
        }
      } catch (err: unknown) {
        console.error('Failed to sync refund to API:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Network error' };
      }
    },
    [orders, refreshFromApi]
  );

  // Discount Management Actions
  const applyDiscountRule = useCallback(
    (discount: Discount | null): { success: boolean; message?: string } => {
      if (!discount) {
        setAppliedDiscount(null);
        return { success: true, message: 'Discount removed' };
      }
      if (!discount.isActive) {
        soundManager.playError();
        return { success: false, message: 'This promotion is currently inactive.' };
      }
      if (discount.minOrderAmount && cartGrossSubtotal < discount.minOrderAmount) {
        soundManager.playError();
        return {
          success: false,
          message: `Minimum order amount of ${formatCurrency(discount.minOrderAmount, settings.currencySymbol)} required for this discount.`,
        };
      }
      setAppliedDiscount(discount);
      soundManager.playSuccess();
      return { success: true, message: `Applied promotion: "${discount.name}"` };
    },
    [cartGrossSubtotal, settings.currencySymbol]
  );

  const applyDiscountByCode = useCallback(
    (rawCode: string): { success: boolean; message?: string } => {
      const code = rawCode.trim().toUpperCase();
      if (!code) {
        return { success: false, message: 'Please enter a coupon code.' };
      }
      const matched = discounts.find(
        (d) => d.code && d.code.toUpperCase() === code && d.isActive
      );
      if (!matched) {
        soundManager.playError();
        return { success: false, message: `Coupon code "${code}" is invalid or inactive.` };
      }
      return applyDiscountRule(matched);
    },
    [discounts, applyDiscountRule]
  );

  const removeAppliedDiscount = useCallback(() => {
    setAppliedDiscount(null);
    soundManager.playClick();
  }, []);

  const createDiscountRule = useCallback(
    async (newDisc: Omit<Discount, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
      try {
        const res = await apiClient.createDiscount(newDisc);
        if (res.success && res.data) {
          soundManager.playSuccess();
          toast.success(`Promotion "${newDisc.name}" created!`, 'Discount Created');
          await refreshFromApi();
          return true;
        } else {
          soundManager.playError();
          toast.error(res.error || 'Failed to create discount rule', 'Error');
          return false;
        }
      } catch (err: unknown) {
        soundManager.playError();
        toast.error('Network error creating discount', 'Error');
        return false;
      }
    },
    [refreshFromApi]
  );

  const updateDiscountRule = useCallback(
    async (id: string, updated: Partial<Discount>): Promise<boolean> => {
      try {
        const res = await apiClient.updateDiscount(id, updated);
        if (res.success) {
          soundManager.playSuccess();
          toast.success('Discount rule updated!', 'Updated');
          await refreshFromApi();
          return true;
        } else {
          soundManager.playError();
          toast.error(res.error || 'Failed to update discount', 'Error');
          return false;
        }
      } catch (err) {
        soundManager.playError();
        toast.error('Network error updating discount', 'Error');
        return false;
      }
    },
    [refreshFromApi]
  );

  const toggleDiscountActive = useCallback(
    async (id: string, active: boolean): Promise<boolean> => {
      try {
        const res = await apiClient.updateDiscount(id, { isActive: active });
        if (res.success) {
          setDiscounts((prev) =>
            prev.map((d) => (d.id === id ? { ...d, isActive: active } : d))
          );
          if (!active && appliedDiscount?.id === id) {
            setAppliedDiscount(null);
          }
          soundManager.playClick();
          toast.info(`Discount ${active ? 'activated' : 'deactivated'}`, 'Status Changed');
          await refreshFromApi();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [appliedDiscount]
  );

  const deleteDiscountRule = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await apiClient.deleteDiscount(id);
        if (res.success) {
          soundManager.playClick();
          toast.info('Discount rule deleted', 'Deleted');
          if (appliedDiscount?.id === id) {
            setAppliedDiscount(null);
          }
          await refreshFromApi();
          return true;
        } else {
          toast.error(res.error || 'Failed to delete discount', 'Error');
          return false;
        }
      } catch {
        toast.error('Network error deleting discount', 'Error');
        return false;
      }
    },
    [appliedDiscount, refreshFromApi]
  );

  // Category Actions
  const createCategory = useCallback(
    async (category: Omit<Category, 'id' | 'productCount' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<boolean> => {
      soundManager.playClick();
      try {
        const res = await apiClient.createCategory(category);
        if (res.success) {
          toast.success(`Category "${category.name}" created`, 'Category Saved');
          await refreshFromApi();
          return true;
        } else {
          toast.error(res.error || 'Failed to create category', 'Database Error');
          return false;
        }
      } catch {
        toast.error('Network error creating category', 'Connection Error');
        return false;
      }
    },
    [refreshFromApi]
  );

  const updateCategory = useCallback(
    async (id: string, category: Partial<Category>): Promise<boolean> => {
      soundManager.playClick();
      try {
        const res = await apiClient.updateCategory(id, category);
        if (res.success) {
          toast.success('Category updated successfully', 'Saved');
          await refreshFromApi();
          return true;
        } else {
          toast.error(res.error || 'Failed to update category', 'Database Error');
          return false;
        }
      } catch {
        toast.error('Network error updating category', 'Connection Error');
        return false;
      }
    },
    [refreshFromApi]
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<boolean> => {
      soundManager.playClick();
      try {
        const res = await apiClient.deleteCategory(id);
        if (res.success) {
          toast.info('Category deleted', 'Deleted');
          await refreshFromApi();
          return true;
        } else {
          toast.error(res.error || 'Failed to delete category', 'Database Error');
          return false;
        }
      } catch {
        toast.error('Network error deleting category', 'Connection Error');
        return false;
      }
    },
    [refreshFromApi]
  );

  // Brand Actions
  const createBrand = useCallback(
    async (brand: Omit<Brand, 'id' | 'productCount' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<boolean> => {
      soundManager.playClick();
      try {
        const res = await apiClient.createBrand(brand);
        if (res.success) {
          toast.success(`Brand "${brand.name}" created`, 'Brand Saved');
          await refreshFromApi();
          return true;
        } else {
          toast.error(res.error || 'Failed to create brand', 'Database Error');
          return false;
        }
      } catch {
        toast.error('Network error creating brand', 'Connection Error');
        return false;
      }
    },
    [refreshFromApi]
  );

  const updateBrand = useCallback(
    async (id: string, brand: Partial<Brand>): Promise<boolean> => {
      soundManager.playClick();
      try {
        const res = await apiClient.updateBrand(id, brand);
        if (res.success) {
          toast.success('Brand updated successfully', 'Saved');
          await refreshFromApi();
          return true;
        } else {
          toast.error(res.error || 'Failed to update brand', 'Database Error');
          return false;
        }
      } catch {
        toast.error('Network error updating brand', 'Connection Error');
        return false;
      }
    },
    [refreshFromApi]
  );

  const deleteBrand = useCallback(
    async (id: string): Promise<boolean> => {
      soundManager.playClick();
      try {
        const res = await apiClient.deleteBrand(id);
        if (res.success) {
          toast.info('Brand deleted', 'Deleted');
          await refreshFromApi();
          return true;
        } else {
          toast.error(res.error || 'Failed to delete brand', 'Database Error');
          return false;
        }
      } catch {
        toast.error('Network error deleting brand', 'Connection Error');
        return false;
      }
    },
    [refreshFromApi]
  );

  // Online Orders & Fulfillment Actions
  const updateFulfillmentStatus = useCallback(
    async (
      orderId: string,
      status: FulfillmentStatus,
      estimatedTime?: string,
      notes?: string
    ): Promise<{ success: boolean; message?: string; error?: string }> => {
      soundManager.playClick();
      try {
        const res = await apiClient.updateOrderStatus(orderId, status, estimatedTime, notes);
        if (res.success) {
          toast.success(`Order status updated to "${status}"`, 'Fulfillment Updated');
          await refreshFromApi();
          return { success: true, message: res.message };
        } else {
          toast.error(res.error || 'Failed to update order status', 'Database Error');
          return { success: false, error: res.error };
        }
      } catch (err: any) {
        toast.error('Network error updating order status', 'Connection Error');
        return { success: false, error: err.message };
      }
    },
    [refreshFromApi]
  );

  const updatePaymentStatus = useCallback(
    async (
      orderId: string,
      status: OrderPaymentStatus
    ): Promise<{ success: boolean; message?: string; error?: string }> => {
      soundManager.playClick();
      try {
        const res = await apiClient.updatePaymentStatus(orderId, status);
        if (res.success) {
          toast.success(`Payment marked as ${status}`, 'Payment Status');
          await refreshFromApi();
          return { success: true, message: res.message };
        } else {
          toast.error(res.error || 'Failed to update payment status', 'Database Error');
          return { success: false, error: res.error };
        }
      } catch (err: any) {
        toast.error('Network error updating payment status', 'Connection Error');
        return { success: false, error: err.message };
      }
    },
    [refreshFromApi]
  );

  const saveCustomer = useCallback(
    async (
      customer: Partial<OnlineCustomer>
    ): Promise<{ success: boolean; message?: string; error?: string; data?: OnlineCustomer }> => {
      soundManager.playClick();
      try {
        const res = await apiClient.saveCustomer(customer);
        if (res.success) {
          toast.success('Customer profile saved successfully', 'Customer Saved');
          await refreshFromApi();
          return { success: true, data: res.data };
        } else {
          toast.error(res.error || 'Failed to save customer', 'Database Error');
          return { success: false, error: res.error };
        }
      } catch (err: any) {
        toast.error('Network error saving customer', 'Connection Error');
        return { success: false, error: err.message };
      }
    },
    [refreshFromApi]
  );

  const addProduct = useCallback(
    async (newProd: Omit<Product, 'id'>) => {
      soundManager.playSuccess();
      try {
        const res = await apiClient.createProduct(newProd);
        if (res && res.success && res.data) {
          const createdProduct = res.data;
          setProducts((prev) => [createdProduct, ...prev.filter((p) => p.id !== createdProduct.id)]);
        } else if (res && !res.success) {
          toast.error(res.error || 'Failed to save product to database', 'Database Error');
        }
        await refreshFromApi();
      } catch (err: unknown) {
        console.error('Failed to add product to database:', err);
        toast.error('Network error while saving product', 'Connection Error');
      }
    },
    [refreshFromApi]
  );

  const updateProduct = useCallback(
    async (updated: Product) => {
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      soundManager.playClick();
      try {
        const res = await apiClient.updateProduct(updated.id, updated);
        if (res && !res.success) {
          toast.error(res.error || 'Failed to update product in database', 'Database Error');
        }
        await refreshFromApi();
      } catch (err: unknown) {
        console.error('Failed to update product in database:', err);
        toast.error('Network error while updating product', 'Connection Error');
      }
    },
    [refreshFromApi]
  );

  const restockProduct = useCallback((productId: string, amount: number) => {
    soundManager.playBeep();
    apiClient
      .restockProduct(productId, amount)
      .then(() => refreshFromApi())
      .catch((err) => {
        console.error('Failed to restock in database:', err);
      });
  }, [refreshFromApi]);

  const deleteProduct = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    soundManager.playClick();

    apiClient
      .deleteProduct(productId)
      .then(() => refreshFromApi())
      .catch((err) => {
        console.error('Failed to delete product in database:', err);
      });
  }, [refreshFromApi]);

  const updateSettings = useCallback((newSettings: Partial<POSSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    apiClient
      .updateSettings(newSettings)
      .then((res) => {
        if (res && res.success && res.data) {
          setSettings(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to update settings in database:', err);
      });
  }, []);

  const performCashDrop = useCallback((amount: number, reason: string) => {
    setShift((prev) => {
      const updated = {
        ...prev,
        cashDrops: prev.cashDrops + amount,
        notes:
          (prev.notes ? prev.notes + '\n' : '') +
          `Cash drop: ${formatCurrency(amount, settings.currencySymbol)} (${reason}) at ${new Date().toLocaleTimeString()}`,
      };
      apiClient.saveShift(updated).catch(() => {});
      return updated;
    });
    soundManager.playCashDrawer();
  }, [settings.currencySymbol]);

  const closeShift = useCallback((actualCashInDrawer: number, notes?: string) => {
    setShift((prev) => {
      const updated = {
        ...prev,
        endedAt: new Date().toISOString(),
        actualDrawerCash: actualCashInDrawer,
        notes: (prev.notes ? prev.notes + '\n' : '') + (notes || 'Shift closed.'),
        isClosed: true,
      };
      apiClient.saveShift(updated).catch(() => {});
      return updated;
    });
    soundManager.playClick();
  }, []);

  const startNewShift = useCallback((startingFloat: number, cashierName: string) => {
    const newShift: CashierShift = {
      id: 'shift-' + Date.now(),
      cashierName,
      startedAt: new Date().toISOString(),
      startingFloat,
      cashDrops: 0,
      isClosed: false,
    };
    setShift(newShift);
    setSettings((prev) => ({ ...prev, activeCashier: cashierName }));
    soundManager.playSuccess();
    apiClient.saveShift(newShift).catch(() => {});
  }, []);

  const resetToSampleData = useCallback(() => {
    if (window.confirm('Reset current cart and refresh all data directly from the live database?')) {
      setCart([]);
      refreshFromApi();
      soundManager.playSuccess();
    }
  }, [refreshFromApi]);

  return (
    <POSContext.Provider
      value={{
        products,
        categories,
        brands,
        cart,
        heldOrders,
        orders,
        onlineOrders,
        posOrders,
        pendingOnlineOrdersCount,
        customers,
        discounts,
        appliedDiscount,
        settings,
        shift,
        activeTab,
        setActiveTab,
        selectedCustomerIdForView,
        setSelectedCustomerIdForView,
        isPaymentModalOpen,
        setIsPaymentModalOpen,
        lastCompletedOrder,
        setLastCompletedOrder,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        dbSource,
        isSupabaseLive,
        isSyncing,
        isLoading,
        refreshFromApi,
        addToCart,
        addByBarcode,
        updateQuantity,
        setItemQuantity,
        setItemDiscount,
        removeFromCart,
        clearCart,
        applyDiscountRule,
        applyDiscountByCode,
        removeAppliedDiscount,
        createDiscountRule,
        updateDiscountRule,
        toggleDiscountActive,
        deleteDiscountRule,
        createCategory,
        updateCategory,
        deleteCategory,
        createBrand,
        updateBrand,
        deleteBrand,
        updateFulfillmentStatus,
        updatePaymentStatus,
        saveCustomer,
        cartGrossSubtotal,
        cartLineDiscount,
        cartOrderDiscount,
        cartTotalDiscount,
        cartSubtotal,
        cartTax,
        cartTotal,
        cartItemCount,
        formatPrice,
        holdCurrentCart,
        resumeHeldOrder,
        deleteHeldOrder,
        processPayment,
        refundOrder,
        addProduct,
        updateProduct,
        restockProduct,
        deleteProduct,
        updateSettings,
        performCashDrop,
        closeShift,
        startNewShift,
        resetToSampleData,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
}
