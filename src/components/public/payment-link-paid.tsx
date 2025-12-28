/**
 * Payment Link Paid Component
 * Shown when payment has already been completed
 */

'use client';

import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface PaymentLinkPaidProps {
  paymentLink: {
    shortCode: string;
    description: string;
    amount: string;
    currency: string;
    merchant: {
      name: string;
    };
    lastEvent?: {
      createdAt: string;
      paymentMethod?: string;
    };
  };
}

export const PaymentLinkPaid: React.FC<PaymentLinkPaidProps> = ({
  paymentLink,
}) => {
  const paymentDate = paymentLink.lastEvent?.createdAt
    ? format(new Date(paymentLink.lastEvent.createdAt), 'PPp')
    : 'Unknown';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="pt-12 pb-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Payment Completed
          </h1>

          <p className="text-slate-600 mb-6 leading-relaxed">
            This payment has already been successfully processed.
          </p>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Merchant</p>
                <p className="font-medium text-slate-900">{paymentLink.merchant.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700">{paymentLink.description}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Amount Paid</p>
                <p className="text-lg font-semibold text-green-600">
                  {paymentLink.currency} {paymentLink.amount}
                </p>
              </div>
              {paymentLink.lastEvent && (
                <>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Payment Date</p>
                    <p className="text-sm text-slate-700">{paymentDate}</p>
                  </div>
                  {paymentLink.lastEvent.paymentMethod && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Payment Method</p>
                      <p className="text-sm text-slate-700 capitalize">
                        {paymentLink.lastEvent.paymentMethod.toLowerCase()}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-800">
              <span className="font-medium">Thank you!</span> Your payment has been received and is being processed.
            </p>
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













