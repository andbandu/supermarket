'use client';

import React, { useState } from 'react';
import { usePOS } from '@/context/POSContext';
import { Order } from '@/types/pos';
import { soundManager } from '@/lib/sound';
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
} from 'lucide-react';

interface HistoryViewProps {
  onViewReceipt: (order: Order) => void;
}

export default function HistoryView({ onViewReceipt }: HistoryViewProps) {
  const { orders, refundOrder, settings } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMPLETED' | 'REFUNDED'>('ALL');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');

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

  const handleRefund = (order: Order) => {
    if (order.status === 'REFUNDED') return;
    const reason = window.prompt(
      `Enter reason for refunding order ${order.receiptNumber}:`,
      'Customer return / damaged item'
    );
    if (reason !== null) {
      refundOrder(order.id, reason);
      alert(`Order ${order.receiptNumber} refunded. Stock returned to inventory.`);
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
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Net Sales Revenue</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
              {settings.currencySymbol}
              {totalSalesRevenue.toFixed(2)}
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
              {settings.currencySymbol}
              {totalRefundedRevenue.toFixed(2)}
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

        {/* Export Button */}
        <button
          onClick={handleExportHistory}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Sales CSV</span>
        </button>
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
                          {settings.currencySymbol}
                          {order.total.toFixed(2)}
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
                              onClick={() => handleRefund(order)}
                              className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded border border-rose-500/25 text-[11px] font-medium transition"
                              title="Refund / Return items"
                            >
                              Refund
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
    </div>
  );
}

