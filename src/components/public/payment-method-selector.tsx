/**
 * Payment Method Selector Component
 * Allows users to choose between Stripe (fiat) and Hedera (crypto) payments
 */

'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { StripePaymentOption } from '@/components/public/stripe-payment-option';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

// CRITICAL: Dynamic import with ssr: false to keep hashconnect out of server/shared bundles
// This is the isolation boundary - Hedera UI never SSR'd, never in server chunks
const HederaPaymentOption = dynamic(
  () => import('@/components/public/hedera-payment-option').then(mod => ({ default: mod.HederaPaymentOption })),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 border-2 border-slate-200 rounded-lg flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-600">Loading crypto payment option...</span>
      </div>
    ),
  }
);

interface PaymentMethodSelectorProps {
  availablePaymentMethods: {
    stripe: boolean;
    hedera: boolean;
  };
  selectedMethod: 'stripe' | 'hedera' | null;
  onSelectMethod: (method: 'stripe' | 'hedera') => void;
  paymentLinkId: string;
  shortCode: string;
  amount: string;
  currency: string;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  availablePaymentMethods,
  selectedMethod,
  onSelectMethod,
  paymentLinkId,
  shortCode,
  amount,
  currency,
}) => {
  const [hoveredMethod, setHoveredMethod] = useState<'stripe' | 'hedera' | null>(null);

  // Check if any payment methods are available
  const hasAnyMethod = availablePaymentMethods.stripe || availablePaymentMethods.hedera;

  if (!hasAnyMethod) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No payment methods are currently available. Please contact the merchant for assistance.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3" role="radiogroup" aria-label="Payment method selection">
      {/* Stripe Payment Option */}
      <StripePaymentOption
        isAvailable={availablePaymentMethods.stripe}
        isSelected={selectedMethod === 'stripe'}
        isHovered={hoveredMethod === 'stripe'}
        onSelect={() => onSelectMethod('stripe')}
        onHoverStart={() => setHoveredMethod('stripe')}
        onHoverEnd={() => setHoveredMethod(null)}
        paymentLinkId={paymentLinkId}
        amount={amount}
        currency={currency}
      />

      {/* Hedera Payment Option - Re-enabled with SSR disabled */}
      {availablePaymentMethods.hedera && (
        <HederaPaymentOption
          isAvailable={availablePaymentMethods.hedera}
          isSelected={selectedMethod === 'hedera'}
          isHovered={hoveredMethod === 'hedera'}
          onSelect={() => onSelectMethod('hedera')}
          onHoverStart={() => setHoveredMethod('hedera')}
          onHoverEnd={() => setHoveredMethod(null)}
          paymentLinkId={paymentLinkId}
          shortCode={shortCode}
          amount={amount}
          currency={currency}
        />
      )}

      {/* Payment Method Info */}
      {selectedMethod && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            {selectedMethod === 'stripe' && (
              <>
                <span className="font-medium">Stripe Payment:</span> Pay securely with your credit or debit card. Your payment will be processed instantly.
              </>
            )}
            {selectedMethod === 'hedera' && (
              <>
                <span className="font-medium">Crypto Payment:</span> Pay with HBAR, USDC, USDT, or AUDD on the Hedera network. Connect your wallet to continue.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
};







