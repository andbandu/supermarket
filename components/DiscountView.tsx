'use client';

import React, { useState, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { Discount, DiscountType, DiscountScope, ProductCategory } from '@/types/pos';
import { soundManager } from '@/lib/sound';
import { toast } from '@/context/ToastContext';
import {
  Tag,
  Plus,
  Search,
  Percent,
  CheckCircle2,
  XCircle,
  Copy,
  Edit2,
  Trash2,
  Power,
  Layers,
  ShoppingBag,
  Sparkles,
  Ticket,
  Calendar,
  DollarSign,
  AlertCircle,
  X,
  BadgePercent,
  ArrowRight,
  RefreshCw,
  Package,
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

interface FormDataState {
  name: string;
  code: string;
  type: DiscountType;
  value: string;
  scope: DiscountScope;
  targetCategory: ProductCategory;
  targetProductId: string;
  targetProductName: string;
  minOrderAmount: string;
  description: string;
  isActive: boolean;
}

const INITIAL_FORM: FormDataState = {
  name: '',
  code: '',
  type: 'PERCENTAGE',
  value: '10',
  scope: 'ORDER',
  targetCategory: 'Bakery & Fresh',
  targetProductId: '',
  targetProductName: '',
  minOrderAmount: '0',
  description: '',
  isActive: true,
};

export default function DiscountView() {
  const {
    discounts,
    products,
    createDiscountRule,
    updateDiscountRule,
    toggleDiscountActive,
    deleteDiscountRule,
    formatPrice,
    isLoading,
    refreshFromApi,
    categories: registeredCategories,
  } = usePOS();

  const availableCategories = useMemo(() => {
    if (registeredCategories && registeredCategories.length > 0) {
      return registeredCategories.filter((c) => c.isActive).map((c) => c.name);
    }
    return CATEGORIES.filter((c) => c !== 'All');
  }, [registeredCategories]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [formData, setFormData] = useState<FormDataState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Top Metrics
  const activeCount = discounts.filter((d) => d.isActive).length;
  const totalRedemptions = discounts.reduce((sum, d) => sum + (d.usageCount || 0), 0);
  const orderLevelCount = discounts.filter((d) => d.scope === 'ORDER').length;
  const productLevelCount = discounts.filter((d) => d.scope === 'PRODUCT').length;
  const categoryPromoCount = discounts.filter((d) => d.scope === 'CATEGORY').length;

  // Filtered List
  const filteredDiscounts = discounts.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.code && d.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      filterType === 'ALL' ||
      d.type === filterType ||
      (filterType === 'PRODUCT_DISCOUNT_PRICE' && (d.scope === 'PRODUCT' || d.type === 'PRODUCT_DISCOUNT_PRICE'));
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && d.isActive) ||
      (filterStatus === 'INACTIVE' && !d.isActive);

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleOpenCreateModal = () => {
    soundManager.playClick();
    setEditingDiscount(null);
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (discount: Discount) => {
    soundManager.playClick();
    setEditingDiscount(discount);
    setFormData({
      name: discount.name,
      code: discount.code || '',
      type: discount.type,
      value: discount.value.toString(),
      scope: discount.scope,
      targetCategory: (discount.targetCategory as ProductCategory) || 'Bakery & Fresh',
      targetProductId: discount.targetProductId || '',
      targetProductName: discount.targetProductName || '',
      minOrderAmount: (discount.minOrderAmount || 0).toString(),
      description: discount.description || '',
      isActive: discount.isActive,
    });
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: Partial<FormDataState>) => {
    soundManager.playBeep();
    setFormData((prev) => ({
      ...prev,
      ...preset,
    }));
  };

  const handleCopyCode = (code: string) => {
    soundManager.playClick();
    navigator.clipboard.writeText(code);
    toast.success(`Coupon code "${code}" copied to clipboard!`, 'Code Copied');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      soundManager.playError();
      toast.warning('Please enter a promotion name.', 'Missing Name');
      return;
    }

    const value = parseFloat(formData.value) || 0;
    if (value <= 0) {
      soundManager.playError();
      toast.warning('Discount value must be greater than 0.', 'Invalid Value');
      return;
    }

    const determinedScope: DiscountScope =
      formData.type === 'PRODUCT_DISCOUNT_PRICE' || formData.scope === 'PRODUCT'
        ? 'PRODUCT'
        : formData.type === 'CATEGORY_PERCENT'
        ? 'CATEGORY'
        : 'ORDER';

    if (determinedScope === 'PRODUCT') {
      if (!formData.targetProductId) {
        soundManager.playError();
        toast.warning('Please select an item/product for this discount.', 'Product Required');
        return;
      }
      const targetProd = products.find((p) => p.id === formData.targetProductId);
      if (targetProd && value >= targetProd.price) {
        soundManager.playError();
        toast.warning(
          `Discount price (${formatPrice(value)}) must be lower than the regular price (${formatPrice(targetProd.price)}).`,
          'Invalid Price'
        );
        return;
      }
    }

    const minAmount = parseFloat(formData.minOrderAmount) || 0;
    setIsSubmitting(true);

    try {
      if (editingDiscount) {
        const success = await updateDiscountRule(editingDiscount.id, {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase() || undefined,
          type: formData.type,
          value,
          scope: determinedScope,
          targetCategory: determinedScope === 'CATEGORY' ? formData.targetCategory : undefined,
          targetProductId: determinedScope === 'PRODUCT' ? formData.targetProductId : undefined,
          targetProductName: determinedScope === 'PRODUCT' ? formData.targetProductName : undefined,
          minOrderAmount: minAmount,
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
        });
        if (success) {
          setIsModalOpen(false);
          setEditingDiscount(null);
        }
      } else {
        const success = await createDiscountRule({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase() || undefined,
          type: formData.type,
          value,
          scope: determinedScope,
          targetCategory: determinedScope === 'CATEGORY' ? formData.targetCategory : undefined,
          targetProductId: determinedScope === 'PRODUCT' ? formData.targetProductId : undefined,
          targetProductName: determinedScope === 'PRODUCT' ? formData.targetProductName : undefined,
          minOrderAmount: minAmount,
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
        });
        if (success) {
          setIsModalOpen(false);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Delete discount rule "${name}"? This action cannot be undone.`)) {
      await deleteDiscountRule(id);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* Top Discount Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Promotions</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{activeCount} Rules</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Ticket className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Redemptions</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-white mt-0.5">{totalRedemptions} Times</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <BadgePercent className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Basket Vouchers</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-amber-400 mt-0.5">{orderLevelCount} Rules</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Native Item Deals</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-cyan-400 mt-0.5">{productLevelCount} Items</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <p className="text-xs text-slate-400 font-medium">Category Deals</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-purple-400 mt-0.5">{categoryPromoCount} Rules</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search promotion name or coupon code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 text-white pl-9 pr-3 py-2 rounded-lg border border-slate-700/80 focus:border-emerald-500 text-xs transition"
            />
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 text-white px-3 py-2 rounded-lg border border-slate-700/80 text-xs focus:border-emerald-500"
          >
            <option value="ALL">All Types</option>
            <option value="PERCENTAGE">Basket Percentage (%)</option>
            <option value="FIXED_AMOUNT">Basket Voucher (LKR)</option>
            <option value="CATEGORY_PERCENT">Category Discount</option>
            <option value="PRODUCT_DISCOUNT_PRICE">Item Discount Price</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-950 text-white px-3 py-2 rounded-lg border border-slate-700/80 text-xs focus:border-emerald-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundManager.playClick();
              refreshFromApi();
              toast.info('Promotions synchronized with live database', 'Live Sync');
            }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
            title="Refresh from PostgreSQL"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Promotion</span>
          </button>
        </div>
      </div>

      {/* Promotions Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`disc-skel-${idx}`}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-32 bg-slate-800 rounded" />
                  <div className="h-5 w-16 bg-slate-800 rounded-full" />
                </div>
                <div className="h-3 w-48 bg-slate-800/60 rounded" />
                <div className="h-10 bg-slate-950 border border-slate-850 rounded-lg" />
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="h-4 w-20 bg-slate-800 rounded" />
                  <div className="h-7 w-20 bg-slate-800 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredDiscounts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-12 text-slate-500">
            <Ticket className="w-14 h-14 mb-3 stroke-1 text-slate-600" />
            <p className="font-semibold text-slate-300 text-base">No Promotional Discounts Found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
              {searchQuery
                ? 'No promotions match your search filter. Try clearing your search.'
                : 'Create promotional rules like percentage discounts, coupon codes, and category flash deals.'}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Promotion</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredDiscounts.map((discount) => {
              const isProduct = discount.scope === 'PRODUCT' || discount.type === 'PRODUCT_DISCOUNT_PRICE';
              const isPercentage = discount.type === 'PERCENTAGE' && !isProduct;
              const isFixed = discount.type === 'FIXED_AMOUNT';
              const isCategory = discount.type === 'CATEGORY_PERCENT';

              return (
                <div
                  key={discount.id}
                  className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition relative overflow-hidden ${
                    discount.isActive
                      ? 'border-slate-800 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5'
                      : 'border-slate-800/60 opacity-60 bg-slate-900/60'
                  }`}
                >
                  <div>
                    {/* Header: Title & Value Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 className="font-bold text-sm text-white leading-tight">
                            {discount.name}
                          </h3>
                          {isProduct && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              Item Deal
                            </span>
                          )}
                        </div>
                        {discount.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                            {discount.description}
                          </p>
                        )}
                      </div>

                      {/* Value Pill */}
                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-black tracking-wide border font-mono ${
                          isProduct
                            ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                            : isPercentage
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : isFixed
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                        }`}
                      >
                        {isProduct && `Sale: ${formatPrice(discount.value)}`}
                        {isPercentage && `${discount.value}% OFF`}
                        {isFixed && `-${formatPrice(discount.value)}`}
                        {isCategory && `${discount.value}% OFF`}
                      </span>
                    </div>

                    {/* Coupon Code Pill */}
                    {discount.code && (
                      <div className="mt-2.5 mb-2.5 flex items-center justify-between bg-slate-950/80 border border-slate-800 p-2 rounded-lg">
                        <div className="flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {discount.code}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopyCode(discount.code!)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded flex items-center gap-1 transition"
                          title="Copy coupon code"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                    )}

                    {/* Rule Specs */}
                    <div className="space-y-1.5 text-xs text-slate-400 mt-2 font-mono">
                      {isProduct && (
                        <div className="flex flex-col gap-0.5 text-cyan-300">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              Item: <strong>{discount.targetProductName || discount.targetProductId}</strong>
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 pl-5">
                            Discount Price: <strong className="text-emerald-400 font-bold">{formatPrice(discount.value)}</strong>
                          </span>
                        </div>
                      )}

                      {isCategory && discount.targetCategory && (
                        <div className="flex items-center gap-1.5 text-purple-300">
                          <Layers className="w-3.5 h-3.5 shrink-0" />
                          <span>Category: <strong>{discount.targetCategory}</strong></span>
                        </div>
                      )}

                      {discount.minOrderAmount && discount.minOrderAmount > 0 ? (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
                          <span>Min. basket: <strong>{formatPrice(discount.minOrderAmount)}</strong></span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span>No minimum basket required</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span>Used: <strong>{discount.usageCount || 0}</strong> times</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    {/* Active toggle button */}
                    <button
                      onClick={() => toggleDiscountActive(discount.id, !discount.isActive)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${
                        discount.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      <span>{discount.isActive ? 'Active' : 'Disabled'}</span>
                    </button>

                    {/* Edit & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(discount)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        title="Edit promotion rule"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(discount.id, discount.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                        title="Delete promotion rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Promotion Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">
                  {editingDiscount ? 'Edit Discount Promotion' : 'Create New Promotion'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets (only on new) */}
            {!editingDiscount && (
              <div className="p-3 bg-slate-950/60 border-b border-slate-800">
                <p className="text-[11px] text-slate-400 font-semibold mb-1.5">Quick Promotion Presets:</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleApplyPreset({
                        name: '10% Weekend Storewide Sale',
                        code: 'WEEKEND10',
                        type: 'PERCENTAGE',
                        value: '10',
                        minOrderAmount: '1500',
                        description: '10% off entire basket on orders over LKR 1,500',
                      })
                    }
                    className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-medium transition"
                  >
                    Weekend 10% Off
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleApplyPreset({
                        name: 'Staff & Family Courtesy Discount',
                        code: 'STAFF15',
                        type: 'PERCENTAGE',
                        value: '15',
                        minOrderAmount: '0',
                        description: '15% staff discount for store team members',
                      })
                    }
                    className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[11px] font-medium transition"
                  >
                    15% Staff Privilege
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleApplyPreset({
                        name: 'Bakery Flash Sale',
                        code: 'BAKERY20',
                        type: 'CATEGORY_PERCENT',
                        value: '20',
                        targetCategory: 'Bakery & Fresh',
                        minOrderAmount: '0',
                        description: '20% off all freshly baked pastries, buns, and bread',
                      })
                    }
                    className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-[11px] font-medium transition"
                  >
                    20% Bakery Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const sampleProd = products[0];
                      const discPrice = sampleProd && sampleProd.price > 40 ? Math.round(sampleProd.price * 0.85) : 100;
                      handleApplyPreset({
                        name: sampleProd ? `Special Price: ${sampleProd.name}` : 'Item Special Price',
                        code: sampleProd ? `${sampleProd.barcode.slice(-4)}DISC` : 'ITEMDISC',
                        type: 'PRODUCT_DISCOUNT_PRICE',
                        scope: 'PRODUCT',
                        value: discPrice.toString(),
                        targetProductId: sampleProd ? sampleProd.id : '',
                        targetProductName: sampleProd ? sampleProd.name : '',
                        minOrderAmount: '0',
                        description: sampleProd ? `Promotional discount price for ${sampleProd.name}` : 'Promotional item discount price',
                      });
                    }}
                    className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-[11px] font-medium transition"
                  >
                    Item Discount Price
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleApplyPreset({
                        name: 'LKR 250 Mega Basket Voucher',
                        code: 'BUYMORE250',
                        type: 'FIXED_AMOUNT',
                        value: '250',
                        minOrderAmount: '2500',
                        description: 'LKR 250 flat discount on orders over LKR 2,500',
                      })
                    }
                    className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-medium transition"
                  >
                    LKR 250 Off Voucher
                  </button>
                </div>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Promotion Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekend Avurudu Special"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Coupon Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SAVE10 (uppercase)"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-emerald-500 uppercase"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Cashiers can enter this code at POS to apply the discount.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Discount Type & Scope <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const val = e.target.value as DiscountType;
                      let newScope: DiscountScope = 'ORDER';
                      if (val === 'CATEGORY_PERCENT') newScope = 'CATEGORY';
                      if (val === 'PRODUCT_DISCOUNT_PRICE') newScope = 'PRODUCT';
                      setFormData({
                        ...formData,
                        type: val,
                        scope: newScope,
                        minOrderAmount: val === 'PRODUCT_DISCOUNT_PRICE' ? '0' : formData.minOrderAmount,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500"
                  >
                    <option value="PERCENTAGE">Basket Percentage (%) off Order</option>
                    <option value="FIXED_AMOUNT">Basket Voucher (LKR) off Order</option>
                    <option value="CATEGORY_PERCENT">Category Percentage (%) off</option>
                    <option value="PRODUCT_DISCOUNT_PRICE">Specific Item / Product Native Discount Price (LKR)</option>
                  </select>
                </div>
              </div>

              {/* Specific Item / Product Picker */}
              {(formData.type === 'PRODUCT_DISCOUNT_PRICE' || formData.scope === 'PRODUCT') && (
                <div className="p-3.5 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-cyan-300 font-bold text-xs flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-cyan-400" />
                      Select Product for Native Discount <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded font-mono">
                      Native Item Discount
                    </span>
                  </div>

                  <select
                    value={formData.targetProductId}
                    onChange={(e) => {
                      const selProd = products.find((p) => p.id === e.target.value);
                      if (selProd) {
                        const defaultSalePrice =
                          selProd.discountPrice && selProd.discountPrice > 0
                            ? selProd.discountPrice.toString()
                            : Math.round(selProd.price * 0.85).toString();
                        setFormData({
                          ...formData,
                          targetProductId: selProd.id,
                          targetProductName: selProd.name,
                          value: formData.value && parseFloat(formData.value) > 0 ? formData.value : defaultSalePrice,
                          name: formData.name ? formData.name : `Special Price: ${selProd.name}`,
                          code: formData.code ? formData.code : `${selProd.barcode.slice(-4)}DISC`,
                        });
                      } else {
                        setFormData({ ...formData, targetProductId: '', targetProductName: '' });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-750 text-white px-3 py-2 rounded-lg focus:border-cyan-400 text-xs font-mono"
                  >
                    <option value="">-- Choose an item from store inventory --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatPrice(p.price)}) - #{p.barcode}
                      </option>
                    ))}
                  </select>

                  {formData.targetProductId && (
                    <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/25 rounded-lg flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <span className="text-slate-400 text-[11px] block">Selected Product:</span>
                        <span className="font-bold text-white truncate block">{formData.targetProductName}</span>
                      </div>
                      {(() => {
                        const targetProd = products.find((p) => p.id === formData.targetProductId);
                        if (!targetProd) return null;
                        const discPrice = parseFloat(formData.value) || 0;
                        const savings = Math.max(0, targetProd.price - discPrice);
                        return (
                          <div className="text-right font-mono shrink-0">
                            <span className="text-slate-400 line-through text-[11px] block">
                              Reg: {formatPrice(targetProd.price)}
                            </span>
                            <span className="text-emerald-400 font-bold text-xs block">
                              Sale: {formatPrice(discPrice)}
                            </span>
                            <span className="text-[10px] text-cyan-300">
                              (Save {formatPrice(savings)})
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    This discount will be <strong>natively linked to this product in the database</strong>. Whenever this item is scanned or added to the POS cart, its discounted price is applied automatically.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {formData.type === 'PRODUCT_DISCOUNT_PRICE' || formData.scope === 'PRODUCT'
                      ? 'Discount Selling Price (LKR)'
                      : formData.type === 'FIXED_AMOUNT'
                      ? 'Discount Value (LKR)'
                      : 'Discount Value (%)'}{' '}
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder={
                      formData.type === 'PRODUCT_DISCOUNT_PRICE' || formData.scope === 'PRODUCT'
                        ? 'e.g. 136.00'
                        : formData.type === 'FIXED_AMOUNT'
                        ? '250'
                        : '10'
                    }
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Minimum Basket Amount (LKR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0 for no minimum"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Order subtotal required to qualify.
                  </p>
                </div>
              </div>

              {formData.type === 'CATEGORY_PERCENT' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Target Category for Discount <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.targetCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, targetCategory: e.target.value as ProductCategory })
                    }
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500"
                  >
                    {availableCategories.map((cat: string) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Valid for all purchases during festival week."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="promo-active-check"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="promo-active-check" className="text-slate-300 cursor-pointer font-medium">
                  Promotion is Active and available at checkout
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition shadow-lg shadow-emerald-600/20"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingDiscount
                    ? 'Update Promotion'
                    : 'Create Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

