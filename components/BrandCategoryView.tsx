'use client';

import React, { useState, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { Category, Brand } from '@/types/pos';
import { soundManager } from '@/lib/sound';
import { toast } from '@/context/ToastContext';
import {
  Layers,
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  Package,
  Boxes,
  ArrowRight,
  X,
  Globe,
  Droplets,
  Cookie,
  Cake,
  Utensils,
  Milk,
  Sparkles,
  ShoppingBag,
  Coffee,
  Apple,
  Flame,
  Heart,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

const ICON_OPTIONS = [
  { name: 'Package', component: Package },
  { name: 'Droplets', component: Droplets },
  { name: 'Cookie', component: Cookie },
  { name: 'Cake', component: Cake },
  { name: 'Utensils', component: Utensils },
  { name: 'Milk', component: Milk },
  { name: 'Sparkles', component: Sparkles },
  { name: 'ShoppingBag', component: ShoppingBag },
  { name: 'Coffee', component: Coffee },
  { name: 'Apple', component: Apple },
  { name: 'Flame', component: Flame },
  { name: 'Heart', component: Heart },
];

const COLOR_OPTIONS = [
  { label: 'Emerald Green', value: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-emerald-500' },
  { label: 'Amber Orange', value: 'bg-amber-500/10 text-amber-400 border-amber-500/30 ring-amber-500' },
  { label: 'Cyan Sky', value: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 ring-cyan-500' },
  { label: 'Purple Violet', value: 'bg-purple-500/10 text-purple-400 border-purple-500/30 ring-purple-500' },
  { label: 'Rose Pink', value: 'bg-rose-500/10 text-rose-400 border-rose-500/30 ring-rose-500' },
  { label: 'Royal Blue', value: 'bg-blue-500/10 text-blue-400 border-blue-500/30 ring-blue-500' },
];

function RenderCategoryIcon({ name, className }: { name?: string; className?: string }) {
  const match = ICON_OPTIONS.find((i) => i.name === name) || ICON_OPTIONS[0];
  const Comp = match.component;
  return <Comp className={className || 'w-5 h-5'} />;
}

export default function BrandCategoryView() {
  const {
    categories,
    brands,
    products,
    createCategory,
    updateCategory,
    deleteCategory,
    createBrand,
    updateBrand,
    deleteBrand,
    setActiveTab,
    setSelectedCategory,
    setSearchQuery,
    isLoading,
  } = usePOS();

  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'brands'>('categories');
  const [filterQuery, setFilterQuery] = useState('');

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catFormData, setCatFormData] = useState({
    name: '',
    slug: '',
    description: '',
    iconName: 'Package',
    color: COLOR_OPTIONS[0].value,
    isActive: true,
  });

  // Brand Modal State
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandFormData, setBrandFormData] = useState({
    name: '',
    slug: '',
    description: '',
    origin: 'Sri Lanka',
    logo: '',
    isActive: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Statistics
  const totalCategories = categories.length;
  const activeCategories = categories.filter((c) => c.isActive).length;
  const totalBrands = brands.length;
  const activeBrands = brands.filter((b) => b.isActive).length;
  const totalProducts = products.length;
  const brandedProducts = products.filter((p) => p.brand && p.brand.trim().length > 0).length;

  // Filtered lists
  const filteredCategories = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, filterQuery]);

  const filteredBrands = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return brands;
    return brands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.origin && b.origin.toLowerCase().includes(q)) ||
        (b.description && b.description.toLowerCase().includes(q))
    );
  }, [brands, filterQuery]);

  // Category handlers
  const handleOpenAddCategory = () => {
    soundManager.playClick();
    setEditingCategory(null);
    setCatFormData({
      name: '',
      slug: '',
      description: '',
      iconName: 'Package',
      color: COLOR_OPTIONS[0].value,
      isActive: true,
    });
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    soundManager.playClick();
    setEditingCategory(cat);
    setCatFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      iconName: cat.iconName || 'Package',
      color: cat.color || COLOR_OPTIONS[0].value,
      isActive: cat.isActive,
    });
    setIsCatModalOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormData.name.trim()) {
      toast.warning('Please enter a category name.', 'Name Required');
      return;
    }

    setIsSubmitting(true);
    const slug = (catFormData.slug || catFormData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) || 'cat-' + Date.now();

    try {
      if (editingCategory) {
        const ok = await updateCategory(editingCategory.id, {
          name: catFormData.name.trim(),
          slug,
          description: catFormData.description.trim() || undefined,
          iconName: catFormData.iconName,
          color: catFormData.color,
          isActive: catFormData.isActive,
        });
        if (ok) setIsCatModalOpen(false);
      } else {
        const ok = await createCategory({
          name: catFormData.name.trim(),
          slug,
          description: catFormData.description.trim() || undefined,
          iconName: catFormData.iconName,
          color: catFormData.color,
          isActive: catFormData.isActive,
        });
        if (ok) setIsCatModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (window.confirm(`Delete category "${cat.name}"? Products in this category will be preserved.`)) {
      await deleteCategory(cat.id);
    }
  };

  // Brand handlers
  const handleOpenAddBrand = () => {
    soundManager.playClick();
    setEditingBrand(null);
    setBrandFormData({
      name: '',
      slug: '',
      description: '',
      origin: 'Sri Lanka',
      logo: '',
      isActive: true,
    });
    setIsBrandModalOpen(true);
  };

  const handleOpenEditBrand = (brand: Brand) => {
    soundManager.playClick();
    setEditingBrand(brand);
    setBrandFormData({
      name: brand.name,
      slug: brand.slug,
      description: brand.description || '',
      origin: brand.origin || 'Sri Lanka',
      logo: brand.logo || '',
      isActive: brand.isActive,
    });
    setIsBrandModalOpen(true);
  };

  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandFormData.name.trim()) {
      toast.warning('Please enter a brand name.', 'Name Required');
      return;
    }

    setIsSubmitting(true);
    const slug = (brandFormData.slug || brandFormData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) || 'brand-' + Date.now();

    try {
      if (editingBrand) {
        const ok = await updateBrand(editingBrand.id, {
          name: brandFormData.name.trim(),
          slug,
          description: brandFormData.description.trim() || undefined,
          origin: brandFormData.origin.trim() || 'Sri Lanka',
          logo: brandFormData.logo.trim() || undefined,
          isActive: brandFormData.isActive,
        });
        if (ok) setIsBrandModalOpen(false);
      } else {
        const ok = await createBrand({
          name: brandFormData.name.trim(),
          slug,
          description: brandFormData.description.trim() || undefined,
          origin: brandFormData.origin.trim() || 'Sri Lanka',
          logo: brandFormData.logo.trim() || undefined,
          isActive: brandFormData.isActive,
        });
        if (ok) setIsBrandModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (window.confirm(`Delete brand "${brand.name}"? Products with this brand will remain in inventory.`)) {
      await deleteBrand(brand.id);
    }
  };

  // Navigate to Inventory filtered by this category/brand
  const handleFilterInventoryByCategory = (catName: string) => {
    soundManager.playClick();
    setSelectedCategory(catName);
    setSearchQuery('');
    setActiveTab('inventory');
  };

  const handleFilterInventoryByBrand = (brandName: string) => {
    soundManager.playClick();
    setSelectedCategory('All');
    setSearchQuery(brandName);
    setActiveTab('inventory');
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Categories</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-emerald-400 mt-0.5">
                {totalCategories} <span className="text-xs text-slate-400 font-normal">({activeCategories} Active)</span>
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Registered Brands</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-amber-400 mt-0.5">
                {totalBrands} <span className="text-xs text-slate-400 font-normal">({activeBrands} Active)</span>
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Catalog SKUs</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-white mt-0.5">{totalProducts} Items</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Branded Coverage</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-cyan-400 mt-0.5">
                {totalProducts > 0 ? Math.round((brandedProducts / totalProducts) * 100) : 0}%{' '}
                <span className="text-xs text-slate-400 font-normal">({brandedProducts}/{totalProducts})</span>
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-0">
        {/* Navigation Subtabs & Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Subtab Switcher */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                soundManager.playClick();
                setActiveSubTab('categories');
                setFilterQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'categories'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Categories ({totalCategories})</span>
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                setActiveSubTab('brands');
                setFilterQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'brands'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Brands ({totalBrands})</span>
            </button>
          </div>

          {/* Right Action: Search & Add button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={activeSubTab === 'categories' ? 'Search categories...' : 'Search brands...'}
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-slate-900 text-white pl-9 pr-3 py-1.5 rounded-lg border border-slate-750 text-xs focus:border-emerald-500"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeSubTab === 'categories' ? (
              <button
                onClick={handleOpenAddCategory}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            ) : (
              <button
                onClick={handleOpenAddBrand}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20 shrink-0"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                <span>Add Brand</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeSubTab === 'categories' ? (
            /* CATEGORIES GRID */
            filteredCategories.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
                <Layers className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
                <p className="font-semibold text-slate-300 text-sm">No Categories Found</p>
                <p className="text-xs text-slate-500 mt-1">
                  {filterQuery ? 'Try clearing your search query.' : 'Click "Add Category" to create your first category.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition group shadow-sm hover:shadow-md"
                  >
                    <div>
                      {/* Card Top: Icon & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                              cat.color || 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            <RenderCategoryIcon name={cat.iconName} className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                              {cat.name}
                            </h3>
                            <span className="text-[10px] text-slate-400 font-mono">
                              /{cat.slug}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            cat.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}
                        >
                          {cat.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                        {cat.description || 'No description provided for this store category.'}
                      </p>
                    </div>

                    {/* Card Footer: Product Count & Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <button
                        onClick={() => handleFilterInventoryByCategory(cat.name)}
                        className="text-xs font-semibold text-slate-300 hover:text-emerald-400 flex items-center gap-1.5 transition font-mono group/btn"
                        title="Filter Inventory catalog by this category"
                      >
                        <Boxes className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-emerald-400" />
                        <span>{cat.productCount || 0} Products</span>
                        <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCategory(cat.id, { isActive: !cat.isActive })}
                          className={`p-1.5 rounded-lg border transition ${
                            cat.isActive
                              ? 'text-slate-400 hover:text-amber-400 border-transparent hover:bg-slate-800'
                              : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          }`}
                          title={cat.isActive ? 'Disable Category' : 'Enable Category'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* BRANDS GRID */
            filteredBrands.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
                <Tag className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
                <p className="font-semibold text-slate-300 text-sm">No Brands Found</p>
                <p className="text-xs text-slate-500 mt-1">
                  {filterQuery ? 'Try clearing your search query.' : 'Click "Add Brand" to register a manufacturer or brand.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredBrands.map((brand) => (
                  <div
                    key={brand.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition group shadow-sm hover:shadow-md"
                  >
                    <div>
                      {/* Card Top: Brand Initials/Logo & Origin */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          {brand.logo ? (
                            <img
                              src={brand.logo}
                              alt={brand.name}
                              className="w-10 h-10 rounded-xl object-contain bg-slate-900 border border-slate-800 p-1 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 font-black text-sm flex items-center justify-center shrink-0 uppercase font-mono">
                              {brand.name.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
                              {brand.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Globe className="w-3 h-3 text-slate-500" />
                              <span className="text-[10px] text-slate-400 font-medium">
                                {brand.origin || 'Sri Lanka'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            brand.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}
                        >
                          {brand.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                        {brand.description || 'Verified retail manufacturer & brand supplier.'}
                      </p>
                    </div>

                    {/* Card Footer: Product Count & Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <button
                        onClick={() => handleFilterInventoryByBrand(brand.name)}
                        className="text-xs font-semibold text-slate-300 hover:text-amber-400 flex items-center gap-1.5 transition font-mono group/btn"
                        title="Filter Inventory catalog by this brand"
                      >
                        <Boxes className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-amber-400" />
                        <span>{brand.productCount || 0} Products</span>
                        <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateBrand(brand.id, { isActive: !brand.isActive })}
                          className={`p-1.5 rounded-lg border transition ${
                            brand.isActive
                              ? 'text-slate-400 hover:text-amber-400 border-transparent hover:bg-slate-800'
                              : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          }`}
                          title={brand.isActive ? 'Disable Brand' : 'Enable Brand'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditBrand(brand)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Edit Brand"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBrand(brand)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                          title="Delete Brand"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* CREATE / EDIT CATEGORY MODAL */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </h3>
              </div>
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Category Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Beverages, Snacks & Candy, Bakery"
                  value={catFormData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                    setCatFormData({
                      ...catFormData,
                      name,
                      slug: editingCategory ? catFormData.slug : slug,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">URL Identifier / Slug</label>
                <input
                  type="text"
                  required
                  value={catFormData.slug}
                  onChange={(e) => setCatFormData({ ...catFormData, slug: e.target.value.toLowerCase() })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-emerald-500"
                />
              </div>

              {/* Icon selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Category Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {ICON_OPTIONS.map((item) => {
                    const Comp = item.component;
                    const isSelected = catFormData.iconName === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setCatFormData({ ...catFormData, iconName: item.name })}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title={item.name}
                      >
                        <Comp className="w-5 h-5" />
                        <span className="text-[9px] truncate w-full text-center">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color scheme selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Color Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_OPTIONS.map((color) => {
                    const isSelected = catFormData.color === color.value;
                    return (
                      <button
                        key={color.label}
                        type="button"
                        onClick={() => setCatFormData({ ...catFormData, color: color.value })}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2 transition ${
                          isSelected
                            ? 'bg-slate-800 border-white text-white ring-1 ring-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full border ${color.value}`} />
                        <span className="text-[11px] font-medium truncate">{color.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Short description of products categorized under this group."
                  value={catFormData.description}
                  onChange={(e) => setCatFormData({ ...catFormData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cat-active-check"
                  checked={catFormData.isActive}
                  onChange={(e) => setCatFormData({ ...catFormData, isActive: e.target.checked })}
                  className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="cat-active-check" className="text-slate-300 cursor-pointer font-medium">
                  Category is Active and visible in POS & Inventory
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition shadow-lg shadow-emerald-600/20"
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BRAND MODAL */}
      {isBrandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">
                  {editingBrand ? 'Edit Brand' : 'Register New Brand'}
                </h3>
              </div>
              <button
                onClick={() => setIsBrandModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBrandSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Brand Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elephant House, Munchee, Maliban, Coca-Cola"
                  value={brandFormData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                    setBrandFormData({
                      ...brandFormData,
                      name,
                      slug: editingBrand ? brandFormData.slug : slug,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Slug / Code</label>
                  <input
                    type="text"
                    required
                    value={brandFormData.slug}
                    onChange={(e) => setBrandFormData({ ...brandFormData, slug: e.target.value.toLowerCase() })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Country of Origin</label>
                  <input
                    type="text"
                    placeholder="e.g. Sri Lanka"
                    value={brandFormData.origin}
                    onChange={(e) => setBrandFormData({ ...brandFormData, origin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Quick Country chips */}
              <div className="flex flex-wrap gap-1.5">
                {['Sri Lanka', 'India', 'UK', 'USA', 'Switzerland', 'Singapore', 'Global'].map((country) => (
                  <button
                    key={country}
                    type="button"
                    onClick={() => setBrandFormData({ ...brandFormData, origin: country })}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      brandFormData.origin === country
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {country}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Logo URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://example.com/brand-logo.png"
                  value={brandFormData.logo}
                  onChange={(e) => setBrandFormData({ ...brandFormData, logo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-amber-400 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brand details, parent company, or manufacturer notes."
                  value={brandFormData.description}
                  onChange={(e) => setBrandFormData({ ...brandFormData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-amber-400 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="brand-active-check"
                  checked={brandFormData.isActive}
                  onChange={(e) => setBrandFormData({ ...brandFormData, isActive: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="brand-active-check" className="text-slate-300 cursor-pointer font-medium">
                  Brand is Active and visible across products
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBrandModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold transition shadow-lg shadow-amber-500/20"
                >
                  {isSubmitting ? 'Saving...' : editingBrand ? 'Update Brand' : 'Register Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

