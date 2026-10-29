'use client';

import React, { useState } from 'react';
import { usePOS } from '@/context/POSContext';
import { soundManager } from '@/lib/sound';
import {
  Settings as SettingsIcon,
  Store,
  DollarSign,
  Percent,
  Receipt,
  User,
  Volume2,
  RotateCcw,
  Save,
  CheckCircle2,
} from 'lucide-react';

export default function SettingsView() {
  const { settings, updateSettings, resetToSampleData } = usePOS();

  const [formData, setFormData] = useState({
    storeName: settings.storeName,
    tagline: settings.tagline,
    storeAddress: settings.storeAddress,
    storePhone: settings.storePhone,
    currencySymbol: settings.currencySymbol,
    taxRatePercent: settings.taxRatePercent.toString(),
    activeCashier: settings.activeCashier,
    receiptFooter: settings.receiptFooter,
    soundEnabled: settings.soundEnabled,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const taxRate = parseFloat(formData.taxRatePercent);

    updateSettings({
      storeName: formData.storeName,
      tagline: formData.tagline,
      storeAddress: formData.storeAddress,
      storePhone: formData.storePhone,
      currencySymbol: formData.currencySymbol,
      taxRatePercent: isNaN(taxRate) ? 7.0 : taxRate,
      activeCashier: formData.activeCashier,
      receiptFooter: formData.receiptFooter,
      soundEnabled: formData.soundEnabled,
    });

    soundManager.playSuccess();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-y-auto bg-slate-950 p-4 sm:p-6 space-y-5">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-emerald-400" />
              Minimart POS Configuration
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Customize store information, taxation rate, hardware sound effects, and receipt details.
            </p>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Settings Saved!</span>
            </div>
          )}
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-5">
          {/* Section: Store Profile */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Store className="w-4 h-4 text-emerald-400" />
              Store Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tagline</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Address</label>
                <input
                  type="text"
                  value={formData.storeAddress}
                  onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.storePhone}
                  onChange={(e) => setFormData({ ...formData, storePhone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section: Tax, Currency & Cashier */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Tax, Currency & Register
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Currency Symbol</label>
                <select
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:border-emerald-500"
                >
                  <option value="$">$ (USD / CAD / AUD / SGD)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="£">£ (GBP)</option>
                  <option value="¥">¥ (JPY / CNY)</option>
                  <option value="₹">₹ (INR)</option>
                  <option value="฿">฿ (THB)</option>
                  <option value="RM">RM (MYR)</option>
                  <option value="₱">₱ (PHP)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Sales Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={formData.taxRatePercent}
                  onChange={(e) => setFormData({ ...formData, taxRatePercent: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl font-mono focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Active Cashier Name
                </label>
                <input
                  type="text"
                  value={formData.activeCashier}
                  onChange={(e) => setFormData({ ...formData, activeCashier: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Sound Toggle */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-xs font-semibold text-slate-200">
                    Scanner & Cashier Sound Effects
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Plays simulated scanner beeps, card chimes, and drawer opening clangs
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.soundEnabled}
                onChange={(e) => setFormData({ ...formData, soundEnabled: e.target.checked })}
                className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700 cursor-pointer"
              />
            </div>
          </div>

          {/* Section: Receipt Printing */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Receipt Customization
            </h3>

            <div className="text-xs">
              <label className="block text-slate-300 font-semibold mb-1">
                Receipt Footer Message
              </label>
              <textarea
                rows={2}
                value={formData.receiptFooter}
                onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={resetToSampleData}
              className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2 border border-rose-500/20 transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset to Default Minimart Catalog</span>
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

