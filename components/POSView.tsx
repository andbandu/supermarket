'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { Product, ProductCategory } from '@/types/pos';
import { soundManager } from '@/lib/sound';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Percent,
  PauseCircle,
  CreditCard,
  ShoppingBag,
  Sparkles,
  Zap,
  Coffee,
  Package,
  Droplets,
  Cookie,
  Wheat,
  Milk,
  Sandwich,
  Apple,
  Utensils,
  Soup,
  IceCream,
  Smile,
  Box,
  BatteryCharging,
  Flame,
  Cable,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

const CATEGORIES: ProductCategory[] = [
  'All',
  'Beverages',
  'Snacks & Candy',
  'Bakery & Fresh',
  'Ready-to-Eat',
  'Dairy & Frozen',
  'Household & Personal',
  'Essentials',
];

// Helper to map icon name to Lucide Icon
function ProductIcon({ name, className = 'w-5 h-5' }: { name?: string; className?: string }) {
  switch (name) {
    case 'Zap':
      return <Zap className={className} />;
    case 'Coffee':
      return <Coffee className={className} />;
    case 'Droplets':
      return <Droplets className={className} />;
    case 'Cookie':
      return <Cookie className={className} />;
    case 'Wheat':
      return <Wheat className={className} />;
    case 'Milk':
      return <Milk className={className} />;
    case 'Sandwich':
      return <Sandwich className={className} />;
    case 'Apple':
      return <Apple className={className} />;
    case 'Utensils':
    case 'UtensilsCrossed':
      return <Utensils className={className} />;
    case 'Soup':
      return <Soup className={className} />;
    case 'IceCream':
      return <IceCream className={className} />;
    case 'Smile':
      return <Smile className={className} />;
    case 'Box':
      return <Box className={className} />;
    case 'BatteryCharging':
      return <BatteryCharging className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Cable':
      return <Cable className={className} />;
    default:
      return <Package className={className} />;
  }
}

