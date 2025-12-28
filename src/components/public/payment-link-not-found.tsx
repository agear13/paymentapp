/**
 * Payment Link Not Found Component
 * 404 state for invalid short codes
 */

'use client';

import { FileQuestion, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentLinkNotFoundProps {
  shortCode: string;
}

export const PaymentLinkNotFound: React.FC<PaymentLinkNotFoundProps> = ({
  shortCode,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="pt-12 pb-8 text-center">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <FileQuestion className="w-8 h-8 text-slate-400" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Payment Link Not Found
          </h1>

          <p className="text-slate-600 mb-6 leading-relaxed">
            The payment link you're looking for doesn't exist or may have been removed.
          </p>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-500 mb-1">Short Code</p>
            <code className="text-lg font-mono font-semibold text-slate-900">
              {shortCode}
            </code>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Please check the link and try again, or contact the merchant who sent you this link.
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













