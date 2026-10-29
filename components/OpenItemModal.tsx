'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePOS } from '@/context/POSContext';
import { Product, ProductCategory } from '@/types/pos';
import { soundManager } from '@/lib/sound';
import { toast } from '@/context/ToastContext';
import {
  Sparkles,
  X,
  Plus,
  Minus,
  DollarSign,
  Tag,
  Check,
  ShoppingBag,
} from 'lucide-react';

interface OpenItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PRESETS = [
  { name: 'Fresh Bakery Bun (Paan)', price: 120.00, category: 'Bakery & Fresh' },
  { name: 'Hot Ceylon Tea / Coffee', price: 100.00, category: 'Beverages' },
  { name: 'Rice & Curry Lunch Packet', price: 450.00, category: 'Ready-to-Eat' },
  { name: 'Fresh Fruit / Bananas', price: 150.00, category: 'Bakery & Fresh' },
  { name: 'Reusable Shopping Bag', price: 50.00, category: 'Essentials' },
  { name: 'Misc Grocery Item', price: 250.00, category: 'Essentials' },
];

const CATEGORIES: ProductCategory[] = [
  'Essentials',
  'Beverages',
  'Bakery & Fresh',
  'Ready-to-Eat',
  'Snacks & Candy',
  'Dairy & Frozen',
  'Household & Personal',
];

export default function OpenItemModal({ isOpen, onClose }: OpenItemModalProps) {
  const { settings, addProduct, addToCart, formatPrice } = usePOS();

  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState<ProductCategory>('Essentials');
  const [isTaxable, setIsTaxable] = useState(true);

  const priceInputRef = useRef<HTMLInputElement>(null);

  // Reset and autofocus when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('Custom Minimart Item');
      setPriceStr('');
      setQuantity(1);
      setCategory('Essentials');
      setIsTaxable(true);

      // Focus price input immediately for rapid cashier entry
      setTimeout(() => {
        priceInputRef.current?.focus();
        priceInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    soundManager.playClick();
    setName(preset.name);
    setPriceStr(preset.price.toFixed(2));
    setCategory(preset.category as ProductCategory);
    priceInputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
      soundManager.playError();
      toast.warning('Please enter a valid item price greater than 0.', 'Invalid Price');
      priceInputRef.current?.focus();
      return;
    }

    const itemName = name.trim() || 'Custom Item';

    const customProduct: Product = {
      id: 'custom-' + Date.now(),
      barcode: 'OPEN-' + Math.floor(100000 + Math.random() * 900000),
      name: itemName,
      category,
      price: Number(price.toFixed(2)),
      costPrice: Number((price * 0.6).toFixed(2)),
      stock: 9999,
      reorderLevel: 10,
      unit: 'item',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      iconName: 'Sparkles',
      isTaxable,
    };

    addProduct(customProduct);
    addToCart(customProduct, quantity);

    soundManager.playBeep();
    toast.success(
      `Added ${quantity}x "${itemName}" (${formatPrice(price * quantity)}) to cart`,
      'Open Item Added'
    );

    onClose();
  };

  const handleQuickAddPrice = (add: number) => {
    soundManager.playClick();
    const current = parseFloat(priceStr) || 0;
    setPriceStr((current + add).toFixed(2));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Add Open / Custom Item</h3>
              <p className="text-[11px] text-slate-400">
                Direct open-price entry for unbarcoded or special items
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Quick Minimart Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {QUICK_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition flex flex-col group"
                >
                  <span className="text-xs text-slate-300 group-hover:text-white font-medium truncate">
                    {p.name}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                    {formatPrice(p.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Item Description / Name</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hot Coffee, Deli Special, Bag Fee"
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-600 transition"
            />
          </div>

          {/* Price & Quantity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Price Input with Quick Add chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Price ({settings.currencySymbol})</span>
                </span>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">Required</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono font-bold text-base">
                  {settings.currencySymbol}
                </span>
                <input
                  ref={priceInputRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-xl pl-14 pr-3 py-2 text-lg font-mono font-bold text-white placeholder:text-slate-600 shadow-inner"
                />
              </div>

              {/* Quick denomination chips */}
              <div className="flex items-center gap-1.5 mt-2">
                {[50, 100, 500, 1000].map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => handleQuickAddPrice(amt)}
                    className="flex-1 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-mono border border-slate-700/60 transition"
                  >
                    +{settings.currencySymbol} {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Stepper */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                <span>Quantity</span>
              </label>
              <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl p-1 h-[46px]">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setQuantity((q) => Math.max(1, q - 1));
                  }}
                  className="h-full w-12 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center font-mono font-bold text-base text-white">
                  {quantity}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setQuantity((q) => q + 1);
                  }}
                  className="h-full w-12 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Taxable Toggle */}
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isTaxable}
                  onChange={(e) => setIsTaxable(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-xs text-slate-300">
                  Subject to standard sales tax ({settings.taxRatePercent}%)
                </span>
              </label>
            </div>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-200"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Bottom Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition"
            >
              <Check className="w-4 h-4" />
              <span>Add to Cart ({formatPrice((parseFloat(priceStr) || 0) * quantity)})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

