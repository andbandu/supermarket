'use client';

import React, { useState } from 'react';
import { usePOS } from '@/context/POSContext';
import { Order } from '@/types/pos';
import { soundManager } from '@/lib/sound';
import { apiClient } from '@/lib/apiClient';
import { toast } from '@/context/ToastContext';
import {
  Receipt,
  Search,
  Filter,
  Eye,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Calendar,
  Banknote,
  CreditCard,
  QrCode,
  Download,
  UploadCloud,
  AlertCircle,
  Database,
} from 'lucide-react';

interface HistoryViewProps {
  onViewReceipt: (order: Order) => void;
}

export default function HistoryView({ onViewReceipt }: HistoryViewProps) {
  const { orders, refundOrder, settings, isSupabaseLive, dbSource, refreshFromApi, formatPrice } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMPLETED' | 'REFUNDED'>('ALL');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [isSyncingToDb, setIsSyncingToDb] = useState(false);
  const [orderToRefund, setOrderToRefund] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('Customer return / damaged item');

  // Metrics
  const totalSalesRevenue = orders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + o.total, 0);

  const totalRefundedRevenue = orders
    .filter((o) => o.status === 'REFUNDED')
    .reduce((sum, o) => sum + o.total, 0);

  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;
  const refundedCount = orders.filter((o) => o.status === 'REFUNDED').length;

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.cashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.some((i) => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === 'ALL' || order.status === filterStatus;
    const matchesPayment = filterPayment === 'ALL' || order.paymentMethod === filterPayment;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  const handleOpenRefundModal = (order: Order) => {
    soundManager.playClick();
    setOrderToRefund(order);
    setRefundReason('Customer return / damaged item');
  };

  const handleConfirmRefund = async () => {
    if (!orderToRefund) return;
    const order = orderToRefund;
    const reason = refundReason.trim() || 'Customer return';

    setRefundingOrderId(order.id);
    const res = await refundOrder(order.id, reason);
    setRefundingOrderId(null);
    setOrderToRefund(null);

    if (res.success) {
      soundManager.playSuccess();
      toast.success(
        `Order #${order.receiptNumber} refunded successfully!\n${res.message || 'Inventory stock restored in database.'}`,
        'Refund Completed'
      );
    } else {
      soundManager.playError();
      toast.warning(`Order refund note: ${res.error || 'Refund recorded.'}`, 'Refund Notice');
    }
  };

  const handleExportHistory = () => {
    soundManager.playClick();
    const headers = ['ReceiptNumber,Date,Time,Status,PaymentMethod,Subtotal,Tax,Total,Cashier\n'];
    const rows = orders.map((o) => {
      const d = new Date(o.timestamp);
      return `"${o.receiptNumber}","${d.toLocaleDateString()}","${d.toLocaleTimeString()}","${o.status}","${o.paymentMethod}",${o.subtotal},${o.taxAmount},${o.total},"${o.cashierName}"`;
    });
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minimart-sales-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Sales history exported as CSV', 'Export Downloaded');
  };

  const handleSyncToSupabase = async () => {
    setIsSyncingToDb(true);
    soundManager.playClick();
    try {
      const res = await apiClient.syncToDatabase();
      if (res.success) {
        soundManager.playSuccess();
        toast.success(res.message || 'Orders successfully synced to Supabase PostgreSQL!', 'Sync Complete');
        await refreshFromApi();
      } else {
        soundManager.playError();
        toast.error(
          `Cannot sync to Supabase:\n${res.error || 'Database connection missing'}\n\nPlease check DATABASE_URL in .env`,
          'Supabase Sync Failed',
          7000
        );
      }
    } catch (err: unknown) {
      soundManager.playError();
      toast.error(`Sync failed: ${err instanceof Error ? err.message : String(err)}`, 'Sync Error');
    } finally {
      setIsSyncingToDb(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* Database Connection Notice Banner */}
      {!isSupabaseLive ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Storage Status:</strong> Orders are currently stored in your local persistent database (<code>data/minimart_db.json</code>). To save to Supabase cloud PostgreSQL, add your <code>DATABASE_URL</code> to <code>.env.local</code>.
            </span>
          </div>
          <button
            onClick={handleSyncToSupabase}
            disabled={isSyncingToDb}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg transition shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{isSyncingToDb ? 'Syncing...' : 'Sync Orders to Supabase'}</span>
          </button>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Live Database:</strong> Connected to Supabase PostgreSQL via Prisma ORM.
            </span>
          </div>
          <button
            onClick={handleSyncToSupabase}
            disabled={isSyncingToDb}
            className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/30 rounded text-[11px] font-semibold flex items-center gap-1 transition"
          >
            <UploadCloud className="w-3 h-3" />
            <span>{isSyncingToDb ? 'Syncing...' : 'Push Local Backup'}</span>
          </button>
        </div>
      )}
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Net Sales Revenue</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
              {formatPrice(totalSalesRevenue)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Completed Transactions</p>
            <p className="text-xl font-bold text-white mt-0.5">{completedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Refunded Transactions</p>
            <p className="text-xl font-bold text-rose-400 mt-0.5">{refundedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Refunded Amount</p>
            <p className="text-xl font-bold text-slate-300 font-mono mt-0.5">
              {formatPrice(totalRefundedRevenue)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search receipt #, product or cashier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 text-white pl-9 pr-3 py-2 rounded-lg border border-slate-700/80 focus:border-emerald-500 text-xs transition"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'COMPLETED' | 'REFUNDED')}
            className="bg-slate-950 text-white px-3 py-2 rounded-lg border border-slate-700/80 text-xs focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          {/* Payment filter */}
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className="bg-slate-950 text-white px-3 py-2 rounded-lg border border-slate-700/80 text-xs focus:border-emerald-500"
          >
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="QR">QR Code</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncToSupabase}
            disabled={isSyncingToDb}
            className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30 transition"
            title="Push local orders to Supabase cloud database"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{isSyncingToDb ? 'Syncing...' : 'Sync to Supabase'}</span>
          </button>

          <button
            onClick={handleExportHistory}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Orders List Table */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          {filteredOrders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
              <Receipt className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
              <p className="font-semibold text-slate-300 text-sm">No Transactions Found</p>
              <p className="text-xs text-slate-500 mt-1">
                Completed sales from the register will appear here.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800 sticky top-0 z-10 text-[11px]">
                <tr>
                  <th className="p-3">Receipt #</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Cashier</th>
                  <th className="p-3">Items</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredOrders.map((order) => {
                  const date = new Date(order.timestamp);
                  const isRefunded = order.status === 'REFUNDED';
                  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);

                  return (
                    <tr key={order.id} className="hover:bg-slate-850/60 transition">
                      <td className="p-3 font-mono font-bold text-white">{order.receiptNumber}</td>
                      <td className="p-3 text-slate-400">
                        <span>{date.toLocaleDateString()}</span>
                        <span className="block text-[10px] text-slate-500 font-mono">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 truncate max-w-[140px]">
                        {order.cashierName}
                      </td>
                      <td className="p-3">
                        <span className="text-slate-300 font-medium">
                          {totalItems} {totalItems === 1 ? 'item' : 'items'}
                        </span>
                        <span className="block text-[10px] text-slate-500 truncate max-w-xs">
                          {order.items.map((i) => i.productName).join(', ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {order.paymentMethod === 'CASH' && <Banknote className="w-3 h-3 text-emerald-400" />}
                          {order.paymentMethod === 'CARD' && <CreditCard className="w-3 h-3 text-sky-400" />}
                          {order.paymentMethod === 'QR' && <QrCode className="w-3 h-3 text-amber-400" />}
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-sm">
                        <span className={isRefunded ? 'line-through text-slate-500' : 'text-emerald-400'}>
                          {formatPrice(order.total)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isRefunded
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {order.status}
                        </span>
                        {isRefunded && order.refundReason && (
                          <span className="block text-[9px] text-rose-300/80 truncate max-w-[120px] mx-auto mt-0.5">
                            {order.refundReason}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Receipt */}
                          <button
                            onClick={() => onViewReceipt(order)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                            title="View / Print Receipt"
                          >
                            <Eye className="w-3 h-3 text-emerald-400" />
                            <span>Receipt</span>
                          </button>

                          {/* Refund Button */}
                          {!isRefunded && (
                            <button
                              disabled={refundingOrderId === order.id}
                              onClick={() => handleOpenRefundModal(order)}
                              className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 hover:text-rose-300 rounded border border-rose-500/25 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                              title="Refund / Return items"
                            >
                              <span>{refundingOrderId === order.id ? 'Refunding...' : 'Refund'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modern Refund Confirmation Modal */}
      {orderToRefund && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOrderToRefund(null);
          }}
        >
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <h3 className="font-bold text-sm text-white">
                  Refund Order #{orderToRefund.receiptNumber}
                </h3>
              </div>
              <button
                onClick={() => setOrderToRefund(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                <div>
                  <p className="text-slate-400">Total Refund Amount</p>
                  <p className="text-lg font-bold font-mono text-rose-400">
                    {formatPrice(orderToRefund.total)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400">Payment Type</p>
                  <p className="font-semibold text-white">{orderToRefund.paymentMethod}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Refund Reason / Customer Note
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  {/* Preset quick reasons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Customer return',
                      'Damaged product',
                      'Wrong item scanned',
                      'Cashier mistake',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRefundReason(preset)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-white border border-slate-700/60"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Refunding this transaction will update the order status to <strong>REFUNDED</strong> and immediately restore product inventory counts.
              </p>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOrderToRefund(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={refundingOrderId === orderToRefund.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{refundingOrderId === orderToRefund.id ? 'Refunding...' : 'Confirm Refund'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