export default function POSView({ onOpenHeldOrders }: { onOpenHeldOrders: () => void }) {
  const {
    products,
    cart,
    addToCart,
    addByBarcode,
    updateQuantity,
    removeFromCart,
    setItemDiscount,
    clearCart,
    cartSubtotal,
    cartTax,
    cartTotal,
    cartItemCount,
    settings,
    setIsPaymentModalOpen,
    holdCurrentCart,
    heldOrders,
  } = usePOS();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [discountingItemId, setDiscountingItemId] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState<string>('10');

  // Fast Barcode Scanner input ref
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Autofocus barcode input on mount and keep it ready
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Handle barcode submission (from hardware scanner or manual typing)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const success = addByBarcode(barcodeInput.trim());
    if (success) {
      setBarcodeInput('');
    } else {
      alert(`No product found with barcode or SKU: "${barcodeInput}"`);
    }
    barcodeInputRef.current?.focus();
  };

  // Filter products by category and search
  const filteredProducts = products.filter((prod) => {
    const matchesCategory =
      selectedCategory === 'All' || prod.category === selectedCategory;
    const matchesQuery =
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.barcode.includes(searchQuery);
    return matchesCategory && matchesQuery;
  });

  const handleApplyDiscount = (productId: string) => {
    const num = parseFloat(discountValue);
    if (!isNaN(num)) {
      setItemDiscount(productId, num);
    }
    setDiscountingItemId(null);
  };

  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    const note = window.prompt(
      'Enter customer name or note for held order:',
      `Customer @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
    if (note !== null) {
      holdCurrentCart(note);
    }
  };

  // Quick custom item modal (e.g., loose fruit, bakery, manual open price item)
  const handleAddCustomItem = () => {
    const name = window.prompt('Custom Item Name (e.g., Morning Coffee, Fresh Muffin):', 'Custom Minimart Item');
    if (!name) return;
    const priceStr = window.prompt('Enter Item Price ($):', '2.50');
    const price = parseFloat(priceStr || '0');
    if (isNaN(price) || price <= 0) return;

    const customProduct: Product = {
      id: 'custom-' + Date.now(),
      barcode: 'CUSTOM-' + Math.floor(1000 + Math.random() * 9000),
      name,
      category: 'Essentials',
      price: Number(price.toFixed(2)),
      costPrice: Number((price * 0.5).toFixed(2)),
      stock: 999,
      reorderLevel: 10,
      unit: 'pc',
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      iconName: 'Package',
      isTaxable: true,
    };

    addToCart(customProduct, 1);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-61px)] overflow-hidden bg-slate-950">
      {/* LEFT/CENTER AREA: Products & Quick Scan */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-800">
        {/* Top Control Bar: Search & Fast Barcode Scan */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-3">
          {/* Barcode scanner input */}
          <form
            onSubmit={handleBarcodeSubmit}
            className="flex-1 min-w-[260px] relative flex items-center"
          >
            <div className="absolute left-3 text-emerald-400 pointer-events-none flex items-center">
              <Barcode className="w-5 h-5" />
            </div>
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode or type SKU (Press Enter)..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full bg-slate-950 text-white pl-10 pr-24 py-2.5 rounded-xl border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-mono placeholder:text-slate-500 transition"
            />
            <button
              type="submit"
              className="absolute right-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              Scan
            </button>
          </form>

          {/* Text Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 text-white pl-9 pr-3 py-2.5 rounded-xl border border-slate-700/80 focus:border-emerald-500 text-sm placeholder:text-slate-500 transition"
            />
          </div>

          {/* Custom Open-price Item Button */}
          <button
            onClick={handleAddCustomItem}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition"
            title="Add custom item with open price"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Open Item</span>
          </button>
        </div>

        {/* Categories Bar */}
        <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-800/80 overflow-x-auto flex items-center gap-1.5 scrollbar-thin">
          {CATEGORIES.map((cat) => {
            const count =
              cat === 'All'
                ? products.length
                : products.filter((p) => p.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  soundManager.playClick();
                  setSelectedCategory(cat);
                }}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 p-3 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <ShoppingBag className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
              <p className="text-base font-semibold text-slate-400">No products match your search</p>
              <p className="text-xs text-slate-500 mt-1">
                Try searching another keyword or select a different category.
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-lg hover:text-white"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= product.reorderLevel;
                const inCartItem = cart.find((i) => i.product.id === product.id);

                return (
                  <button
                    key={product.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(product, 1)}
                    className={`group relative text-left p-3 rounded-xl border flex flex-col justify-between transition-all select-none active:scale-[0.98] ${
                      isOutOfStock
                        ? 'bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed'
                        : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/60 hover:bg-slate-850 hover:shadow-lg hover:shadow-emerald-500/5'
                    }`}
                  >
                    {/* In Cart quantity badge */}
                    {inCartItem && (
                      <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-slate-950 font-black text-[11px] px-2 py-0.5 rounded-full shadow-md shadow-emerald-500/30">
                        {inCartItem.quantity}
                      </span>
                    )}

                    <div>
                      {/* Top icon and stock badge */}
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                            product.color || 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          <ProductIcon name={product.iconName} className="w-5 h-5" />
                        </div>

                        {/* Stock indicator */}
                        {isOutOfStock ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Out
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Low ({product.stock})
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {product.stock} {product.unit}
                          </span>
                        )}
                      </div>

                      {/* Product Name */}
                      <h4 className="text-xs font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors line-clamp-2 leading-tight">
                        {product.name}
                      </h4>

                      {/* Barcode / SKU */}
                      <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                        #{product.barcode}
                      </p>
                    </div>

                    {/* Price & Add Indicator */}
                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="font-bold text-sm text-emerald-400 font-mono">
                        {settings.currencySymbol}
                        {product.price.toFixed(2)}
                      </span>
                      <div className="w-6 h-6 rounded-md bg-slate-800 group-hover:bg-emerald-600 flex items-center justify-center text-slate-300 group-hover:text-white transition">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT AREA: Cart & Checkout Panel */}
      <div className="w-full lg:w-[420px] xl:w-[460px] flex flex-col h-full bg-slate-900 border-l border-slate-800">
        {/* Cart Header */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              Current Order
            </h3>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Hold Cart */}
            <button
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              className="p-1.5 text-xs text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 rounded-lg transition"
              title="Hold this order for later"
            >
              <PauseCircle className="w-4 h-4" />
            </button>

            {/* Clear Cart */}
            <button
              onClick={() => {
                if (cart.length > 0 && window.confirm('Clear all items in the cart?')) {
                  clearCart();
                }
              }}
              disabled={cart.length === 0}
              className="p-1.5 text-xs text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 rounded-lg transition"
              title="Clear Cart"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6">
              <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center mb-3 text-slate-600">
                <Barcode className="w-7 h-7" />
              </div>
              <p className="font-semibold text-slate-300 text-sm">Cart is Empty</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Scan an item barcode or click any product card on the left to start checkout.
              </p>
              {heldOrders.length > 0 && (
                <button
                  onClick={onOpenHeldOrders}
                  className="mt-4 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 rounded-lg text-xs font-medium transition"
                >
                  Resume Held Order ({heldOrders.length})
                </button>
              )}
            </div>
          ) : (
            cart.map((item) => {
              const unitPrice = item.customPrice ?? item.product.price;
              const lineTotal = unitPrice * (1 - item.discountPercent / 100) * item.quantity;

              return (
                <div
                  key={item.product.id}
                  className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80 hover:border-slate-700 flex flex-col gap-2 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-slate-200 truncate">
                        {item.product.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                        <span>
                          {settings.currencySymbol}
                          {unitPrice.toFixed(2)}
                        </span>
                        {item.discountPercent > 0 && (
                          <span className="text-amber-400 font-semibold">
                            (-{item.discountPercent}%)
                          </span>
                        )}
                        {!item.product.isTaxable && (
                          <span className="text-sky-400 text-[10px]">No Tax</span>
                        )}
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="text-right">
                      <span className="font-bold text-sm text-emerald-400 font-mono">
                        {settings.currencySymbol}
                        {lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Stepper & Discount row */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <div className="flex items-center gap-1">
                      {/* Discount button */}
                      <button
                        onClick={() => {
                          setDiscountingItemId(
                            discountingItemId === item.product.id ? null : item.product.id
                          );
                          setDiscountValue(item.discountPercent.toString() || '10');
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                          item.discountPercent > 0
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Apply discount to item"
                      >
                        <Percent className="w-3 h-3" />
                        <span>{item.discountPercent > 0 ? `${item.discountPercent}%` : 'Disc'}</span>
                      </button>

                      {/* Remove item */}
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center bg-slate-900 border border-slate-750 rounded-lg p-0.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white active:bg-slate-700 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold font-mono text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white active:bg-slate-700 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Discount Selector Popout */}
                  {discountingItemId === item.product.id && (
                    <div className="mt-1 p-2 bg-slate-900 border border-amber-500/40 rounded-lg flex items-center gap-2">
                      <span className="text-[11px] text-amber-400 font-medium">Discount %:</span>
                      <div className="flex gap-1 flex-1">
                        {[5, 10, 15, 20].map((pct) => (
                          <button
                            key={pct}
                            onClick={() => {
                              setItemDiscount(item.product.id, pct);
                              setDiscountingItemId(null);
                            }}
                            className="flex-1 py-0.5 bg-slate-800 hover:bg-amber-500/20 text-slate-200 text-[10px] font-bold rounded"
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-12 bg-slate-950 text-white text-xs px-1.5 py-0.5 rounded border border-slate-700 text-center"
                      />
                      <button
                        onClick={() => handleApplyDiscount(item.product.id)}
                        className="px-2 py-0.5 bg-amber-500 text-slate-950 font-bold text-xs rounded hover:bg-amber-400"
                      >
                        Set
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Cart Financial Summary & Checkout Action */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono text-slate-200">
                {settings.currencySymbol}
                {cartSubtotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1">
                <span>Sales Tax ({settings.taxRatePercent}%)</span>
              </span>
              <span className="font-mono text-slate-200">
                {settings.currencySymbol}
                {cartTax.toFixed(2)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
              <div>
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  Total Due
                </span>
                <span className="block text-[11px] text-slate-500">
                  Includes all applicable taxes
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                  {settings.currencySymbol}
                  {cartTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Large Checkout Button */}
          <button
            onClick={() => {
              if (cart.length === 0) return;
              soundManager.playClick();
              setIsPaymentModalOpen(true);
            }}
            disabled={cart.length === 0}
            className={`w-full py-3.5 px-4 rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] ${
              cart.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25 cursor-pointer'
            }`}
          >
            <CreditCard className="w-5 h-5 text-slate-950" />
            <span>PAY NOW &bull; {settings.currencySymbol}{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

