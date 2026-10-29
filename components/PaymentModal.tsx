'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { PaymentMethod } from '@/types/pos';
import { soundManager } from '@/lib/sound';
import { toast } from '@/context/ToastContext';
import {
  X,
  Banknote,
  CreditCard,
  QrCode,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Sparkles,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
  const { cartTotal, settings, processPayment, formatPrice } = usePOS();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [tenderedStr, setTenderedStr] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardState, setCardState] = useState<'idle' | 'tapping' | 'approved'>('idle');
  const [qrState, setQrState] = useState<'waiting' | 'scanned'>('waiting');

  // Initialize tendered with exact total or round up
  useEffect(() => {
    if (isOpen) {
      setTenderedStr(cartTotal.toFixed(2));
      setPaymentMethod('CASH');
      setIsProcessing(false);
      setCardState('idle');
      setQrState('waiting');
    }
  }, [isOpen, cartTotal]);

  if (!isOpen) return null;

  const tenderedAmount = parseFloat(tenderedStr) || 0;
  const changeDue = Math.max(0, tenderedAmount - cartTotal);
  const isCashInsufficient = paymentMethod === 'CASH' && tenderedAmount < cartTotal;

  // Sri Lankan Rupee denominations: Rs. 100, 500, 1000, 2000, 5000
  const commonDenominations = [100, 500, 1000, 2000, 5000];
  const nextRoundUp = Math.ceil(cartTotal / 100) * 100;

  const handleQuickCash = (amount: number) => {
    soundManager.playClick();
    setTenderedStr(amount.toFixed(2));
  };

  const handleExecutePayment = async () => {
    if (isCashInsufficient) {
      soundManager.playError();
      toast.error(
        `Tendered cash is less than total due (${formatPrice(cartTotal)}).`,
        'Insufficient Cash'
      );
      return;
    }

    setIsProcessing(true);

    if (paymentMethod === 'CARD') {
      setCardState('tapping');
      await new Promise((r) => setTimeout(r, 1000));
      setCardState('approved');
      await new Promise((r) => setTimeout(r, 600));
    } else if (paymentMethod === 'QR') {
      setQrState('scanned');
      await new Promise((r) => setTimeout(r, 800));
    }

    processPayment(paymentMethod, tenderedAmount);
    toast.success(
      `Received ${formatPrice(cartTotal)} via ${paymentMethod}`,
      'Payment Complete'
    );
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Checkout & Payment
            </h2>
            <p className="text-xs text-slate-400">Select payment method to complete the sale</p>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Banner */}
        <div className="bg-slate-950/60 p-4 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Amount Due
          </span>
          <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
            {formatPrice(cartTotal)}
          </span>
        </div>

        {/* Payment Methods Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-slate-900 border-b border-slate-800">
          <button
            onClick={() => {
              soundManager.playClick();
              setPaymentMethod('CASH');
            }}
            className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 font-bold text-xs transition border ${
              paymentMethod === 'CASH'
                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Banknote className="w-5 h-5" />
            <span>Cash</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setPaymentMethod('CARD');
            }}
            className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 font-bold text-xs transition border ${
              paymentMethod === 'CARD'
                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span>Credit/Debit Card</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setPaymentMethod('QR');
            }}
            className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 font-bold text-xs transition border ${
              paymentMethod === 'QR'
                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-5 h-5" />
            <span>QR / Mobile Pay</span>
          </button>
        </div>

        {/* Method Details Body */}
        <div className="p-6 flex-1 min-h-[220px] flex flex-col justify-center">
          {paymentMethod === 'CASH' && (
            <div className="space-y-4">
              {/* Cash Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cash Tendered ({settings.currencySymbol})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400 font-mono font-bold text-lg">
                    {settings.currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tenderedStr}
                    onChange={(e) => setTenderedStr(e.target.value)}
                    className="w-full bg-slate-950 text-white pl-16 pr-4 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 text-xl font-mono font-bold"
                  />
                </div>
              </div>

              {/* Quick denomination pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCash(cartTotal)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition"
                >
                  Exact ({formatPrice(cartTotal)})
                </button>
                {nextRoundUp > cartTotal && (
                  <button
                    type="button"
                    onClick={() => handleQuickCash(nextRoundUp)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
                  >
                    Round Up ({formatPrice(nextRoundUp)})
                  </button>
                )}
                {commonDenominations.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickCash(val)}
                    className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold border border-slate-700 transition"
                  >
                    {formatPrice(val)}
                  </button>
                ))}
              </div>

              {/* Change calculation display */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isCashInsufficient
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isCashInsufficient ? (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  )}
                  <div>
                    <span className="font-bold text-xs uppercase tracking-wide">
                      {isCashInsufficient ? 'Amount Short' : 'Change Due to Customer'}
                    </span>
                    <p className="text-[11px] opacity-80">
                      {isCashInsufficient
                        ? 'Customer needs to provide more cash'
                        : 'Cash drawer will open upon confirmation'}
                    </p>
                  </div>
                </div>

                <span className="text-2xl font-black font-mono">
                  {formatPrice(
                    isCashInsufficient
                      ? cartTotal - tenderedAmount
                      : changeDue
                  )}
                </span>
              </div>
            </div>
          )}

          {paymentMethod === 'CARD' && (
            <div className="text-center py-4 flex flex-col items-center justify-center space-y-3">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all ${
                  cardState === 'approved'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : cardState === 'tapping'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {cardState === 'approved' ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <Wifi className="w-8 h-8 rotate-90" />
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-100 text-base">
                  {cardState === 'approved'
                    ? 'Payment Authorized!'
                    : cardState === 'tapping'
                    ? 'Authorizing Card...'
                    : 'Simulate Customer Tap / Insert'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {cardState === 'approved'
                    ? 'Transaction approved via EMV Contactless Terminal.'
                    : 'Ready for VISA, Mastercard, Amex, Apple Pay, or Google Wallet.'}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <span className="px-2.5 py-1 rounded bg-slate-800 text-[11px] font-bold text-slate-300 border border-slate-700">
                  VISA
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-[11px] font-bold text-slate-300 border border-slate-700">
                  Mastercard
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-[11px] font-bold text-emerald-400 border border-emerald-700/50">
                  LankaPay
                </span>
              </div>
            </div>
          )}

          {paymentMethod === 'QR' && (
            <div className="text-center py-2 flex flex-col items-center justify-center space-y-3">
              {/* Mock dynamic QR code */}
              <div className="p-3 bg-white rounded-xl shadow-lg inline-block border-2 border-emerald-500">
                <div className="w-32 h-32 bg-slate-900 rounded-lg p-2 flex flex-col items-center justify-center text-emerald-400 relative">
                  <QrCode className="w-20 h-20 text-white" />
                  <span className="text-[9px] font-mono text-emerald-400 font-bold mt-1">
                    LANKAQR &bull; {formatPrice(cartTotal)}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-100 text-sm">
                  {qrState === 'scanned' ? 'LANKAQR Scanned!' : 'Scan with Any Sri Lankan Banking App'}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Supports LANKAQR, Dialog genie, FriMi, Flash, ComBank Q+, HNB SOLO & Seylan Pay
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-semibold text-xs transition"
          >
            Cancel (Esc)
          </button>

          <button
            onClick={handleExecutePayment}
            disabled={isProcessing || isCashInsufficient}
            className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
              isCashInsufficient || isProcessing
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 cursor-pointer active:scale-[0.99]'
            }`}
          >
            {isProcessing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                <span>Processing Transaction...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Confirm Payment ({formatPrice(cartTotal)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

