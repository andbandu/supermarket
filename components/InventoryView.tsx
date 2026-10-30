'use client';

import React, { useState, useRef, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { Product, ProductCategory, PRODUCT_UNITS } from '@/types/pos';
import { soundManager } from '@/lib/sound';
import { toast } from '@/context/ToastContext';
import { convertToWebP, validateImageFile } from '@/lib/imageUtils';
import { apiClient } from '@/lib/apiClient';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Download,
  Edit2,
  Trash2,
  X,
  PackagePlus,
  DollarSign,
  TrendingUp,
  Layers,
  Image as ImageIcon,
  UploadCloud,
  Loader2,
  Tag,
  Check,
  ExternalLink,
  Database,
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

const POPULAR_BRANDS = [
  'Munchee',
  'Elephant House',
  'Maliban',
  'Highland',
  'Anchor',
  'MD',
  'Keells',
  'Coca-Cola',
  'Nestle',
  'Kotmale',
  'Kist',
  'Sunlight',
  'Prima',
];

export default function InventoryView() {
  const {
    products,
    categories: registeredCategories,
    brands: registeredBrands,
    addProduct,
    updateProduct,
    restockProduct,
    deleteProduct,
    settings,
    formatPrice,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
  } = usePOS();

  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [isCustomBrand, setIsCustomBrand] = useState(false);

  // Categories retrieved dynamically from PostgreSQL database
  const categoryOptions = useMemo(() => {
    const list: string[] = [];
    if (registeredCategories && registeredCategories.length > 0) {
      registeredCategories.forEach((c) => {
        if (!list.includes(c.name)) list.push(c.name);
      });
    }
    CATEGORIES.filter((c) => c !== 'All').forEach((c) => {
      if (!list.includes(c)) list.push(c);
    });
    return list;
  }, [registeredCategories]);

  const availableCategories = useMemo(() => {
    return ['All', ...categoryOptions];
  }, [categoryOptions]);

  // Brands retrieved dynamically from PostgreSQL database
  const brandOptions = useMemo(() => {
    const list: string[] = [];
    if (registeredBrands && registeredBrands.length > 0) {
      registeredBrands.forEach((b) => {
        if (b.isActive && !list.includes(b.name)) list.push(b.name);
      });
    }
    // Also include any distinct brands already attached to products
    products.forEach((p) => {
      if (p.brand && p.brand.trim() && !list.includes(p.brand.trim())) {
        list.push(p.brand.trim());
      }
    });
    if (list.length === 0) {
      POPULAR_BRANDS.forEach((b) => list.push(b));
    }
    return list.sort((a, b) => a.localeCompare(b));
  }, [registeredBrands, products]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [quickRestockId, setQuickRestockId] = useState<string | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(10);

  // Image upload state
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [urlInputSlot, setUrlInputSlot] = useState<number | null>(null);
  const [tempUrl, setTempUrl] = useState('');
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // New product form state
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    barcode: '',
    category: 'Beverages' as ProductCategory,
    price: '',
    costPrice: '',
    discountPrice: '',
    stock: '',
    reorderLevel: '5',
    unit: 'pcs',
    isTaxable: true,
    images: ['', '', '', ''] as string[],
  });

  // Financial calculations
  const totalRetailValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const totalCostValue = products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.reorderLevel).length;
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);

  // Filter products
  const filteredProducts = products.filter((prod) => {
    const matchesCat = selectedCategory === 'All' || prod.category === selectedCategory;
    const matchesSearch =
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.barcode.includes(searchQuery);
    const matchesLowStock = filterLowStockOnly ? prod.stock <= prod.reorderLevel : true;
    return matchesCat && matchesSearch && matchesLowStock;
  });

  const handleOpenAddModal = () => {
    setIsCustomBrand(false);
    const defaultCat = (categoryOptions[0] || 'Beverages') as ProductCategory;
    setFormData({
      name: '',
      brand: '',
      barcode: '479' + Math.floor(100000000 + Math.random() * 900000000),
      category: defaultCat,
      price: '250.00',
      costPrice: '180.00',
      discountPrice: '',
      stock: '24',
      reorderLevel: '6',
      unit: 'pack',
      isTaxable: true,
      images: ['', '', '', ''],
    });
    setUrlInputSlot(null);
    setTempUrl('');
    setIsAddModalOpen(true);
  };

  const handleEditClick = (p: Product) => {
    setEditingProduct(p);
    const existingImages: string[] = p.images && p.images.length > 0
      ? [...p.images]
      : p.image
      ? [p.image]
      : [];
    while (existingImages.length < 4) {
      existingImages.push('');
    }
    const hasBrandInList = p.brand ? brandOptions.includes(p.brand) : true;
    setIsCustomBrand(!hasBrandInList);
    setFormData({
      name: p.name,
      brand: p.brand || '',
      barcode: p.barcode,
      category: p.category,
      price: p.price.toString(),
      costPrice: p.costPrice.toString(),
      discountPrice: p.discountPrice && p.discountPrice > 0 ? p.discountPrice.toString() : '',
      stock: p.stock.toString(),
      reorderLevel: p.reorderLevel.toString(),
      unit: p.unit || 'pcs',
      isTaxable: p.isTaxable,
      images: existingImages.slice(0, 4),
    });
    setUrlInputSlot(null);
    setTempUrl('');
  };

  const handleImageFileChange = async (slotIndex: number, file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid file format', 'Upload Error');
      return;
    }

    setUploadingSlot(slotIndex);
    try {
      // 1. Client-side conversion to WebP format
      const converted = await convertToWebP(file, 1200, 1200, 0.85);

      // Instant preview
      setFormData((prev) => {
        const nextImgs = [...prev.images];
        nextImgs[slotIndex] = converted.dataUrl;
        return { ...prev, images: nextImgs };
      });

      // 2. Upload to Supabase Storage / Online CDN via Next.js API
      const safeBarcode = formData.barcode.replace(/[^a-zA-Z0-9]/g, '') || 'item';
      const filename = `${safeBarcode}_slot${slotIndex + 1}_${Date.now()}`;
      const res = await apiClient.uploadProductImage(converted.blob, filename);

      if (res.success && res.url) {
        setFormData((prev) => {
          const nextImgs = [...prev.images];
          nextImgs[slotIndex] = res.url!;
          return { ...prev, images: nextImgs };
        });
        toast.success(
          `Image ${slotIndex + 1} converted to WebP (${Math.round(converted.webpSize / 1024)} KB) and uploaded to ${
            res.storage === 'supabase_storage_cdn' ? 'Supabase Storage CDN' : 'Storage'
          }`,
          'WebP Uploaded'
        );
      } else {
        toast.warning(
          'Using local image preview. Storage warning: ' + (res.error || 'Failed to upload to cloud'),
          'Local Preview Active'
        );
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('Failed to convert or upload image. Please try again.', 'Upload Error');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemoveImage = (slotIndex: number) => {
    setFormData((prev) => {
      const nextImgs = [...prev.images];
      nextImgs[slotIndex] = '';
      return { ...prev, images: nextImgs };
    });
  };

  const handleSetDirectUrl = (slotIndex: number) => {
    if (!tempUrl.trim()) return;
    setFormData((prev) => {
      const nextImgs = [...prev.images];
      nextImgs[slotIndex] = tempUrl.trim();
      return { ...prev, images: nextImgs };
    });
    setUrlInputSlot(null);
    setTempUrl('');
    toast.success(`Image ${slotIndex + 1} URL set`, 'Image Linked');
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingSlot !== null) {
      soundManager.playError();
      toast.warning('Please wait for image upload to complete before saving.', 'Upload in Progress');
      return;
    }
    if (!formData.name || !formData.barcode) {
      soundManager.playError();
      toast.warning('Please provide both Product Name and Barcode.', 'Missing Information');
      return;
    }

    const price = parseFloat(formData.price) || 0;
    const costPrice = parseFloat(formData.costPrice) || 0;
    const discountPrice = Math.max(0, parseFloat(formData.discountPrice) || 0);
    const stock = parseInt(formData.stock, 10) || 0;
    const reorderLevel = parseInt(formData.reorderLevel, 10) || 5;

    if (discountPrice > 0 && discountPrice >= price) {
      soundManager.playError();
      toast.warning('Discount selling price must be lower than regular price.', 'Invalid Discount Price');
      return;
    }

    const filteredImages = formData.images.filter((img) => img.trim().length > 0);
    const primaryImage = filteredImages[0] || '';

    if (editingProduct) {
      updateProduct({
        ...editingProduct,
        name: formData.name,
        brand: formData.brand.trim() || undefined,
        barcode: formData.barcode,
        category: formData.category,
        price,
        costPrice,
        discountPrice: discountPrice > 0 ? discountPrice : 0,
        stock,
        reorderLevel,
        unit: formData.unit,
        image: primaryImage || undefined,
        images: filteredImages,
        isTaxable: formData.isTaxable,
      });
      toast.success(`"${formData.name}" updated successfully`, 'Product Saved');
      setEditingProduct(null);
    } else {
      addProduct({
        name: formData.name,
        brand: formData.brand.trim() || undefined,
        barcode: formData.barcode,
        category: formData.category,
        price,
        costPrice,
        discountPrice: discountPrice > 0 ? discountPrice : 0,
        stock,
        reorderLevel,
        unit: formData.unit,
        image: primaryImage || undefined,
        images: filteredImages,
        color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
        iconName: 'Package',
        isTaxable: formData.isTaxable,
      });
      toast.success(`"${formData.name}" added to inventory`, 'Product Created');
      setIsAddModalOpen(false);
    }
  };

  const handleExportCSV = () => {
    soundManager.playClick();
    const headers = ['ID,Barcode,Name,Brand,Category,Price,Cost,Stock,Unit,ReorderLevel,Taxable\n'];
    const rows = products.map(
      (p) =>
        `"${p.id}","${p.barcode}","${p.name}","${p.brand || ''}","${p.category}",${p.price},${p.costPrice},${p.stock},"${p.unit}",${p.reorderLevel},${p.isTaxable}`
    );
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minimart-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Inventory catalog exported to CSV', 'Export Downloaded');
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* Top Inventory Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Products</p>
            {isLoading ? (
              <div className="h-6 w-20 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-white mt-0.5">{products.length} SKUs</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Stock Units</p>
            {isLoading ? (
              <div className="h-6 w-20 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-white mt-0.5">{totalUnits.toLocaleString()}</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Retail Value</p>
            {isLoading ? (
              <div className="h-6 w-24 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                {formatPrice(totalRetailValue)}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
          className={`cursor-pointer bg-slate-900 border rounded-xl p-3.5 flex items-center justify-between transition ${
            filterLowStockOnly ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800'
          }`}
        >
          <div>
            <p className="text-xs text-slate-400 font-medium">Low Stock Alerts</p>
            {isLoading ? (
              <div className="h-6 w-20 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-amber-400 mt-0.5">
                {lowStockCount} items {filterLowStockOnly && '(Filtered)'}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
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
              placeholder="Search by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 text-white pl-9 pr-3 py-2 rounded-lg border border-slate-700/80 focus:border-emerald-500 text-xs transition"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 text-white px-3 py-2 rounded-lg border border-slate-700/80 text-xs focus:border-emerald-500"
          >
            {availableCategories.map((cat: string) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle button */}
          <button
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
              filterLowStockOnly
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock ({lowStockCount})</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800 sticky top-0 z-10 text-[11px]">
              <tr>
                <th className="p-3">Barcode / SKU</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-right">Margin</th>
                <th className="p-3 text-center">Stock Level</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`inv-skeleton-${idx}`} className="animate-pulse">
                    <td className="p-3">
                      <div className="h-4 w-24 bg-slate-800 rounded font-mono" />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 w-44 bg-slate-800 rounded" />
                          <div className="h-3 w-20 bg-slate-800/60 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="h-4 w-20 bg-slate-800/70 rounded" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="h-4 w-14 bg-slate-800 rounded ml-auto" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="h-4 w-14 bg-slate-800 rounded ml-auto" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="h-4 w-10 bg-slate-800/60 rounded ml-auto" />
                    </td>
                    <td className="p-3 text-center">
                      <div className="h-4 w-16 bg-slate-800 rounded mx-auto" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-7 h-7 bg-slate-800 rounded-lg" />
                        <div className="w-7 h-7 bg-slate-800 rounded-lg" />
                        <div className="w-7 h-7 bg-slate-800 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <Boxes className="w-12 h-12 mx-auto mb-3 stroke-1 text-slate-600" />
                    <p className="font-semibold text-slate-300 text-sm">No Products Found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try adjusting your search query or category filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                const isOut = p.stock <= 0;
                const isLow = p.stock > 0 && p.stock <= p.reorderLevel;
                const margin =
                  p.price > 0 ? (((p.price - p.costPrice) / p.price) * 100).toFixed(0) : '0';

                return (
                  <tr key={p.id} className="hover:bg-slate-850/60 transition">
                    <td className="p-3 font-mono text-emerald-400 font-medium">#{p.barcode}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 relative">
                          {p.image || p.images?.[0] ? (
                            <img
                              src={p.image || p.images?.[0]}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-slate-500 text-xs font-mono">📦</span>
                          )}
                          {p.images && p.images.length > 1 && (
                            <span className="absolute bottom-0 right-0 bg-black/85 text-[8px] text-emerald-400 font-mono px-1 rounded-tl">
                              +{p.images.length - 1}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{p.name}</span>
                            {!p.isTaxable && (
                              <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20 font-normal">
                                Tax-free
                              </span>
                            )}
                          </div>
                          {p.brand && (
                            <span className="inline-block text-[10px] text-amber-400 font-medium tracking-wide mt-0.5">
                              {p.brand}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[11px]">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">
                      {formatPrice(p.costPrice)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-100">
                      {p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price ? (
                        <div>
                          <span className="text-[10px] text-slate-500 line-through block leading-none">
                            {formatPrice(p.price)}
                          </span>
                          <span className="text-emerald-400">
                            {formatPrice(p.discountPrice)}
                          </span>
                          <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1 py-0.2 rounded border border-cyan-500/20 inline-block mt-0.5">
                            Save {formatPrice(p.price - p.discountPrice)}
                          </span>
                        </div>
                      ) : (
                        formatPrice(p.price)
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-400 font-semibold">
                      {margin}%
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                            isOut
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          }`}
                        >
                          {p.stock} {p.unit}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Restock button */}
                        <button
                          onClick={() => {
                            setQuickRestockId(p.id);
                            setRestockAmount(12);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 rounded border border-slate-700 text-[11px] font-medium transition"
                          title="Quick restock"
                        >
                          + Restock
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleEditClick(p)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete "${p.name}" from inventory?`)) {
                              deleteProduct(p.id);
                              toast.info(`"${p.name}" deleted from catalog`, 'Product Removed');
                            }
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {(isAddModalOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-emerald-400" />
                  {editingProduct ? 'Edit Product' : 'Add New Minimart Product'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ready for Minimart POS, Next.js Web Storefront & Mobile App
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[calc(92vh-130px)]">
              {/* 4 Product Images Section */}
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-200 font-bold flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>Product Images (4 WebP Images)</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                    ☁ Online Supabase Storage CDN (WebP)
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  Upload up to 4 images. Any image (JPG, PNG) is automatically compressed into lightweight <strong>WebP</strong> format for fast loading on storefront and mobile apps.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const slotTitles = ['Cover / Primary', 'Back View', 'Details / Side', 'In-Hand / Angle'];
                    const imgUrl = formData.images[slotIdx];
                    const isUploading = uploadingSlot === slotIdx;
                    const isPrimary = slotIdx === 0;

                    return (
                      <div
                        key={slotIdx}
                        className={`relative border-2 rounded-xl p-2 flex flex-col items-center justify-between min-h-[140px] text-center transition ${
                          imgUrl
                            ? 'border-emerald-500/50 bg-slate-900/90'
                            : 'border-dashed border-slate-700/80 hover:border-emerald-500/40 bg-slate-900/40'
                        }`}
                      >
                        {/* Slot Badge */}
                        <div className="w-full flex items-center justify-between text-[9px] font-mono mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              isPrimary
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {isPrimary ? 'Slot 1 • Main' : `Slot ${slotIdx + 1}`}
                          </span>

                          {imgUrl && (
                            <span className="text-emerald-400 font-bold">WEBP</span>
                          )}
                        </div>

                        {/* Image Preview or Upload Prompt */}
                        {isUploading ? (
                          <div className="my-auto flex flex-col items-center justify-center p-2 text-slate-400">
                            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mb-1" />
                            <span className="text-[10px] font-mono">Converting...</span>
                          </div>
                        ) : imgUrl ? (
                          <div className="my-auto w-full flex flex-col items-center relative group/img">
                            <img
                              src={imgUrl}
                              alt={slotTitles[slotIdx]}
                              className="h-16 w-full object-contain rounded-lg bg-slate-950 p-1 border border-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(slotIdx)}
                              className="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-500 text-white p-1 rounded-full shadow-md transition opacity-80 group-hover/img:opacity-100"
                              title="Remove image"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRefs.current[slotIdx]?.click()}
                            className="my-auto flex flex-col items-center justify-center cursor-pointer p-1 group/btn hover:scale-105 transition"
                          >
                            <UploadCloud className="w-7 h-7 text-slate-500 group-hover/btn:text-emerald-400 transition mb-1" />
                            <span className="text-[10px] text-slate-300 font-medium">Upload WebP</span>
                            <span className="text-[9px] text-slate-500">Click to browse</span>
                          </div>
                        )}

                        {/* Hidden File Input */}
                        <input
                          ref={(el) => {
                            fileInputRefs.current[slotIdx] = el;
                          }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageFileChange(slotIdx, file);
                            e.target.value = '';
                          }}
                        />

                        {/* Slot Subtitle / URL Option */}
                        <div className="w-full text-center mt-1 border-t border-slate-800/80 pt-1">
                          <span className="text-[10px] text-slate-400 block truncate">
                            {slotTitles[slotIdx]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Product Name & Brand Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Product Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Elephant House Cream Soda 400ml"
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Brand Name</span>
                    </span>
                    
                  </label>

                  {isCustomBrand ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Type custom brand name..."
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="flex-1 bg-slate-950 border border-amber-500/50 text-white px-3 py-2 rounded-lg focus:border-amber-400 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomBrand(false);
                          if (!brandOptions.includes(formData.brand)) {
                            setFormData({ ...formData, brand: '' });
                          }
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition shrink-0 border border-slate-750"
                        title="Choose from registered database brands"
                      >
                        Choose from list
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.brand}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsCustomBrand(true);
                          setFormData({ ...formData, brand: '' });
                        } else {
                          setFormData({ ...formData, brand: e.target.value });
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500 text-xs font-medium"
                    >
                      <option value="">-- Select Brand (or None) --</option>
                      {brandOptions.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                      <option value="__NEW__">+ Enter custom / new brand...</option>
                    </select>
                  )}

                  
                </div>
              </div>

              {/* Barcode & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Barcode / SKU (EAN-13)</label>
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Category</span> <span className="text-rose-400">*</span>
                    </span>
                    
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as ProductCategory })
                    }
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500 text-xs font-medium"
                  >
                    {categoryOptions.map((cat: string) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cost Price, Selling Price & Native Item Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Cost Price ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Selling Price ({settings.currencySymbol}) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-cyan-300 font-semibold mb-1">
                    Discount Selling Price ({settings.currencySymbol}) (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 136.00"
                    value={formData.discountPrice}
                    onChange={(e) => setFormData({ ...formData, discountPrice: e.target.value })}
                    className="w-full bg-slate-950 border border-cyan-500/40 text-white px-3 py-2 rounded-lg font-mono focus:border-cyan-400"
                  />
                  {parseFloat(formData.discountPrice) > 0 && parseFloat(formData.price) > 0 && (
                    <p className="text-[10px] text-cyan-400 mt-1 font-mono">
                      {parseFloat(formData.discountPrice) < parseFloat(formData.price) ? (
                        <>
                          Sale: {formatPrice(parseFloat(formData.discountPrice))} (Save{' '}
                          {formatPrice(parseFloat(formData.price) - parseFloat(formData.discountPrice))})
                        </>
                      ) : (
                        <span className="text-rose-400">Must be lower than regular price</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Stock, Reorder Level, and Unit Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Current Stock <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Measurement Unit</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Dropdown</span>
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500"
                  >
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Taxable Checkbox */}
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="taxable-check"
                  checked={formData.isTaxable}
                  onChange={(e) => setFormData({ ...formData, isTaxable: e.target.checked })}
                  className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="taxable-check" className="text-slate-300 cursor-pointer text-xs">
                  Charge sales tax ({settings.taxRatePercent}%) for this item
                </label>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingSlot !== null}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                >
                  {uploadingSlot !== null ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading Image...</span>
                    </>
                  ) : editingProduct ? (
                    'Update Product'
                  ) : (
                    'Save Product to Inventory'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Restock Popout Modal */}
      {quickRestockId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-3">
              <PackagePlus className="w-4 h-4 text-emerald-400" />
              Quick Restock Units
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Product:{' '}
              <span className="text-white font-semibold">
                {products.find((p) => p.id === quickRestockId)?.name}
              </span>
            </p>

            <div className="flex gap-2 mb-4">
              {[6, 12, 24, 48].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setRestockAmount(amt)}
                  className={`flex-1 py-1.5 rounded text-xs font-mono font-bold border transition ${
                    restockAmount === amt
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  +{amt}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-400 block mb-1">Custom Amount:</label>
              <input
                type="number"
                min="1"
                value={restockAmount}
                onChange={(e) => setRestockAmount(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono font-bold"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setQuickRestockId(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  restockProduct(quickRestockId, restockAmount);
                  toast.success(`Restocked +${restockAmount} units`, 'Stock Updated');
                  setQuickRestockId(null);
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
              >
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

