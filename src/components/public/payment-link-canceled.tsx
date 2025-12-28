/**
 * Payment Link Canceled Component
 * Shown when payment link has been manually canceled
 */

'use client';

import { XCircle, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentLinkCanceledProps {
  paymentLink: {
    shortCode: string;
    description: string;
    amount: string;
    currency: string;
    merchant: {
      name: string;
    };
  };
}

export const PaymentLinkCanceled: React.FC<PaymentLinkCanceledProps> = ({
  paymentLink,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="pt-12 pb-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Payment Link Canceled
          </h1>

          <p className="text-slate-600 mb-6 leading-relaxed">
            This payment link has been canceled by the merchant and is no longer accepting payments.
          </p>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2">
              <div>
                <p className="text-xs text-slate-500 mb-1">Merchant</p>
                <p className="font-medium text-slate-900">{paymentLink.merchant.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700">{paymentLink.description}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Amount</p>
                <p className="text-lg font-semibold text-slate-900">
                  {paymentLink.currency} {paymentLink.amount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Questions about this cancellation?
                </p>
                <p className="text-xs text-blue-700">
                  Please contact {paymentLink.merchant.name} for more information or to request a new payment link.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t">
            <p className="text-xs text-slate-500">
              Powered by <span className="font-semibold">Provvypay</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};













