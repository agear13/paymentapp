/**
 * Stripe Payment Option Component
 * Card for selecting Stripe (fiat) payment method
 */

'use client';

import { useState } from 'react';
import { CreditCard, Check, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StripePaymentOptionProps {
  isAvailable: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  paymentLinkId: string;
  amount: string;
  currency: string;
}

export const StripePaymentOption: React.FC<StripePaymentOptionProps> = ({
  isAvailable,
  isSelected,
  isHovered,
  onSelect,
  onHoverStart,
  onHoverEnd,
  paymentLinkId,
  amount,
  currency,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    if (!isSelected || isProcessing) return;

    setIsProcessing(true);
    
    try {
      // Create Stripe Checkout Session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentLinkId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      toast.error(error.message || 'Failed to start payment process');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={isAvailable ? onSelect : undefined}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        disabled={!isAvailable}
        className={cn(
          'w-full text-left transition-all rounded-lg border-2 p-4',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          {
            'border-blue-600 bg-blue-50 shadow-md': isSelected,
            'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm': !isSelected && isAvailable,
            'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed': !isAvailable,
          }
        )}
        role="radio"
        aria-checked={isSelected}
        aria-disabled={!isAvailable}
        aria-label="Pay with credit or debit card via Stripe"
        tabIndex={isAvailable ? 0 : -1}
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-full transition-colors',
              {
                'bg-blue-600': isSelected,
                'bg-blue-100': !isSelected && isAvailable,
                'bg-slate-200': !isAvailable,
              }
            )}
          >
            <CreditCard
              className={cn('w-6 h-6', {
                'text-white': isSelected,
                'text-blue-600': !isSelected && isAvailable,
                'text-slate-400': !isAvailable,
              })}
            />
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-slate-900">
                Credit / Debit Card
              </h3>
              {isSelected && (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 mb-3">
              Pay securely with Visa, Mastercard, or American Express
            </p>

            {/* Features */}
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Lock className="w-3.5 h-3.5" />
                <span>Instant processing</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 1.459 0 2.196.576 2.196 1.305h2.289c0-1.787-1.333-3.199-3.484-3.611v-1.8h-2.289v1.8c-2.104.43-3.396 1.794-3.396 3.611 0 2.227 1.677 3.371 4.226 4.307 2.49.87 3.357 1.568 3.357 2.571 0 .835-.617 1.389-1.901 1.389-1.459 0-2.196-.576-2.196-1.389h-2.289c0 1.787 1.333 3.199 3.484 3.611v1.8h2.289v-1.8c2.104-.43 3.396-1.794 3.396-3.611 0-2.404-1.677-3.549-4.226-4.468z"/>
                </svg>
                <span>All major currencies</span>
              </div>
            </div>

            {!isAvailable && (
              <p className="text-xs text-amber-600 mt-3 font-medium">
                Card payments not available from this merchant
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Pay Now Button */}
      {isSelected && isAvailable && (
        <Button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Redirecting to Stripe...
            </>
          ) : (
            <>
              <Lock className="w-5 h-5 mr-2" />
              Pay {currency} {amount}
            </>
          )}
        </Button>
      )}
    </div>
  );
};
