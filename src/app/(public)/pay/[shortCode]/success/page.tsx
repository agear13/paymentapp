/**
 * Payment Success Page
 * Displayed after successful Stripe Checkout
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

export default function PaymentSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shortCode = params.shortCode as string;
  const sessionId = searchParams.get('session_id');
  
  const [paymentData, setPaymentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        const response = await fetch(`/api/public/pay/${shortCode}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch payment data');
        }

        const result = await response.json();
        setPaymentData(result.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (shortCode) {
      fetchPaymentData();
    }
  }, [shortCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
        <Card className="p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <Spinner className="w-8 h-8" />
            <p className="text-slate-600">Loading payment details...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-50">
        <Card className="p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Error</h1>
            <p className="text-slate-600">{error}</p>
            <Button asChild variant="outline">
              <Link href={`/pay/${shortCode}`}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <Card className="p-8 max-w-lg w-full">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>

          {/* Success Message */}
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Payment Successful!
            </h1>
            <p className="text-slate-600">
              Your payment has been processed successfully.
            </p>
          </div>

          {/* Payment Details */}
          {paymentData && (
            <div className="w-full bg-slate-50 rounded-lg p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Amount Paid</span>
                <span className="text-lg font-semibold text-slate-900">
                  {paymentData.currency} {paymentData.amount}
                </span>
              </div>

              {paymentData.invoiceReference && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Invoice Reference</span>
                  <span className="text-sm font-medium text-slate-900">
                    {paymentData.invoiceReference}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Payment ID</span>
                <span className="text-sm font-mono text-slate-900">
                  {shortCode}
                </span>
              </div>

              {sessionId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Session ID</span>
                  <span className="text-xs font-mono text-slate-600 truncate max-w-[200px]">
                    {sessionId}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Merchant</span>
                <span className="text-sm font-medium text-slate-900">
                  {paymentData.merchant?.name}
                </span>
              </div>
            </div>
          )}

          {/* Information */}
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              A receipt has been sent to your email address. Please keep this for your records.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return Home
              </Link>
            </Button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-slate-500 mt-4">
            If you have any questions about this payment, please contact the merchant directly.
          </p>
        </div>
      </Card>
    </div>
  );
}













