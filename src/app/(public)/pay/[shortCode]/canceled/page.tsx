/**
 * Payment Canceled Page
 * Displayed when user cancels Stripe Checkout
 */

'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PaymentCanceledPage() {
  const params = useParams();
  const shortCode = params.shortCode as string;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <Card className="p-8 max-w-lg w-full">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Canceled Icon */}
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
            <XCircle className="w-12 h-12 text-amber-600" />
          </div>

          {/* Canceled Message */}
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Payment Canceled
            </h1>
            <p className="text-slate-600">
              You have canceled the payment process. No charges have been made.
            </p>
          </div>

          {/* Information */}
          <div className="w-full bg-slate-50 rounded-lg p-6 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-blue-600">ℹ️</span>
              </div>
              <div className="text-left">
                <p className="text-sm text-slate-700 mb-2">
                  <strong>What happens next?</strong>
                </p>
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                  <li>Your payment was not processed</li>
                  <li>No funds have been charged</li>
                  <li>The payment link is still active</li>
                  <li>You can try again at any time</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href={`/pay/${shortCode}`}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Link>
            </Button>
          </div>

          {/* Help Text */}
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Need help?</strong> If you encountered any issues during checkout, 
              please contact the merchant or try a different payment method.
            </p>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-slate-500 mt-4">
            Payment ID: <span className="font-mono">{shortCode}</span>
          </p>
        </div>
      </Card>
    </div>
  );
}













