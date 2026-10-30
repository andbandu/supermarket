'use client';

import React, { useState, useEffect } from 'react';
import { POSProvider, usePOS } from '@/context/POSContext';
import { ToastProvider } from '@/context/ToastContext';
import Navbar from '@/components/Navbar';
import POSView from '@/components/POSView';
import InventoryView from '@/components/InventoryView';
import BrandCategoryView from '@/components/BrandCategoryView';
import DiscountView from '@/components/DiscountView';
import HistoryView from '@/components/HistoryView';
import ShiftReportView from '@/components/ShiftReportView';
import SettingsView from '@/components/SettingsView';
import PaymentModal from '@/components/PaymentModal';
import ReceiptModal from '@/components/ReceiptModal';
import HeldOrdersModal from '@/components/HeldOrdersModal';

function POSMainApp() {
  const {
    activeTab,
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    lastCompletedOrder,
    setLastCompletedOrder,
    cart,
  } = usePOS();

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);

  // Automatically open Receipt modal when an order is completed
  useEffect(() => {
    if (lastCompletedOrder) {
      setIsReceiptModalOpen(true);
    }
  }, [lastCompletedOrder]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      // F2 or Space to checkout if on POS tab and cart has items
      if ((e.key === 'F2') && activeTab === 'pos' && cart.length > 0 && !isPaymentModalOpen) {
        e.preventDefault();
        setIsPaymentModalOpen(true);
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        if (isPaymentModalOpen) setIsPaymentModalOpen(false);
        if (isReceiptModalOpen) {
          setIsReceiptModalOpen(false);
          setLastCompletedOrder(null);
        }
        if (isHeldModalOpen) setIsHeldModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    cart.length,
    isPaymentModalOpen,
    isReceiptModalOpen,
    isHeldModalOpen,
    setIsPaymentModalOpen,
    setLastCompletedOrder,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header & Navbar */}
      <Navbar onOpenHeldOrders={() => setIsHeldModalOpen(true)} />

      {/* Main Views Container */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeTab === 'pos' && (
          <POSView onOpenHeldOrders={() => setIsHeldModalOpen(true)} />
        )}

        {activeTab === 'inventory' && <InventoryView />}

        {activeTab === 'catalog' && <BrandCategoryView />}

        {activeTab === 'discounts' && <DiscountView />}

        {activeTab === 'history' && (
          <HistoryView
            onViewReceipt={(order) => {
              setLastCompletedOrder(order);
              setIsReceiptModalOpen(true);
            }}
          />
        )}

        {activeTab === 'shift' && <ShiftReportView />}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Payment Processing Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />

      {/* Thermal Receipt Print Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setLastCompletedOrder(null);
        }}
      />

      {/* Held / Parked Carts Modal */}
      <HeldOrdersModal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <POSProvider>
        <POSMainApp />
      </POSProvider>
    </ToastProvider>
  );
}
