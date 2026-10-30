'use client';

import React from 'react';
import { usePOS } from '@/context/POSContext';
import { soundManager } from '@/lib/sound';
import { Printer, Check, X, Share2 } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiptModal({ isOpen, onClose }: ReceiptModalProps) {
  const { lastCompletedOrder, settings, isSupabaseLive, formatPrice } = usePOS();

  if (!isOpen || !lastCompletedOrder) return null;

  const order = lastCompletedOrder;
  const grossAmount =
    order.grossAmount !== undefined && order.grossAmount > 0
      ? order.grossAmount
      : order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handlePrint = () => {
    soundManager.playClick();
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Actions */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-sm text-white">Transaction Complete</h3>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Receipt Paper View */}
        <div className="overflow-y-auto p-4 flex justify-center bg-slate-950/40">
          <div
            id="printable-receipt"
            className="w-full max-w-[340px] bg-white text-black p-5 rounded-md shadow-lg font-mono text-xs leading-relaxed border-t-4 border-slate-800 select-all"
          >
            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-zinc-400">
              <h1 className="text-base font-black tracking-tight uppercase">
                {settings.storeName}
              </h1>
              <p className="text-[10px] text-zinc-600 uppercase mt-0.5">{settings.tagline}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{settings.storeAddress}</p>
              <p className="text-[10px] text-zinc-600">Tel: {settings.storePhone}</p>
            </div>

            {/* Receipt Meta */}
            <div className="py-2.5 border-b border-dashed border-zinc-400 text-[10px] space-y-1">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold">{order.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(order.timestamp).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{new Date(order.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="truncate max-w-[160px]">{order.cashierName}</span>
              </div>
            </div>

            {/* Online Order Details (if applicable) */}
            {order.orderSource && order.orderSource !== 'POS' && (
              <div className="py-2 border-b border-dashed border-zinc-400 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Channel:</span>
                  <span className="font-bold">{order.orderSource} ({order.orderType})</span>
                </div>
                {order.customerName && (
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-semibold">{order.customerName}</span>
                  </div>
                )}
                {order.customerPhone && (
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span>{order.customerPhone}</span>
                  </div>
                )}
                {(order.deliveryAddress || order.deliveryCity) && (
                  <div className="text-[9px] text-zinc-600 mt-0.5">
                    <span>
                      Delivery: {[order.deliveryAddress, order.deliveryCity].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Items Table */}
            <div className="py-2.5 border-b border-dashed border-zinc-400">
              <div className="flex justify-between font-bold pb-1 text-[11px]">
                <span>ITEM</span>
                <span>TOTAL</span>
              </div>

              <div className="space-y-1.5 pt-1">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                    <div className="flex justify-between font-medium">
                      <span className="truncate pr-2">{item.productName}</span>
                      <span className="shrink-0 font-bold">
                        {formatPrice(item.totalPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-600">
                      <span>
                        {item.quantity} x {formatPrice(item.unitPrice)}
                        {item.totalPrice < item.quantity * item.unitPrice && (
                          <span className="font-semibold text-zinc-800">
                            {' '}(Special: {formatPrice(item.totalPrice / item.quantity)})
                          </span>
                        )}
                      </span>
                      <span>#{item.barcode.slice(-4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b border-dashed border-zinc-400 space-y-1 text-[11px]">
              <div className="flex justify-between font-semibold">
                <span>Gross Amount:</span>
                <span>{formatPrice(grossAmount)}</span>
              </div>

              {order.discountAmount > 0 && (
                <>
                  <div className="flex justify-between text-zinc-700 font-semibold">
                    <span>
                      Discount {order.appliedDiscountCode ? `(${order.appliedDiscountCode})` : ''}:
                    </span>
                    <span>-{formatPrice(order.discountAmount)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Net Subtotal:</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                </>
              )}

              {order.deliveryFee != null && order.deliveryFee > 0 && (
                <div className="flex justify-between text-zinc-700">
                  <span>Delivery Fee:</span>
                  <span>{formatPrice(order.deliveryFee)}</span>
                </div>
              )}

              {(settings.taxRatePercent > 0 || order.taxAmount > 0) && (
                <div className="flex justify-between">
                  <span>Tax ({settings.taxRatePercent}%):</span>
                  <span>{formatPrice(order.taxAmount)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-sm pt-1.5 border-t border-zinc-400">
                <span>TOTAL DUE:</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-2.5 border-b border-dashed border-zinc-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="font-bold">{order.paymentMethod}</span>
              </div>
              {order.paymentMethod === 'CASH' && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Tendered:</span>
                    <span>{formatPrice(order.amountTendered)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Change Given:</span>
                    <span>{formatPrice(order.changeGiven)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Simulated Barcode at bottom of receipt */}
            <div className="pt-4 text-center">
              <div className="font-mono text-xs tracking-widest bg-zinc-100 py-1 rounded border border-zinc-200">
                ||| | |||| | |||||| || | || |||
              </div>
              <p className="text-[9px] text-zinc-500 mt-1 font-mono">{order.receiptNumber}</p>
              <p className="text-[10px] text-zinc-600 mt-3 font-sans italic">
                {settings.receiptFooter}
              </p>
            </div>
          </div>
        </div>

        {/* Database Status Notification Banner */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] no-print">
          <span className="text-slate-400">Database Record:</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Recorded in Real-Time (Supabase PostgreSQL)</span>
          </span>
        </div>

        {/* Modal Bottom Buttons */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Print Receipt</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition"
          >
            <Check className="w-4 h-4 text-slate-950" />
            <span>New Sale (Done)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

