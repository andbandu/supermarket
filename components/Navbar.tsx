'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { soundManager } from '@/lib/sound';
import {
  Store,
  ShoppingCart,
  Boxes,
  Receipt,
  BarChart3,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  Clock,
  User,
  PauseCircle,
  KeyRound,
} from 'lucide-react';

export default function Navbar({ onOpenHeldOrders }: { onOpenHeldOrders: () => void }) {
  const {
    settings,
    updateSettings,
    activeTab,
    setActiveTab,
    cartItemCount,
    heldOrders,
    products,
  } = usePOS();

  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate low stock items count
  const lowStockCount = products.filter((p) => p.stock <= p.reorderLevel).length;

  const handleOpenDrawer = () => {
    soundManager.playCashDrawer();
    alert('Cash drawer opened successfully (Kick signal sent).');
  };

  const toggleSound = () => {
    const nextState = !settings.soundEnabled;
    updateSettings({ soundEnabled: nextState });
    if (nextState) {
      soundManager.playBeep();
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white select-none sticky top-0 z-30 shadow-md">
      <div className="max-w-[1920px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Brand & Store Name */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wide text-white font-mono">
                {settings.storeName}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE POS
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
              {settings.tagline}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('pos');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'pos'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Register</span>
            {cartItemCount > 0 && (
              <span className="bg-emerald-400 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                {cartItemCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('inventory');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventory</span>
            {lowStockCount > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {lowStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('history');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>History</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('shift');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'shift'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Z-Report</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('settings');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Right Status Actions */}
        <div className="flex items-center gap-3">
          {/* Held Orders quick shortcut */}
          {heldOrders.length > 0 && (
            <button
              onClick={onOpenHeldOrders}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 transition text-xs font-medium animate-pulse"
              title="View suspended carts"
            >
              <PauseCircle className="w-4 h-4" />
              <span>Held ({heldOrders.length})</span>
            </button>
          )}

          {/* Open Drawer button */}
          <button
            onClick={handleOpenDrawer}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition"
            title="Simulate opening the cash drawer"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Drawer</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg border text-xs font-medium transition ${
              settings.soundEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                : 'bg-slate-800/50 text-slate-500 border-slate-800'
            }`}
            title={settings.soundEnabled ? 'Scanner Beeps Enabled' : 'Muted'}
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* Cashier Info */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-200 text-[11px] truncate max-w-[120px]">
                {settings.activeCashier}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="w-3 h-3 text-slate-500" />
                <span className="font-mono text-emerald-400">{currentTime || '--:--:--'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

