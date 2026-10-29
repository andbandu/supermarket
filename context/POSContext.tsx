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
} from '@/types/pos';
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from '@/lib/mockData';
import { soundManager } from '@/lib/sound';
import { apiClient } from '@/lib/apiClient';

interface POSContextType {
  products: Product[];
  cart: CartItem[];
  heldOrders: HeldOrder[];
  orders: Order[];
  settings: POSSettings;
  shift: CashierShift;
  activeTab: 'pos' | 'inventory' | 'history' | 'shift' | 'settings';
  setActiveTab: (tab: 'pos' | 'inventory' | 'history' | 'shift' | 'settings') => void;
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
  refreshFromApi: () => Promise<void>;

  // Cart Actions
  addToCart: (product: Product, qty?: number) => void;
  addByBarcode: (barcode: string) => boolean;
  updateQuantity: (productId: string, delta: number) => void;
  setItemQuantity: (productId: string, quantity: number) => void;
  setItemDiscount: (productId: string, discountPercent: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  // Calculations
  cartSubtotal: number;
  cartTax: number;
  cartTotal: number;
  cartItemCount: number;

  // Held Orders
  holdCurrentCart: (customerNote?: string) => void;
  resumeHeldOrder: (heldId: string) => void;
  deleteHeldOrder: (heldId: string) => void;

  // Checkout & Transactions
  processPayment: (paymentMethod: PaymentMethod, amountTendered: number, notes?: string) => Order | null;
  refundOrder: (orderId: string, reason: string) => void;

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

export function POSProvider({ children }: { children: React.ReactNode }) {
  // Stable initial states for SSR / prerender safety
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [settings, setSettings] = useState<POSSettings>(DEFAULT_SETTINGS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shift, setShift] = useState<CashierShift>({
    id: 'shift-current',
    cashierName: DEFAULT_SETTINGS.activeCashier,
    startedAt: '2026-10-29T08:00:00.000Z',
    startingFloat: 200.0,
    cashDrops: 0,
    isClosed: false,
  });

  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'history' | 'shift' | 'settings'>('pos');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isHydrated, setIsHydrated] = useState(false);

  // Sync state
  const [dbSource, setDbSource] = useState<string>('Checking...');
  const [isSupabaseLive, setIsSupabaseLive] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Load from Supabase via Next.js API
  const refreshFromApi = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 1. Health check
      const health = await apiClient.checkHealth();
      if (health && health.database) {
        setDbSource(health.database);
        setIsSupabaseLive(health.database.includes('Supabase'));
      }

      // 2. Products from API
      const prodRes = await apiClient.getProducts();
      if (prodRes && prodRes.success && prodRes.data && prodRes.data.length > 0) {
        setProducts(prodRes.data);
      }

      // 3. Orders from API
      const ordersRes = await apiClient.getOrders();
      if (ordersRes && ordersRes.success && ordersRes.data && ordersRes.data.length > 0) {
        setOrders(ordersRes.data);
      }

      // 4. Settings from API
      const settingsRes = await apiClient.getSettings();
      if (settingsRes && settingsRes.success && settingsRes.data) {
        setSettings((prev) => ({ ...prev, ...settingsRes.data }));
      }
    } catch (err) {
      console.warn('API sync warning (operating in local offline mode):', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Load persisted state on client mount, then sync with API
  useEffect(() => {
    try {
      const savedProducts = localStorage.getItem('minimart_pos_products');
      if (savedProducts) setProducts(JSON.parse(savedProducts));

      const savedSettings = localStorage.getItem('minimart_pos_settings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));

      const savedCart = localStorage.getItem('minimart_pos_cart');
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedHeld = localStorage.getItem('minimart_pos_held_orders');
      if (savedHeld) setHeldOrders(JSON.parse(savedHeld));

      const savedOrders = localStorage.getItem('minimart_pos_orders');
      if (savedOrders) setOrders(JSON.parse(savedOrders));

      const savedShift = localStorage.getItem('minimart_pos_shift');
      if (savedShift) {
        setShift(JSON.parse(savedShift));
      } else {
        setShift({
          id: 'shift-' + Date.now(),
          cashierName: DEFAULT_SETTINGS.activeCashier,
          startedAt: new Date().toISOString(),
          startingFloat: 200.0,
          cashDrops: 0,
          isClosed: false,
        });
      }
    } catch {
      // fallback
    }
    setIsHydrated(true);

    // Initial API Sync
    refreshFromApi();
  }, [refreshFromApi]);

  // Sync sound manager enabled flag with settings
  useEffect(() => {
    soundManager.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  // Persist back to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('minimart_pos_products', JSON.stringify(products));
  }, [products, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('minimart_pos_settings', JSON.stringify(settings));
  }, [settings, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('minimart_pos_cart', JSON.stringify(cart));
  }, [cart, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('minimart_pos_held_orders', JSON.stringify(heldOrders));
  }, [heldOrders, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('minimart_pos_orders', JSON.stringify(orders));
  }, [orders, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('minimart_pos_shift', JSON.stringify(shift));
  }, [shift, isHydrated]);

  // Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unitPrice = item.customPrice ?? item.product.price;
      const discounted = unitPrice * (1 - item.discountPercent / 100);
      return sum + discounted * item.quantity;
    }, 0);
  }, [cart]);

  const cartTax = useMemo(() => {
    return cart.reduce((sum, item) => {
      if (!item.product.isTaxable) return sum;
      const unitPrice = item.customPrice ?? item.product.price;
      const discounted = unitPrice * (1 - item.discountPercent / 100);
      const itemSubtotal = discounted * item.quantity;
      return sum + itemSubtotal * (settings.taxRatePercent / 100);
    }, 0);
  }, [cart, settings.taxRatePercent]);

  const cartTotal = useMemo(() => {
    return Number((cartSubtotal + cartTax).toFixed(2));
  }, [cartSubtotal, cartTax]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Cart operations
  const addToCart = useCallback((product: Product, qty: number = 1) => {
    const existing = cart.find((i) => i.product.id === product.id);
    const currentQtyInCart = existing ? existing.quantity : 0;

    if (currentQtyInCart + qty > product.stock) {
      soundManager.playError();
      alert(`Cannot add more "${product.name}". Only ${product.stock} left in stock.`);
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
        return [...prev, { product, quantity: qty, discountPercent: 0 }];
      }
    });
  }, [cart]);

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
        alert(`Cannot exceed available stock of ${target.product.stock} units.`);
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
        alert(`Maximum available stock is ${target.product.stock}.`);
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
        const lineTotal = unitPrice * (1 - item.discountPercent / 100) * item.quantity;
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
        subtotal: Number(cartSubtotal.toFixed(2)),
        discountAmount: Number(
          cart.reduce((sum, item) => {
            const unitPrice = item.customPrice ?? item.product.price;
            return sum + (unitPrice * (item.discountPercent / 100)) * item.quantity;
          }, 0).toFixed(2)
        ),
        taxAmount: Number(cartTax.toFixed(2)),
        total: cartTotal,
        paymentMethod,
        amountTendered: paymentMethod === 'CASH' ? amountTendered : cartTotal,
        changeGiven: Number(changeGiven.toFixed(2)),
        cashierName: settings.activeCashier,
        status: 'COMPLETED',
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
      setIsPaymentModalOpen(false);

      // 4. Concurrently push to Secure Next.js API -> Supabase PostgreSQL
      apiClient
        .createOrder({
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
        .catch((err) => console.error('Failed to sync order to API:', err));

      return completedOrder;
    },
    [cart, cartSubtotal, cartTax, cartTotal, settings.activeCashier]
  );

  const refundOrder = useCallback((orderId: string, reason: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target || target.status === 'REFUNDED') return;

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
        o.id === orderId
          ? {
              ...o,
              status: 'REFUNDED',
              refundReason: reason || 'Customer requested return / refund',
            }
          : o
      )
    );

    soundManager.playClick();

    // Call API refund endpoint
    apiClient.refundOrder(orderId, reason).catch((err) => {
      console.error('Failed to sync refund to API:', err);
    });
  }, [orders]);

  const addProduct = useCallback((newProd: Omit<Product, 'id'>) => {
    const id = 'prod-' + Date.now().toString().slice(-6);
    const created: Product = {
      ...newProd,
      id,
    };
    setProducts((prev) => [created, ...prev]);
    soundManager.playSuccess();

    // Sync to API
    apiClient.createProduct(created).catch((err) => {
      console.error('Failed to add product to API:', err);
    });
  }, []);

  const updateProduct = useCallback((updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    soundManager.playClick();

    // Sync to API
    apiClient.updateProduct(updated.id, updated).catch((err) => {
      console.error('Failed to update product on API:', err);
    });
  }, []);

  const restockProduct = useCallback((productId: string, amount: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: p.stock + amount } : p))
    );
    soundManager.playBeep();

    // Sync to API
    apiClient.restockProduct(productId, amount).catch((err) => {
      console.error('Failed to restock on API:', err);
    });
  }, []);

  const deleteProduct = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    soundManager.playClick();

    // Sync to API
    apiClient.deleteProduct(productId).catch((err) => {
      console.error('Failed to delete on API:', err);
    });
  }, []);

  const updateSettings = useCallback((newSettings: Partial<POSSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    apiClient.updateSettings(newSettings).catch((err) => {
      console.error('Failed to update settings on API:', err);
    });
  }, []);

  const performCashDrop = useCallback((amount: number, reason: string) => {
    setShift((prev) => {
      const updated = {
        ...prev,
        cashDrops: prev.cashDrops + amount,
        notes:
          (prev.notes ? prev.notes + '\n' : '') +
          `Cash drop: $${amount} (${reason}) at ${new Date().toLocaleTimeString()}`,
      };
      apiClient.saveShift(updated).catch(() => {});
      return updated;
    });
    soundManager.playCashDrawer();
  }, []);

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
    if (window.confirm('Reset all catalog and settings to initial Minimart default data?')) {
      setProducts(INITIAL_PRODUCTS);
      setSettings(DEFAULT_SETTINGS);
      setCart([]);
      setHeldOrders([]);
      localStorage.clear();
      soundManager.playSuccess();
    }
  }, []);

  return (
    <POSContext.Provider
      value={{
        products,
        cart,
        heldOrders,
        orders,
        settings,
        shift,
        activeTab,
        setActiveTab,
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
        refreshFromApi,
        addToCart,
        addByBarcode,
        updateQuantity,
        setItemQuantity,
        setItemDiscount,
        removeFromCart,
        clearCart,
        cartSubtotal,
        cartTax,
        cartTotal,
        cartItemCount,
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
