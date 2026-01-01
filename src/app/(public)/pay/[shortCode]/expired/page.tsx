/**
 * Payment Link Expired Page
 * Displayed when payment link has expired
 */

'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PaymentExpiredPage() {
  const params = useParams();
  const shortCode = params.shortCode as string;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <Card className="p-8 max-w-lg w-full">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Expired Icon */}
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
            <Clock className="w-12 h-12 text-amber-600" />
          </div>

          {/* Expired Message */}
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Payment Link Expired
            </h1>
            <p className="text-slate-600">
              This payment link has passed its expiration date and is no longer accepting payments.
            </p>
          </div>

          {/* Information */}
          <div className="w-full bg-slate-50 rounded-lg p-6 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm text-slate-700 mb-2">
                  <strong>What happens next?</strong>
                </p>
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                  <li>This link can no longer be used for payment</li>
                  <li>Contact the merchant for a new payment link</li>
                  <li>The merchant can create a fresh link for you</li>
                  <li>No charges were made to your account</li>
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
                View Link Details
              </Link>
            </Button>
          </div>

          {/* Help Text */}
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Need help?</strong> Please contact the merchant who sent you this 
              payment link to request a new one with an updated expiration date.
            </p>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-slate-500 mt-4">
            Payment Link: <span className="font-mono">{shortCode}</span>
          </p>
        </div>
      </Card>
    </div>
  );
}

