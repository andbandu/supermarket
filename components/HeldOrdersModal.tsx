'use client';

import React from 'react';
import { usePOS } from '@/context/POSContext';
import { soundManager } from '@/lib/sound';
import { X, Play, Trash2, Clock, ShoppingCart, AlertCircle } from 'lucide-react';

interface HeldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HeldOrdersModal({ isOpen, onClose }: HeldOrdersModalProps) {
  const { heldOrders, resumeHeldOrder, deleteHeldOrder, settings, formatPrice } = usePOS();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h2 className="text-base font-bold text-white">Parked / Held Orders</h2>
            <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full">
              {heldOrders.length}
            </span>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {heldOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="font-semibold text-slate-300 text-sm">No Held Orders</p>
              <p className="text-xs text-slate-500 mt-1">
                You can park any customer cart from the register screen when they step away to pick up more items.
              </p>
            </div>
          ) : (
            heldOrders.map((held) => (
              <div
                key={held.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{held.customerNote}</span>
                    <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      {held.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(held.heldAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>&bull;</span>
                    <span>
                      {held.items.reduce((s, i) => s + i.quantity, 0)} items:
                      <span className="text-slate-300 ml-1">
                        {held.items.map((i) => `${i.product.name} (x${i.quantity})`).join(', ')}
                      </span>
                    </span>
                  </div>

                  <p className="text-xs font-bold text-emerald-400 font-mono">
                    Total: {formatPrice(held.total)}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => {
                      deleteHeldOrder(held.id);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    title="Discard order"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      resumeHeldOrder(held.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Order</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

