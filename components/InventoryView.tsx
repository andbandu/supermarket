'use client';

import React, { useState } from 'react';
import { usePOS } from '@/context/POSContext';
import { Product, ProductCategory } from '@/types/pos';
import { soundManager } from '@/lib/sound';
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

export default function InventoryView() {
  const { products, addProduct, updateProduct, restockProduct, deleteProduct, settings } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [quickRestockId, setQuickRestockId] = useState<string | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(10);

  // New product form state
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category: 'Beverages' as ProductCategory,
    price: '',
    costPrice: '',
    stock: '',
    reorderLevel: '5',
    unit: 'pcs',
    isTaxable: true,
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
    setFormData({
      name: '',
      barcode: '8850' + Math.floor(10000000 + Math.random() * 90000000),
      category: 'Beverages',
      price: '2.50',
      costPrice: '1.20',
      stock: '24',
      reorderLevel: '6',
      unit: 'pack',
      isTaxable: true,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.barcode) {
      alert('Please provide Product Name and Barcode.');
      return;
    }

    const price = parseFloat(formData.price) || 0;
    const costPrice = parseFloat(formData.costPrice) || 0;
    const stock = parseInt(formData.stock, 10) || 0;
    const reorderLevel = parseInt(formData.reorderLevel, 10) || 5;

    if (editingProduct) {
      updateProduct({
        ...editingProduct,
        name: formData.name,
        barcode: formData.barcode,
        category: formData.category,
        price,
        costPrice,
        stock,
        reorderLevel,
        unit: formData.unit,
        isTaxable: formData.isTaxable,
      });
      setEditingProduct(null);
    } else {
      addProduct({
        name: formData.name,
        barcode: formData.barcode,
        category: formData.category,
        price,
        costPrice,
        stock,
        reorderLevel,
        unit: formData.unit,
        color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
        iconName: 'Package',
        isTaxable: formData.isTaxable,
      });
      setIsAddModalOpen(false);
    }
  };

  const handleEditClick = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      price: p.price.toString(),
      costPrice: p.costPrice.toString(),
      stock: p.stock.toString(),
      reorderLevel: p.reorderLevel.toString(),
      unit: p.unit,
      isTaxable: p.isTaxable,
    });
  };

  const handleExportCSV = () => {
    soundManager.playClick();
    const headers = ['ID,Barcode,Name,Category,Price,Cost,Stock,ReorderLevel,Taxable\n'];
    const rows = products.map(
      (p) =>
        `"${p.id}","${p.barcode}","${p.name}","${p.category}",${p.price},${p.costPrice},${p.stock},${p.reorderLevel},${p.isTaxable}`
    );
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minimart-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* Top Inventory Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Products</p>
            <p className="text-xl font-bold text-white mt-0.5">{products.length} SKUs</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Stock Units</p>
            <p className="text-xl font-bold text-white mt-0.5">{totalUnits.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Retail Value</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
              {settings.currencySymbol}
              {totalRetailValue.toFixed(2)}
            </p>
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
            <p className="text-xl font-bold text-amber-400 mt-0.5">
              {lowStockCount} items {filterLowStockOnly && '(Filtered)'}
            </p>
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
            {CATEGORIES.map((cat) => (
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
              {filteredProducts.map((p) => {
                const isOut = p.stock <= 0;
                const isLow = p.stock > 0 && p.stock <= p.reorderLevel;
                const margin =
                  p.price > 0 ? (((p.price - p.costPrice) / p.price) * 100).toFixed(0) : '0';

                return (
                  <tr key={p.id} className="hover:bg-slate-850/60 transition">
                    <td className="p-3 font-mono text-emerald-400 font-medium">#{p.barcode}</td>
                    <td className="p-3 font-semibold text-white">
                      {p.name}
                      {!p.isTaxable && (
                        <span className="ml-1.5 text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20 font-normal">
                          Tax-free
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[11px]">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">
                      {settings.currencySymbol}
                      {p.costPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-100">
                      {settings.currencySymbol}
                      {p.price.toFixed(2)}
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
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {(isAddModalOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">
                {editingProduct ? 'Edit Product' : 'Add New Minimart Product'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Coca-Cola 330ml Can"
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Barcode / SKU</label>
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as ProductCategory })
                    }
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Selling Price ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Current Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="can, bottle, pack"
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="taxable-check"
                  checked={formData.isTaxable}
                  onChange={(e) => setFormData({ ...formData, isTaxable: e.target.checked })}
                  className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                />
                <label htmlFor="taxable-check" className="text-slate-300 cursor-pointer">
                  Charge sales tax ({settings.taxRatePercent}%) for this item
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Save Product
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

