/**
 * Hedera Wallet Info Modal
 * Explains why a Hedera wallet is required for payment
 */

'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface HederaWalletInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HederaWalletInfoModal({ isOpen, onClose }: HederaWalletInfoModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content */}
          <div className="pr-8">
            <h2
              id="modal-title"
              className="text-xl font-semibold text-slate-900 mb-4"
            >
              Why a Hedera wallet is required
            </h2>
            
            <p className="text-slate-600 leading-relaxed">
              This payment uses the Hedera network. Tokens like USDC, USDT, and AUDD 
              exist on multiple blockchains. Only tokens issued on Hedera can be used here.
            </p>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}







