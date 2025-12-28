/**
 * Payment Link Expired Component
 * Shown when payment link has passed expiry date
 */

'use client';

import { Clock, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

interface PaymentLinkExpiredProps {
  paymentLink: {
    shortCode: string;
    description: string;
    amount: string;
    currency: string;
    expiresAt: string | null;
    merchant: {
      name: string;
    };
  };
}

export const PaymentLinkExpired: React.FC<PaymentLinkExpiredProps> = ({
  paymentLink,
}) => {
  const expiredTime = paymentLink.expiresAt
    ? formatDistanceToNow(new Date(paymentLink.expiresAt), { addSuffix: true })
    : 'Unknown';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="pt-12 pb-8 text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Payment Link Expired
          </h1>

          <p className="text-slate-600 mb-6 leading-relaxed">
            This payment link expired {expiredTime} and is no longer accepting payments.
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
                  Need a new payment link?
                </p>
                <p className="text-xs text-blue-700">
                  Please contact {paymentLink.merchant.name} to request a new payment link.
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













