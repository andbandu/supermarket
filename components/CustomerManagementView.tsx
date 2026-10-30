'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { OnlineCustomer, Order } from '@/types/pos';
import { soundManager } from '@/lib/sound';
import { toast } from '@/context/ToastContext';
import {
  Users,
  Search,
  Plus,
  Filter,
  Download,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  TrendingUp,
  Award,
  Calendar,
  ExternalLink,
  Edit2,
  Receipt,
  X,
  CheckCircle2,
  Clock,
  ChevronRight,
  UserCheck,
  Building,
  CreditCard,
  Sparkles,
} from 'lucide-react';

interface CustomerManagementViewProps {
  onViewReceipt?: (order: Order) => void;
}

export default function CustomerManagementView({ onViewReceipt }: CustomerManagementViewProps) {
  const {
    customers,
    orders,
    saveCustomer,
    refreshFromApi,
    formatPrice,
    isLoading,
    isSyncing,
    selectedCustomerIdForView,
    setSelectedCustomerIdForView,
    setActiveTab,
  } = usePOS();

  // Selected customer for detail inspection
  const [selectedCustomer, setSelectedCustomer] = useState<OnlineCustomer | null>(null);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'ACTIVE' | 'HIGH_VALUE' | 'NEW'>('ALL');
  const [sortBy, setSortBy] = useState<'RECENT' | 'SPEND_HIGH' | 'ORDERS_HIGH' | 'NAME'>('RECENT');

  // Customer Modal (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<OnlineCustomer>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: 'Colombo 03',
  });

  // If navigated from an order with a preselected customer ID, select that customer
  useEffect(() => {
    if (selectedCustomerIdForView && customers.length > 0) {
      const match = customers.find((c) => c.id === selectedCustomerIdForView);
      if (match) {
        setSelectedCustomer(match);
      }
    } else if (!selectedCustomer && customers.length > 0) {
      setSelectedCustomer(customers[0]);
    }
  }, [selectedCustomerIdForView, customers, selectedCustomer]);

  // Dynamic Cities list from registered customers
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.city && c.city.trim()) set.add(c.city.trim());
    });
    // Add default Sri Lankan commercial hubs if not already present
    ['Colombo 01', 'Colombo 03', 'Colombo 07', 'Dehiwala', 'Nugegoda', 'Kandy', 'Negombo'].forEach((c) =>
      set.add(c)
    );
    return Array.from(set).sort();
  }, [customers]);

  // Filtered & Sorted Customer List
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = c.name.toLowerCase().includes(q);
          const matchPhone = c.phone.toLowerCase().includes(q);
          const matchEmail = c.email?.toLowerCase().includes(q) ?? false;
          const matchAddress = c.address?.toLowerCase().includes(q) ?? false;
          const matchCity = c.city?.toLowerCase().includes(q) ?? false;
          if (!matchName && !matchPhone && !matchEmail && !matchAddress && !matchCity) {
            return false;
          }
        }

        // City filter
        if (cityFilter !== 'ALL' && c.city !== cityFilter) {
          return false;
        }

        // Tier filter
        if (tierFilter === 'ACTIVE' && c.totalOrders === 0) return false;
        if (tierFilter === 'HIGH_VALUE' && c.totalSpent < 5000) return false;
        if (tierFilter === 'NEW' && c.totalOrders > 0) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'SPEND_HIGH') return b.totalSpent - a.totalSpent;
        if (sortBy === 'ORDERS_HIGH') return b.totalOrders - a.totalOrders;
        if (sortBy === 'NAME') return a.name.localeCompare(b.name);
        // Default: RECENT (updatedAt or createdAt)
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
  }, [customers, searchQuery, cityFilter, tierFilter, sortBy]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalCustomers = customers.length;
    const activeBuyers = customers.filter((c) => c.totalOrders > 0).length;
    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const avgSpent = activeBuyers > 0 ? totalRevenue / activeBuyers : 0;

    return { totalCustomers, activeBuyers, totalRevenue, avgSpent };
  }, [customers]);

  // Orders associated with the currently selected customer
  const customerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return orders
      .filter((o) => {
        if (o.customerId && o.customerId === selectedCustomer.id) return true;
        if (o.customerPhone && o.customerPhone === selectedCustomer.phone) return true;
        return false;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [selectedCustomer, orders]);

  // Open Create Customer Modal
  const handleOpenCreateModal = () => {
    soundManager.playClick();
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      city: 'Colombo 03',
    });
    setIsModalOpen(true);
  };

  // Open Edit Customer Modal
  const handleOpenEditModal = (c: OnlineCustomer) => {
    soundManager.playClick();
    setFormData({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      address: c.address || '',
      city: c.city || 'Colombo 03',
    });
    setIsModalOpen(true);
  };

  // Save Customer (Create or Update)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.phone?.trim()) {
      soundManager.playError();
      toast.warning('Name and phone number are required', 'Validation Notice');
      return;
    }

    setIsSaving(true);
    const res = await saveCustomer(formData);
    setIsSaving(false);

    if (res.success) {
      soundManager.playSuccess();
      toast.success(res.message || 'Customer saved successfully!', 'Customer Updated');
      setIsModalOpen(false);
      // Keep selected or select saved
      if (res.data) setSelectedCustomer(res.data);
    } else {
      soundManager.playError();
      toast.error(res.error || 'Failed to save customer', 'Database Error');
    }
  };

  // Export Customers to CSV
  const handleExportCSV = () => {
    soundManager.playClick();
    const headers = ['ID,Name,Phone,Email,Address,City,TotalOrders,TotalSpent,CreatedAt\n'];
    const rows = filteredCustomers.map((c) => {
      return `"${c.id}","${c.name.replace(/"/g, '""')}","${c.phone}","${c.email || ''}","${(c.address || '').replace(/"/g, '""')}","${c.city || ''}",${c.totalOrders},${c.totalSpent},"${c.createdAt || ''}"`;
    });
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minimart-customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Customer directory exported as CSV', 'Export Downloaded');
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & METRICS */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Customer Management (CRM)
                <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                  {customers.length} Registered
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Directory of storefront, mobile app, and in-store loyalty customer profiles
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              soundManager.playClick();
              refreshFromApi();
              toast.info('Customer directory synchronized with live PostgreSQL', 'Database Sync');
            }}
            disabled={isSyncing}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition disabled:opacity-50"
            title="Refresh customers from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Registered</p>
            <p className="text-xl font-bold text-white mt-0.5 font-mono">{metrics.totalCustomers}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Buyers</p>
            <p className="text-xl font-bold text-blue-400 mt-0.5 font-mono">{metrics.activeBuyers}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Customer Spend</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5 font-mono">
              {formatPrice(metrics.totalRevenue)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Avg Order Value</p>
            <p className="text-xl font-bold text-purple-400 mt-0.5 font-mono">
              {formatPrice(metrics.avgSpent)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FILTER & SEARCH TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, phone, email, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 text-white pl-9 pr-3 py-1.5 rounded-lg border border-slate-700/80 focus:border-emerald-500 text-xs transition"
            />
          </div>

          {/* City Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Cities</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Tier */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as any)}
            className="bg-slate-950 text-white px-3 py-1.5 rounded-lg border border-slate-800 text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Tiers</option>
            <option value="ACTIVE">Active Buyers (&gt;0 orders)</option>
            <option value="HIGH_VALUE">High Value (&gt;LKR 5,000)</option>
            <option value="NEW">New (0 orders yet)</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 text-white px-3 py-1.5 rounded-lg border border-slate-800 text-xs focus:outline-none cursor-pointer"
          >
            <option value="RECENT">Recently Updated</option>
            <option value="SPEND_HIGH">Highest Spent</option>
            <option value="ORDERS_HIGH">Most Orders</option>
            <option value="NAME">Name (A-Z)</option>
          </select>
        </div>

        <span className="text-slate-400 font-mono text-[11px]">
          Showing {filteredCustomers.length} of {customers.length}
        </span>
      </div>

      {/* ========================================================================= */}
      {/* 3. SPLIT-SCREEN MASTER-DETAIL WORKSPACE */}
      {/* ========================================================================= */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* Left Column: Customers Table / List (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col min-h-0 overflow-hidden">
          <div className="overflow-y-auto flex-1 divide-y divide-slate-800/80">
            {isLoading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
                <Users className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
                <p className="font-semibold text-slate-300 text-sm">No Customers Found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your search criteria or add a new customer profile.
                </p>
                <button
                  onClick={handleOpenCreateModal}
                  className="mt-4 px-3.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Customer</span>
                </button>
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                const isHighValue = c.totalSpent >= 5000;

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      soundManager.playClick();
                      setSelectedCustomer(c);
                      setSelectedCustomerIdForView(c.id);
                    }}
                    className={`p-3.5 cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500'
                        : 'hover:bg-slate-850/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar with Initials */}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-sm font-bold text-emerald-400 shrink-0">
                        {c.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                          {isHighValue && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> VIP
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1 text-slate-300">
                            <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                            {c.phone}
                          </span>
                          {c.city && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                              {c.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Spend & Orders summary */}
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <p className="text-xs font-bold font-mono text-emerald-400">
                          {formatPrice(c.totalSpent)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {c.totalOrders} {c.totalOrders === 1 ? 'order' : 'orders'}
                        </p>
                      </div>

                      <ChevronRight className={`w-4 h-4 text-slate-500 ${isSelected ? 'text-emerald-400' : ''}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Customer 360° Profile & Order Timeline (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-lg">
          {selectedCustomer ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Profile Card Header */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-base font-black">
                      {selectedCustomer.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        {selectedCustomer.name}
                        {selectedCustomer.totalSpent >= 5000 && (
                          <span className="text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            VIP Customer
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">ID: {selectedCustomer.id}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEditModal(selectedCustomer)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 border border-slate-700 transition"
                    title="Edit Customer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Edit</span>
                  </button>
                </div>

                {/* Contact & Address Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">PHONE NUMBER</span>
                    <a
                      href={`tel:${selectedCustomer.phone}`}
                      className="text-emerald-400 hover:underline font-mono font-medium flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {selectedCustomer.phone}
                    </a>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">EMAIL ADDRESS</span>
                    {selectedCustomer.email ? (
                      <a
                        href={`mailto:${selectedCustomer.email}`}
                        className="text-cyan-400 hover:underline truncate block"
                      >
                        {selectedCustomer.email}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">No email provided</span>
                    )}
                  </div>

                  <div className="sm:col-span-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">DELIVERY ADDRESS</span>
                    <div className="text-slate-200 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        {selectedCustomer.address
                          ? `${selectedCustomer.address}, ${selectedCustomer.city || ''}`
                          : selectedCustomer.defaultAddress || 'No address registered'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lifetime Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">TOTAL ORDERS</span>
                  <span className="text-lg font-bold font-mono text-white mt-0.5 block">
                    {selectedCustomer.totalOrders}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">TOTAL SPENT</span>
                  <span className="text-lg font-bold font-mono text-emerald-400 mt-0.5 block">
                    {formatPrice(selectedCustomer.totalSpent)}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">AVG TICKET</span>
                  <span className="text-lg font-bold font-mono text-purple-400 mt-0.5 block">
                    {formatPrice(
                      selectedCustomer.totalOrders > 0
                        ? selectedCustomer.totalSpent / selectedCustomer.totalOrders
                        : 0
                    )}
                  </span>
                </div>
              </div>

              {/* Customer Past Orders Timeline */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Purchase History ({customerOrders.length})</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">Live Linked Orders</span>
                </div>

                {customerOrders.length === 0 ? (
                  <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No past orders recorded yet for this customer profile.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {customerOrders.map((ord) => {
                      const date = new Date(ord.timestamp);
                      const isOnline = ord.orderSource && ord.orderSource !== 'POS';

                      return (
                        <div
                          key={ord.id}
                          className="bg-slate-950 p-3 rounded-xl border border-slate-800/90 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-[11px]">
                                #{ord.receiptNumber}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  isOnline
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {ord.orderSource || 'POS'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {date.toLocaleDateString()} at{' '}
                              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                              {ord.items.reduce((s, i) => s + i.quantity, 0)} items
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-emerald-400 text-xs">
                              {formatPrice(ord.total)}
                            </span>
                            {onViewReceipt && (
                              <button
                                onClick={() => {
                                  soundManager.playClick();
                                  onViewReceipt(ord);
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                                title="View Receipt"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
              <Users className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
              <p className="font-semibold text-slate-300 text-sm">Select a Customer</p>
              <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">
                Click on any customer in the directory to inspect their contact information, delivery location, and purchase timeline.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ADD / EDIT CUSTOMER MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>{formData.id ? 'Edit Customer Profile' : 'Register New Customer'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nimalka Fernando"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 text-white px-3 py-2 rounded-xl border border-slate-700 focus:border-emerald-500 text-xs transition"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Phone Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +94 77 458 9120"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-950 text-white px-3 py-2 rounded-xl border border-slate-700 focus:border-emerald-500 font-mono text-xs transition"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. nimalka.f@gmail.com"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 text-white px-3 py-2 rounded-xl border border-slate-700 focus:border-emerald-500 text-xs transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Street Address</label>
                  <input
                    type="text"
                    placeholder="e.g. No. 45/2, Temple Road"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-950 text-white px-3 py-2 rounded-xl border border-slate-700 focus:border-emerald-500 text-xs transition"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">City / Town</label>
                  <input
                    type="text"
                    placeholder="e.g. Colombo 03, Dehiwala, Kandy"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-slate-950 text-white px-3 py-2 rounded-xl border border-slate-700 focus:border-emerald-500 text-xs transition"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : formData.id ? 'Save Changes' : 'Create Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

