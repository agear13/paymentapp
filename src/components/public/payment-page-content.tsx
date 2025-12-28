/**
 * Payment Page Content Component
 * Main payment interface with method selection
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PaymentAmountDisplay } from '@/components/public/payment-amount-display';
import { MerchantBranding } from '@/components/public/merchant-branding';
import { PaymentMethodSelector } from '@/components/public/payment-method-selector';
import { PaymentProgressIndicator } from '@/components/public/payment-progress-indicator';
import { Shield, Lock } from 'lucide-react';

interface PaymentPageContentProps {
  paymentLink: {
    id: string;
    shortCode: string;
    amount: string;
    currency: string;
    description: string;
    invoiceReference: string | null;
    expiresAt: string | null;
    merchant: {
      name: string;
    };
    availablePaymentMethods: {
      stripe: boolean;
      hedera: boolean;
    };
  };
  onPaymentStarted?: () => void;
}

type PaymentStep = 'select_method' | 'processing' | 'complete';

export const PaymentPageContent: React.FC<PaymentPageContentProps> = ({
  paymentLink,
  onPaymentStarted,
}) => {
  const [currentStep, setCurrentStep] = useState<PaymentStep>('select_method');
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'hedera' | null>(null);

  const handleMethodSelect = (method: 'stripe' | 'hedera') => {
    setSelectedMethod(method);
    // Notify that payment has started
    onPaymentStarted?.();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <PaymentProgressIndicator currentStep={currentStep} />
        </div>

        {/* Main Payment Card */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="border-b bg-slate-50/50 pb-6">
            <MerchantBranding merchantName={paymentLink.merchant.name} />
          </CardHeader>

          <CardContent className="pt-8 pb-8">
            {/* Amount Display */}
            <div className="mb-8">
              <PaymentAmountDisplay
                amount={paymentLink.amount}
                currency={paymentLink.currency}
                description={paymentLink.description}
                invoiceReference={paymentLink.invoiceReference}
              />
            </div>

            {/* Payment Method Selection */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Choose Payment Method
              </h2>
              <PaymentMethodSelector
                availablePaymentMethods={paymentLink.availablePaymentMethods}
                selectedMethod={selectedMethod}
                onSelectMethod={handleMethodSelect}
                paymentLinkId={paymentLink.id}
                shortCode={paymentLink.shortCode}
                amount={paymentLink.amount}
                currency={paymentLink.currency}
              />
            </div>

            {/* Security Badge */}
            <div className="mt-8 pt-6 border-t">
              <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Secure Payment</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>PCI Compliant</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Powered by <span className="font-semibold">Provvypay</span>
          </p>
          {paymentLink.expiresAt && (
            <p className="text-xs text-slate-400 mt-1">
              This payment link expires on{' '}
              {new Date(paymentLink.expiresAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};







