'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { soundManager } from '@/lib/sound';
import { toast } from '@/context/ToastContext';
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
  Database,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Code2,
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
    isSupabaseLive,
    isSyncing,
    isLoading,
    refreshFromApi,
  } = usePOS();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [showApiModal, setShowApiModal] = useState(false);

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

  const lowStockCount = products.filter((p) => p.stock <= p.reorderLevel).length;

  const handleOpenDrawer = () => {
    soundManager.playCashDrawer();
    toast.info('Cash drawer opened successfully (Kick signal sent to printer).', 'Drawer Opened');
  };

  const toggleSound = () => {
    const nextState = !settings.soundEnabled;
    updateSettings({ soundEnabled: nextState });
    if (nextState) {
      soundManager.playBeep();
      toast.info('Sound effects enabled', 'Audio Feedback');
    } else {
      toast.info('Sound effects muted', 'Audio Feedback');
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white select-none sticky top-0 z-30 shadow-md">
      <div className="max-w-[1920px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Brand & Store Name */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
            <Store className="w-5 h-5" />
          </div>
          {isLoading || !settings.storeName ? (
            <div className="space-y-1.5 animate-pulse py-0.5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-36 bg-slate-800 rounded"></div>
                <div className="h-4 w-28 bg-slate-800/80 rounded-full"></div>
              </div>
              <div className="h-3 w-44 bg-slate-800/60 rounded"></div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-wide text-white font-mono">
                  {settings.storeName}
                </span>

                {/* Prisma ORM, Supabase & Mobile API Status Pill */}
                <button
                  onClick={() => setShowApiModal(true)}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                    isSupabaseLive
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25'
                  }`}
                  title="Click to view Prisma ORM, Supabase PostgreSQL & Mobile API status"
                >
                  <Database className="w-3 h-3" />
                  <span>{isSupabaseLive ? 'Prisma & Postgres Live' : 'Prisma ORM'}</span>
                  {isSyncing ? (
                    <RefreshCw className="w-2.5 h-2.5 animate-spin ml-0.5 text-cyan-400" />
                  ) : (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSupabaseLive ? 'bg-emerald-400' : 'bg-cyan-400'
                      }`}
                    />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                {settings.tagline}
              </p>
            </div>
          )}
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
          {/* Mobile API quick info button */}
          <button
            onClick={() => setShowApiModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition text-xs font-medium"
            title="Mobile App API connection documentation"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile API</span>
          </button>

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

      {/* Supabase & Mobile API Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Prisma ORM & PostgreSQL (Supabase) Database
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Type-safe Prisma client & secure REST API for web and mobile
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowApiModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Database Status Card */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {isSupabaseLive ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold text-slate-200">
                      {isSupabaseLive
                        ? 'PostgreSQL: Live Connected via Prisma ORM'
                        : 'Prisma ORM: Configured with Local Fallback'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      To connect your Supabase database, set <code className="text-emerald-400 font-mono">DATABASE_URL</code> in <code className="text-slate-200 font-mono">.env.local</code> and run <code className="text-emerald-400 font-mono">npx prisma db push</code>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={refreshFromApi}
                  disabled={isSyncing}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 border border-slate-700 shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>
              </div>

              {/* Prisma Commands Quick Guide */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  Prisma ORM Commands
                </h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-1.5 text-slate-300">
                  <p><span className="text-slate-500"># Sync schema to Supabase PostgreSQL:</span><br /><span className="text-emerald-400 font-bold">npx prisma db push</span></p>
                  <p><span className="text-slate-500"># Seed default 27 minimart goods:</span><br /><span className="text-emerald-400 font-bold">npx prisma db seed</span></p>
                  <p><span className="text-slate-500"># Open Prisma visual database browser:</span><br /><span className="text-sky-400 font-bold">npx prisma studio</span></p>
                </div>
              </div>

              {/* Mobile App Connection Guide */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                  <Smartphone className="w-4 h-4 text-indigo-400" />
                  Mobile App Connection Specs (Flutter, React Native, Swift, Kotlin)
                </h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-2 text-slate-300">
                  <div>
                    <span className="text-slate-500"># 1. API Base URL</span>
                    <p className="text-emerald-400 font-bold">http://&lt;your-server-ip&gt;:3000/api</p>
                  </div>

                  <div>
                    <span className="text-slate-500"># 2. Authentication Header</span>
                    <p className="text-amber-400">
                      x-api-key: minimart_pos_sec_key_2026
                    </p>
                    <span className="text-slate-500 text-[10px]">
                      (Or `Authorization: Bearer minimart_pos_sec_key_2026`)
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500"># 3. Available Endpoints</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-400 mt-1">
                      <li>
                        <code className="text-sky-300">GET /api/products</code> - List catalog & stock
                      </li>
                      <li>
                        <code className="text-sky-300">POST /api/orders</code> - Process sale & reduce stock
                      </li>
                      <li>
                        <code className="text-sky-300">POST /api/orders/:id/refund</code> - Refund order
                      </li>
                      <li>
                        <code className="text-sky-300">GET /api/health</code> - Server & DB health check
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Supabase SQL Schema quick notice */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    PostgreSQL tables script generated in:{' '}
                    <code className="text-emerald-400 font-mono">supabase/schema.sql</code>
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowApiModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
