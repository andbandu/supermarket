'use client';

import React, { useState } from 'react';
import { usePOS } from '@/context/POSContext';
import { soundManager } from '@/lib/sound';
import { toast } from '@/context/ToastContext';
import {
  BarChart3,
  Printer,
  DollarSign,
  Banknote,
  CreditCard,
  QrCode,
  ShieldAlert,
  Clock,
  ArrowDownCircle,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export default function ShiftReportView() {
  const { shift, orders, settings, performCashDrop, closeShift, startNewShift, formatPrice, isLoading } = usePOS();

  const [actualDrawerCount, setActualDrawerCount] = useState<string>('');
  const [cashDropAmount, setCashDropAmount] = useState<string>('');
  const [cashDropReason, setCashDropReason] = useState<string>('Mid-day safe drop');
  const [showDropModal, setShowDropModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [newCashierName, setNewCashierName] = useState('Kasun Perera (Cashier #01)');
  const [newStartingFloat, setNewStartingFloat] = useState('5000.00');

  // Filter orders created during this shift
  const shiftOrders = orders.filter(
    (o) => new Date(o.timestamp) >= new Date(shift.startedAt)
  );

  const completedOrders = shiftOrders.filter((o) => o.status === 'COMPLETED');

  // Sales totals for shift
  const grossSales = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const totalTax = completedOrders.reduce((sum, o) => sum + o.taxAmount, 0);
  const totalDiscounts = completedOrders.reduce((sum, o) => sum + o.discountAmount, 0);
  const totalItemsSold = completedOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0
  );

  const cashSales = completedOrders
    .filter((o) => o.paymentMethod === 'CASH')
    .reduce((sum, o) => sum + o.total, 0);

  const cardSales = completedOrders
    .filter((o) => o.paymentMethod === 'CARD')
    .reduce((sum, o) => sum + o.total, 0);

  const qrSales = completedOrders
    .filter((o) => o.paymentMethod === 'QR')
    .reduce((sum, o) => sum + o.total, 0);

  const avgTicket = completedOrders.length > 0 ? grossSales / completedOrders.length : 0;

  // Expected cash in drawer
  const expectedCashInDrawer = shift.startingFloat + cashSales - shift.cashDrops;

  const handlePrintZReport = () => {
    soundManager.playClick();
    window.print();
  };

  const handleExecuteDrop = () => {
    const amt = parseFloat(cashDropAmount);
    if (isNaN(amt) || amt <= 0) {
      soundManager.playError();
      toast.warning('Please enter a valid cash amount to drop into the safe.', 'Invalid Amount');
      return;
    }
    performCashDrop(amt, cashDropReason);
    setShowDropModal(false);
    setCashDropAmount('');
    toast.success(
      `Successfully dropped ${formatPrice(amt)} to safe.`,
      'Safe Drop Recorded'
    );
  };

  const handleExecuteClose = () => {
    const actual = parseFloat(actualDrawerCount);
    if (isNaN(actual)) {
      soundManager.playError();
      toast.warning('Please enter the actual cash counted in the drawer.', 'Count Required');
      return;
    }
    closeShift(actual);
    setShowCloseModal(false);
    toast.success('Shift closed successfully. Ready to print or file Z-Report.', 'Shift Closed');
  };

  const handleStartNew = () => {
    const floatVal = parseFloat(newStartingFloat) || 200;
    startNewShift(floatVal, newCashierName);
    toast.info(
      `Started new shift for ${newCashierName} with ${formatPrice(floatVal)} float.`,
      'Shift Started'
    );
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-y-auto bg-slate-950 p-4 sm:p-6 space-y-5">
      {/* Top Banner / Actions */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Daily Shift Sales & Z-Report
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                shift.isClosed
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {shift.isClosed ? 'SHIFT CLOSED' : 'ACTIVE SHIFT'}
            </span>
          </div>
          {isLoading || !shift.cashierName ? (
            <div className="flex items-center gap-2 mt-1.5 animate-pulse">
              <div className="h-4 w-32 bg-slate-800 rounded font-mono" />
              <div className="h-4 w-40 bg-slate-800/60 rounded font-mono" />
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 font-mono">
              <span>Cashier: <strong className="text-slate-200">{shift.cashierName}</strong></span>
              <span>&bull;</span>
              <span>Started: {new Date(shift.startedAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => setShowDropModal(true)}
            disabled={shift.isClosed}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-400 font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Cash Drop to Safe</span>
          </button>

          <button
            onClick={handlePrintZReport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Z-Report</span>
          </button>

          {!shift.isClosed ? (
            <button
              onClick={() => setShowCloseModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Close Shift</span>
            </button>
          ) : (
            <button
              onClick={handleStartNew}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start New Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase font-medium">Shift Total Sales</p>
          <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {formatPrice(grossSales)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{completedOrders.length} orders settled</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase font-medium">Opening Cash Float</p>
          <p className="text-2xl font-black text-slate-100 font-mono mt-1">
            {formatPrice(shift.startingFloat)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Initial drawer float</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase font-medium">Items Sold</p>
          <p className="text-2xl font-black text-sky-400 font-mono mt-1">{totalItemsSold} units</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Avg {formatPrice(avgTicket)} / basket
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase font-medium">Expected Drawer Cash</p>
          <p className="text-2xl font-black text-amber-400 font-mono mt-1">
            {formatPrice(expectedCashInDrawer)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Float + Cash Sales - Drops ({formatPrice(shift.cashDrops)})
          </p>
        </div>
      </div>

      {/* Payment Method Breakdown & Drawer Reconciliation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Payment Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Revenue Breakdown by Tender
          </h3>

          <div className="space-y-3 text-xs">
            {/* Cash */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-200">Cash Received</span>
                  <p className="text-[11px] text-slate-500">
                    {completedOrders.filter((o) => o.paymentMethod === 'CASH').length} transactions
                  </p>
                </div>
              </div>
              <span className="font-mono font-bold text-base text-emerald-400">
                {formatPrice(cashSales)}
              </span>
            </div>

            {/* Card */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-200">Credit / Debit Card</span>
                  <p className="text-[11px] text-slate-500">
                    {completedOrders.filter((o) => o.paymentMethod === 'CARD').length} transactions
                  </p>
                </div>
              </div>
              <span className="font-mono font-bold text-base text-sky-400">
                {formatPrice(cardSales)}
              </span>
            </div>

            {/* QR / Digital Wallet */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-200">QR Code / Wallet</span>
                  <p className="text-[11px] text-slate-500">
                    {completedOrders.filter((o) => o.paymentMethod === 'QR').length} transactions
                  </p>
                </div>
              </div>
              <span className="font-mono font-bold text-base text-amber-400">
                {formatPrice(qrSales)}
              </span>
            </div>
          </div>

          {/* Tax & Discounts detail */}
          <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Total Sales Tax ({settings.taxRatePercent}%) Collected:</span>
              <span className="font-mono text-slate-200">
                {formatPrice(totalTax)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Discounts Granted:</span>
              <span className="font-mono text-slate-200">
                {formatPrice(totalDiscounts)}
              </span>
            </div>
          </div>
        </div>

        {/* Cash Drawer Reconciliation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Cash Drawer Audit & Reconciliation
          </h3>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Starting Float:</span>
              <span className="font-mono font-bold text-slate-200">
                {formatPrice(shift.startingFloat)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">(+) Cash Sales Received:</span>
              <span className="font-mono font-bold text-emerald-400">
                +{formatPrice(cashSales)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">(-) Cash Drops / Skims to Safe:</span>
              <span className="font-mono font-bold text-rose-400">
                -{formatPrice(shift.cashDrops)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
              <span className="text-slate-300">Expected In Drawer:</span>
              <span className="font-mono text-amber-400">
                {formatPrice(expectedCashInDrawer)}
              </span>
            </div>

            {shift.actualDrawerCash !== undefined && (
              <>
                <div className="flex justify-between font-bold text-sm">
                  <span className="text-slate-300">Actual Counted Cash:</span>
                  <span className="font-mono text-white">
                    {formatPrice(shift.actualDrawerCash)}
                  </span>
                </div>

                <div
                  className={`p-2 rounded-lg border flex justify-between font-bold ${
                    shift.actualDrawerCash - expectedCashInDrawer >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <span>
                    Variance ({shift.actualDrawerCash >= expectedCashInDrawer ? 'Over' : 'Short'}):
                  </span>
                  <span className="font-mono">
                    {formatPrice(Math.abs(shift.actualDrawerCash - expectedCashInDrawer))}
                  </span>
                </div>
              </>
            )}
          </div>

          {shift.notes && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold block mb-1">Shift Audit Notes:</span>
              <p className="text-slate-300 font-mono whitespace-pre-line text-[11px]">
                {shift.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cash Drop Modal */}
      {showDropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-3">
              <ArrowDownCircle className="w-4 h-4 text-amber-400" />
              Cash Drop to Safe
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Transfer large bills or excess cash out of register into drop safe.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Amount to Drop ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  step="1"
                  min="50"
                  placeholder="e.g. 5000"
                  value={cashDropAmount}
                  onChange={(e) => setCashDropAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={cashDropReason}
                  onChange={(e) => setCashDropReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDropModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDrop}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg"
              >
                Confirm Drop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-rose-400" />
              End Shift & Count Drawer
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Count all bills and coins currently in the cash drawer before finalizing.
            </p>

            <div className="mb-4">
              <label className="text-xs text-slate-300 block mb-1">
                Actual Cash Counted in Drawer ({settings.currencySymbol}):
              </label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder={expectedCashInDrawer.toFixed(2)}
                value={actualDrawerCount}
                onChange={(e) => setActualDrawerCount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2.5 rounded-lg font-mono font-bold text-base"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Expected: {formatPrice(expectedCashInDrawer)}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteClose}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg"
              >
                Finalize & Close Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

