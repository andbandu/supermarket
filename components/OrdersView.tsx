'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { Order, OrderItem, FulfillmentStatus, OrderPaymentStatus } from '@/types/pos';
import { soundManager } from '@/lib/sound';
import { toast } from '@/context/ToastContext';
import HistoryView from '@/components/HistoryView';
import {
  ShoppingBag,
  Smartphone,
  Globe,
  Truck,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  Eye,
  Printer,
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  Receipt,
  X,
  CreditCard,
  Banknote,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface OrdersViewProps {
  onViewReceipt: (order: Order) => void;
}

export default function OrdersView({ onViewReceipt }: OrdersViewProps) {
  const {
    onlineOrders,
    posOrders,
    pendingOnlineOrdersCount,
    updateFulfillmentStatus,
    updatePaymentStatus,
    refreshFromApi,
    formatPrice,
    settings,
    isLoading,
    isSyncing,
    setActiveTab,
    setSelectedCustomerIdForView,
  } = usePOS();

  // Sub-tabs: 'online' (Live Online Orders) | 'pos' (In-Store POS Register History)
  const [subTab, setSubTab] = useState<'online' | 'pos'>('online');

  // Filters for Online Orders
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Currently Selected Order for Detailed Master Inspection Panel
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Packing Slip Thermal Print Modal
  const [packingSlipOrder, setPackingSlipOrder] = useState<Order | null>(null);

  // Estimated Prep Time state for selected order
  const [selectedPrepTime, setSelectedPrepTime] = useState<string>('30 mins');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Filtered Online Orders
  const filteredOnlineOrders = useMemo(() => {
    return onlineOrders.filter((order) => {
      // Status filter
      if (statusFilter !== 'ALL' && order.fulfillmentStatus !== statusFilter) {
        return false;
      }
      // Channel filter
      if (channelFilter !== 'ALL' && order.orderSource !== channelFilter) {
        return false;
      }
      // Type filter (DELIVERY vs PICKUP)
      if (typeFilter !== 'ALL' && order.orderType !== typeFilter) {
        return false;
      }
      // Search query (receipt #, customer name, customer phone, city, or items)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchReceipt = order.receiptNumber.toLowerCase().includes(q);
        const matchCustomer = order.customerName?.toLowerCase().includes(q) ?? false;
        const matchPhone = order.customerPhone?.toLowerCase().includes(q) ?? false;
        const matchCity = order.deliveryCity?.toLowerCase().includes(q) ?? false;
        const matchItems = order.items.some((i) => i.productName.toLowerCase().includes(q));

        if (!matchReceipt && !matchCustomer && !matchPhone && !matchCity && !matchItems) {
          return false;
        }
      }
      return true;
    });
  }, [onlineOrders, statusFilter, channelFilter, typeFilter, searchQuery]);

  // Keep first order selected by default if none selected or selection lost
  useEffect(() => {
    if (!selectedOrderId && filteredOnlineOrders.length > 0) {
      setSelectedOrderId(filteredOnlineOrders[0].id);
    } else if (selectedOrderId && !filteredOnlineOrders.some((o) => o.id === selectedOrderId)) {
      if (filteredOnlineOrders.length > 0) {
        setSelectedOrderId(filteredOnlineOrders[0].id);
      }
    }
  }, [filteredOnlineOrders, selectedOrderId]);

  // Selected Order object
  const activeOrder = useMemo(() => {
    if (!selectedOrderId) return filteredOnlineOrders[0] || null;
    return onlineOrders.find((o) => o.id === selectedOrderId) || filteredOnlineOrders[0] || null;
  }, [selectedOrderId, onlineOrders, filteredOnlineOrders]);

  // Online Orders Pipeline KPI Metrics
  const pipelineMetrics = useMemo(() => {
    const pending = onlineOrders.filter((o) => o.fulfillmentStatus === 'PENDING').length;
    const preparing = onlineOrders.filter((o) => o.fulfillmentStatus === 'PREPARING').length;
    const ready = onlineOrders.filter((o) => o.fulfillmentStatus === 'READY').length;
    const completed = onlineOrders.filter((o) => o.fulfillmentStatus === 'COMPLETED').length;
    const totalSales = onlineOrders
      .filter((o) => o.fulfillmentStatus !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return { pending, preparing, ready, completed, totalSales };
  }, [onlineOrders]);

  // One-Click Seamless Status Progression
  const handleProgressStatus = async (order: Order, nextStatus: FulfillmentStatus) => {
    soundManager.playClick();
    setIsUpdatingStatus(true);
    const est = nextStatus === 'PREPARING' ? selectedPrepTime : order.estimatedTime;
    const res = await updateFulfillmentStatus(order.id, nextStatus, est);
    setIsUpdatingStatus(false);

    if (res.success) {
      soundManager.playSuccess();
      toast.success(
        `Order #${order.receiptNumber} updated to ${nextStatus}`,
        'Fulfillment Updated'
      );
    } else {
      soundManager.playError();
      toast.error(res.error || 'Failed to update order status', 'Error');
    }
  };

  // Toggle Payment Status
  const handleTogglePayment = async (order: Order) => {
    soundManager.playClick();
    const nextStatus: OrderPaymentStatus = order.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
    const res = await updatePaymentStatus(order.id, nextStatus);

    if (res.success) {
      soundManager.playSuccess();
      toast.success(`Payment status marked as ${nextStatus}`, 'Payment Updated');
    } else {
      soundManager.playError();
      toast.error(res.error || 'Failed to update payment status', 'Error');
    }
  };

  // Jump to Customer Profile in Customer Management Module
  const handleNavigateToCustomer = (order: Order) => {
    soundManager.playClick();
    if (order.customerId) {
      setSelectedCustomerIdForView(order.customerId);
      setActiveTab('customers');
    } else {
      toast.info('No registered customer profile linked to this order.', 'Guest Order');
    }
  };

  // Copy helpers
  const handleCopyReceipt = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedReceipt(true);
    toast.success(`Receipt #${num} copied to clipboard`, 'Copied');
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(true);
    toast.success('Address copied to clipboard', 'Copied');
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950 p-4 sm:p-6 space-y-3.5">
      {/* ========================================================================= */}
      {/* TOP HEADER & MODULE NAVIGATION TABS */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Order Management & Fulfillment Hub
              {pendingOnlineOrdersCount > 0 && (
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                  {pendingOnlineOrdersCount} PENDING
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              Process incoming storefront orders, manage deliveries, and view physical register sales logs
            </p>
          </div>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                soundManager.playClick();
                setSubTab('online');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                subTab === 'online'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Online Orders Hub</span>
              {pendingOnlineOrdersCount > 0 && (
                <span className="bg-amber-400 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  {pendingOnlineOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                setSubTab('pos');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                subTab === 'pos'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>In-Store POS History</span>
              <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                {posOrders.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => {
              soundManager.playClick();
              refreshFromApi();
              toast.info('Orders synchronized with live PostgreSQL', 'Database Sync');
            }}
            disabled={isSyncing}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition disabled:opacity-50"
            title="Refresh Orders from PostgreSQL"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: LIVE ONLINE ORDERS WORKSPACE (STOREFRONT & MOBILE APP) */}
      {/* ========================================================================= */}
      {subTab === 'online' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          {/* Pipeline KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <div
              onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-500/20 border-amber-500/60 ring-2 ring-amber-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> New Pending
                </p>
                <p className="text-xl font-bold font-mono text-white mt-0.5">
                  {pipelineMetrics.pending}
                </p>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'PREPARING' ? 'ALL' : 'PREPARING')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                statusFilter === 'PREPARING'
                  ? 'bg-blue-500/20 border-blue-500/60 ring-2 ring-blue-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <p className="text-[11px] text-blue-400 font-semibold flex items-center gap-1">
                  <Package className="w-3 h-3" /> In Packing
                </p>
                <p className="text-xl font-bold font-mono text-white mt-0.5">
                  {pipelineMetrics.preparing}
                </p>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'READY' ? 'ALL' : 'READY')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                statusFilter === 'READY'
                  ? 'bg-purple-500/20 border-purple-500/60 ring-2 ring-purple-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <p className="text-[11px] text-purple-400 font-semibold flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Ready / Dispatch
                </p>
                <p className="text-xl font-bold font-mono text-white mt-0.5">
                  {pipelineMetrics.ready}
                </p>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                statusFilter === 'COMPLETED'
                  ? 'bg-emerald-500/20 border-emerald-500/60 ring-2 ring-emerald-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Completed
                </p>
                <p className="text-xl font-bold font-mono text-white mt-0.5">
                  {pipelineMetrics.completed}
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between col-span-2 md:col-span-1">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Online Revenue</p>
                <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                  {formatPrice(pipelineMetrics.totalSales)}
                </p>
              </div>
            </div>
          </div>

          {/* Search & Multi-Faceted Filters */}
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search Bar */}
              <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search receipt #, customer, phone, item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 text-white pl-9 pr-3 py-1.5 rounded-lg border border-slate-700/80 focus:border-emerald-500 text-xs transition"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 text-white px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">🟡 Pending Acceptance</option>
                <option value="PREPARING">🔵 In Preparation</option>
                <option value="READY">🟣 Ready for Pickup / Dispatch</option>
                <option value="COMPLETED">🟢 Completed</option>
                <option value="CANCELLED">🔴 Cancelled</option>
              </select>

              {/* Channel Filter */}
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="bg-slate-950 text-white px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Channels</option>
                <option value="STOREFRONT">🌐 Web Storefront</option>
                <option value="MOBILE_APP">📱 Mobile App</option>
              </select>

              {/* Order Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 text-white px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="DELIVERY">🚚 Home Delivery</option>
                <option value="PICKUP">🛍️ In-Store Pickup</option>
              </select>
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
              Showing {filteredOnlineOrders.length} of {onlineOrders.length} online orders
            </span>
          </div>

          {/* ========================================================================= */}
          {/* MASTER-DETAIL SPLIT WORKSPACE */}
          {/* ========================================================================= */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3.5 min-h-0 overflow-hidden">
            {/* --------------------------------------------------------------------- */}
            {/* LEFT COLUMN: LIVE ORDERS PIPELINE QUEUE (5 cols) */}
            {/* --------------------------------------------------------------------- */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col min-h-0 overflow-hidden">
              <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span>Incoming Orders Queue</span>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {filteredOnlineOrders.length} orders
                </span>
              </div>

              <div className="overflow-y-auto flex-1 p-2 space-y-2 divide-y-0">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-24 bg-slate-800/40 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : filteredOnlineOrders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
                    <Smartphone className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
                    <p className="font-semibold text-slate-300 text-sm">No Orders Found</p>
                    <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">
                      Orders placed via Web Storefront or Mobile Apps will appear here in real-time.
                    </p>
                  </div>
                ) : (
                  filteredOnlineOrders.map((order) => {
                    const isSelected = activeOrder?.id === order.id;
                    const date = new Date(order.timestamp);
                    const isPending = order.fulfillmentStatus === 'PENDING';
                    const isPreparing = order.fulfillmentStatus === 'PREPARING';
                    const isReady = order.fulfillmentStatus === 'READY';
                    const isCompleted = order.fulfillmentStatus === 'COMPLETED';
                    const isCancelled = order.fulfillmentStatus === 'CANCELLED';
                    const isDelivery = order.orderType === 'DELIVERY';

                    return (
                      <div
                        key={order.id}
                        onClick={() => {
                          soundManager.playClick();
                          setSelectedOrderId(order.id);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition relative space-y-2 ${
                          isSelected
                            ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/30'
                            : isPending
                            ? 'bg-slate-900 border-amber-500/40 hover:bg-slate-850'
                            : 'bg-slate-900/90 border-slate-800 hover:bg-slate-850'
                        }`}
                      >
                        {/* Top Meta Line: Receipt # + Badges */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">
                              #{order.receiptNumber}
                            </span>

                            {/* Channel Badge */}
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                order.orderSource === 'STOREFRONT'
                                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                              }`}
                            >
                              {order.orderSource === 'STOREFRONT' ? (
                                <Globe className="w-2.5 h-2.5" />
                              ) : (
                                <Smartphone className="w-2.5 h-2.5" />
                              )}
                              <span>{order.orderSource === 'STOREFRONT' ? 'Web' : 'App'}</span>
                            </span>

                            {/* Type Badge */}
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.2 rounded ${
                                isDelivery
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-purple-500/15 text-purple-300'
                              }`}
                            >
                              {isDelivery ? <Truck className="w-2.5 h-2.5" /> : <ShoppingBag className="w-2.5 h-2.5" />}
                              <span>{isDelivery ? 'Delivery' : 'Pickup'}</span>
                            </span>
                          </div>

                          {/* Fulfillment Status Pill */}
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isPending
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                                : isPreparing
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : isReady
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : isCompleted
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {order.fulfillmentStatus}
                          </span>
                        </div>

                        {/* Customer & Items preview */}
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span className="truncate max-w-[200px] font-medium text-slate-200">
                            {order.customerName || 'Anonymous Customer'}
                          </span>
                          <span className="font-mono text-slate-400 text-[11px]">
                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Bottom Line: Total & Payment */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400">
                              {order.items.reduce((s, i) => s + i.quantity, 0)} items
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                order.paymentStatus === 'PAID'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {order.paymentStatus || 'PAID'}
                            </span>
                          </div>

                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {formatPrice(order.total)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* --------------------------------------------------------------------- */}
            {/* RIGHT COLUMN: MASTER INSPECTION & ASSOCIATED ITEMS WORKSPACE (7 cols) */}
            {/* --------------------------------------------------------------------- */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-xl">
              {activeOrder ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {/* Top Bar: Order Header + Actions */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-white font-mono flex items-center gap-1.5">
                            <span>#{activeOrder.receiptNumber}</span>
                            <button
                              onClick={() => handleCopyReceipt(activeOrder.receiptNumber)}
                              className="text-slate-500 hover:text-slate-300 transition"
                              title="Copy Receipt #"
                            >
                              {copiedReceipt ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </h2>

                          {/* Payment status badge with toggle */}
                          <button
                            onClick={() => handleTogglePayment(activeOrder)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                              activeOrder.paymentStatus === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                            }`}
                            title="Click to toggle payment status"
                          >
                            ● {activeOrder.paymentStatus || 'PAID'} ({activeOrder.paymentMethod})
                          </button>
                        </div>

                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Placed on {new Date(activeOrder.timestamp).toLocaleDateString()} at{' '}
                          {new Date(activeOrder.timestamp).toLocaleTimeString()} via{' '}
                          <strong className="text-slate-200">
                            {activeOrder.orderSource === 'STOREFRONT' ? 'Web Storefront' : 'Mobile App'}
                          </strong>
                        </p>
                      </div>

                      {/* Top Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            soundManager.playClick();
                            setPackingSlipOrder(activeOrder);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                          title="Print Kitchen / Packing Slip"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-300" />
                          <span>Packing Slip</span>
                        </button>

                        <button
                          onClick={() => {
                            soundManager.playClick();
                            onViewReceipt(activeOrder);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                          title="View Thermal Receipt"
                        >
                          <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Receipt</span>
                        </button>
                      </div>
                    </div>

                    {/* Customer & Location Card */}
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white block">
                              {activeOrder.customerName || 'Anonymous Customer'}
                            </span>
                            {activeOrder.customerPhone && (
                              <a
                                href={`tel:${activeOrder.customerPhone}`}
                                className="text-emerald-400 hover:underline font-mono text-[11px] flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                {activeOrder.customerPhone}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Button to view this customer in Customer Management CRM */}
                        {activeOrder.customerId && (
                          <button
                            onClick={() => handleNavigateToCustomer(activeOrder)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-cyan-400 rounded-lg text-[11px] font-semibold flex items-center gap-1 border border-slate-700 transition"
                            title="Inspect full profile & past purchases in CRM"
                          >
                            <span>Customer Profile</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Delivery Address */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-start justify-between gap-2 text-slate-300">
                        <div className="flex items-start gap-1.5">
                          {activeOrder.orderType === 'DELIVERY' ? (
                            <>
                              <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium text-amber-300 block">
                                  Home Delivery:
                                </span>
                                <span>
                                  {activeOrder.deliveryAddress || 'Address on file'}
                                  {activeOrder.deliveryCity ? `, ${activeOrder.deliveryCity}` : ''}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                              <span className="text-purple-300 font-medium">
                                In-Store Customer Pickup
                              </span>
                            </>
                          )}
                        </div>

                        {activeOrder.deliveryAddress && (
                          <button
                            onClick={() =>
                              handleCopyAddress(
                                `${activeOrder.deliveryAddress}, ${activeOrder.deliveryCity || ''}`
                              )
                            }
                            className="text-slate-500 hover:text-slate-300 shrink-0"
                            title="Copy Address"
                          >
                            {copiedAddress ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {activeOrder.customerNotes && (
                        <div className="p-2 bg-amber-500/10 rounded-lg text-[11px] text-amber-300 border border-amber-500/20 italic">
                          &ldquo;{activeOrder.customerNotes}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* ASSOCIATED ORDER ITEM LIST TABLE */}
                  {/* ========================================================================= */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-emerald-400" />
                        <span>
                          Associated Order Items ({activeOrder.items.reduce((s, i) => s + i.quantity, 0)})
                        </span>
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400">
                        {activeOrder.items.length} line items
                      </span>
                    </div>

                    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="p-2.5">Item Description</th>
                            <th className="p-2.5 text-center">Qty</th>
                            <th className="p-2.5 text-right">Unit Price</th>
                            <th className="p-2.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
                          {activeOrder.items.map((item, idx) => (
                            <tr key={`${item.productId}-${idx}`} className="hover:bg-slate-900/40">
                              <td className="p-2.5 font-sans">
                                <span className="font-bold text-white block">
                                  {item.productName}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Barcode: {item.barcode}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-bold text-white">
                                {item.quantity}
                              </td>
                              <td className="p-2.5 text-right text-slate-400">
                                {formatPrice(item.unitPrice)}
                              </td>
                              <td className="p-2.5 text-right font-bold text-emerald-400">
                                {formatPrice(item.totalPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Detailed Financial Summary Table */}
                      <div className="p-3 bg-slate-900/60 border-t border-slate-800 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Gross Items Subtotal</span>
                          <span className="font-mono">
                            {formatPrice(
                              activeOrder.grossAmount ||
                                activeOrder.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
                            )}
                          </span>
                        </div>

                        {activeOrder.discountAmount > 0 && (
                          <div className="flex justify-between text-amber-400">
                            <span>Promotional Discount</span>
                            <span className="font-mono">-{formatPrice(activeOrder.discountAmount)}</span>
                          </div>
                        )}

                        {activeOrder.deliveryFee && activeOrder.deliveryFee > 0 ? (
                          <div className="flex justify-between text-slate-300">
                            <span>Delivery Fee</span>
                            <span className="font-mono">+{formatPrice(activeOrder.deliveryFee)}</span>
                          </div>
                        ) : null}

                        {activeOrder.taxAmount > 0 && (
                          <div className="flex justify-between text-slate-400">
                            <span>Tax (VAT)</span>
                            <span className="font-mono">+{formatPrice(activeOrder.taxAmount)}</span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-white">
                          <span>Total Amount Due</span>
                          <span className="font-mono text-emerald-400 text-base">
                            {formatPrice(activeOrder.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* SEAMLESS FULFILLMENT ACTION WORKFLOW BAR */}
                  {/* ========================================================================= */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Fulfillment Action Pipeline</span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Current: <strong className="text-white">{activeOrder.fulfillmentStatus}</strong>
                      </span>
                    </div>

                    {/* Stage 1: PENDING -> PREPARING */}
                    {activeOrder.fulfillmentStatus === 'PENDING' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-slate-400">Estimated Prep Time:</label>
                          {['15 mins', '30 mins', '45 mins', '60 mins'].map((time) => (
                            <button
                              key={time}
                              onClick={() => setSelectedPrepTime(time)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                selectedPrepTime === time
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleProgressStatus(activeOrder, 'PREPARING')}
                            disabled={isUpdatingStatus}
                            className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                          >
                            <span>Accept & Start Packing</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleProgressStatus(activeOrder, 'CANCELLED')}
                            disabled={isUpdatingStatus}
                            className="py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs rounded-xl transition"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Stage 2: PREPARING -> READY */}
                    {activeOrder.fulfillmentStatus === 'PREPARING' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleProgressStatus(activeOrder, 'READY')}
                          disabled={isUpdatingStatus}
                          className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                          <Truck className="w-4 h-4" />
                          <span>
                            {activeOrder.orderType === 'PICKUP'
                              ? 'Ready for Customer Pickup'
                              : 'Ready for Courier Dispatch'}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Stage 3: READY -> COMPLETED */}
                    {activeOrder.fulfillmentStatus === 'READY' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleProgressStatus(activeOrder, 'COMPLETED')}
                          disabled={isUpdatingStatus}
                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Mark Order as Delivered / Completed</span>
                        </button>
                      </div>
                    )}

                    {/* Stage 4: COMPLETED or CANCELLED */}
                    {activeOrder.fulfillmentStatus === 'COMPLETED' && (
                      <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                        <span className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Order has been successfully fulfilled and closed.</span>
                        </span>
                      </div>
                    )}

                    {activeOrder.fulfillmentStatus === 'CANCELLED' && (
                      <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
                        <span className="flex items-center gap-1.5 font-bold">
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span>This order was cancelled.</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
                  <Package className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
                  <p className="font-semibold text-slate-300 text-sm">No Order Selected</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Select an order from the incoming queue on the left to inspect its items and take action.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: IN-STORE POS REGISTER TRANSACTION HISTORY */}
      {/* ========================================================================= */}
      {subTab === 'pos' && (
        <div className="flex-1 flex flex-col min-h-0">
          <HistoryView onViewReceipt={onViewReceipt} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* PACKING SLIP THERMAL PRINT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {packingSlipOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between no-print">
              <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Kitchen / Courier Packing Slip</span>
              </h3>
              <button
                onClick={() => setPackingSlipOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 flex justify-center bg-slate-950/40">
              <div
                id="printable-packing-slip"
                className="w-full bg-white text-black p-4 rounded-md shadow font-mono text-xs leading-tight"
              >
                <div className="text-center pb-2 border-b border-dashed border-zinc-400">
                  <h2 className="font-black text-sm uppercase">{settings.storeName}</h2>
                  <p className="text-[10px] text-zinc-600 uppercase">
                    PACKING SLIP • #{packingSlipOrder.receiptNumber}
                  </p>
                  <p className="text-[9px] text-zinc-500">
                    {new Date(packingSlipOrder.timestamp).toLocaleString()}
                  </p>
                </div>

                <div className="py-2 border-b border-dashed border-zinc-400 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Channel:</span>
                    <strong className="uppercase">{packingSlipOrder.orderSource}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <strong className="uppercase">{packingSlipOrder.orderType}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <strong>{packingSlipOrder.customerName || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <strong>{packingSlipOrder.customerPhone || 'N/A'}</strong>
                  </div>
                  {packingSlipOrder.deliveryAddress && (
                    <div className="pt-1 text-[9px] text-zinc-700">
                      <span>Address: </span>
                      {packingSlipOrder.deliveryAddress}, {packingSlipOrder.deliveryCity || ''}
                    </div>
                  )}
                  {packingSlipOrder.customerNotes && (
                    <div className="pt-1 text-[9px] text-amber-800 italic">
                      Note: {packingSlipOrder.customerNotes}
                    </div>
                  )}
                </div>

                <div className="py-2 space-y-1">
                  <div className="font-bold text-[10px] flex justify-between border-b pb-1">
                    <span>Item</span>
                    <span>Qty</span>
                  </div>
                  {packingSlipOrder.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="truncate max-w-[200px]">{i.productName}</span>
                      <strong className="font-bold">x{i.quantity}</strong>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-dashed border-zinc-400 text-right">
                  <span className="text-[10px] block">TOTAL AMOUNT</span>
                  <span className="font-black text-sm">{formatPrice(packingSlipOrder.total)}</span>
                  <span className="text-[9px] block text-zinc-600">
                    Payment: {packingSlipOrder.paymentStatus} ({packingSlipOrder.paymentMethod})
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end gap-2 no-print">
              <button
                onClick={() => setPackingSlipOrder(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Close
              </button>
              <button
                onClick={() => {
                  soundManager.playClick();
                  window.print();
                }}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
