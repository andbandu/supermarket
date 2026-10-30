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
import { soundManager } from '@/lib/sound';
import { apiClient } from '@/lib/apiClient';
import { toast } from '@/context/ToastContext';
import { formatCurrency } from '@/lib/currency';

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

  // Calculations
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
  const [settings, setSettings] = useState<POSSettings>(EMPTY_SETTINGS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shift, setShift] = useState<CashierShift>(EMPTY_SHIFT);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'history' | 'shift' | 'settings'>('pos');
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

      // 3. Fetch live orders from PostgreSQL (reflects live database state immediately)
      const ordersRes = await apiClient.getOrders();
      if (ordersRes && ordersRes.success && Array.isArray(ordersRes.data)) {
        setOrders(ordersRes.data);
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
    } catch (err) {
      console.warn('Real-time database sync warning:', err);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
      setIsHydrated(true);
    }
  }, []);

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
        isLoading,
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
