'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Package } from 'lucide-react';
import { ReferralPayPageClient } from '@/components/referrals/referral-pay-page-client';

export type ReferralServiceRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
};

interface Props {
  referralCode: string;
  checkoutConfig?: Record<string, unknown> | null;
  services: ReferralServiceRow[];
}

export function ReferralCommissionLanding({ referralCode, checkoutConfig, services }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pickService = async (serviceId: string) => {
    setError('');
    setLoadingId(serviceId);
    try {
      const res = await fetch(`/api/referral/${referralCode}/service-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationServiceId: serviceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Checkout failed');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError('No checkout URL returned');
    } catch {
      setError('Network error');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Choose a service</h1>
          <p className="text-gray-600 mt-1">
            Referral <span className="font-mono">{referralCode}</span> — select a priced service to pay, or use a custom amount below.
          </p>
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {s.name}
                </CardTitle>
                <CardDescription className="line-clamp-3">{s.description || '—'}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <p className="text-xl font-semibold mb-3">
                  {s.price.toFixed(2)} {s.currency}
                </p>
                <Button
                  className="w-full"
                  disabled={!!loadingId}
                  onClick={() => pickService(s.id)}
                >
                  {loadingId === s.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Starting checkout…
                    </>
                  ) : (
                    'Pay with card'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto border-t border-gray-200 pt-8">
        <ReferralPayPageClient referralCode={referralCode} checkoutConfig={checkoutConfig} />
      </div>
    </div>
  );
}
