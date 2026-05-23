'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ReferralPayPageClient } from '@/components/referrals/referral-pay-page-client';
import { ReferralCheckoutBranding } from '@/components/referrals/referral-checkout-branding';
import { ReferralPaymentMethodDialog } from '@/components/referrals/referral-payment-method-dialog';
import { formatCurrency } from '@/lib/formatters/format-currency';
import type { ReferralPaymentRail } from '@/lib/referrals/referral-payment-rails';
import { customerRailLabel } from '@/lib/referrals/referral-payment-rails';

export type ReferralServiceRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
};

type PurchaseMode = 'catalog' | 'custom';

interface Props {
  referralCode: string;
  checkoutConfig?: Record<string, unknown> | null;
  services: ReferralServiceRow[];
  merchantDisplayName: string;
  merchantLogoUrl?: string | null;
  paymentRails: ReferralPaymentRail[];
  allowCustomAmount?: boolean;
}

export function ReferralCommissionLanding({
  referralCode,
  checkoutConfig,
  services,
  merchantDisplayName,
  merchantLogoUrl,
  paymentRails,
  allowCustomAmount = true,
}: Props) {
  const hasCatalog = services.length > 0;
  const hasBothOptions = hasCatalog && allowCustomAmount;
  const defaultMode: PurchaseMode = hasCatalog ? 'catalog' : 'custom';

  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>(defaultMode);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [methodDialogOpen, setMethodDialogOpen] = useState(false);

  const startCheckout = async (serviceId: string, rail: ReferralPaymentRail) => {
    setError('');
    setLoadingId(serviceId);
    try {
      const res = await fetch(`/api/referral/${referralCode}/service-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationServiceId: serviceId,
          paymentRail: rail,
        }),
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
      setPendingServiceId(null);
      setMethodDialogOpen(false);
    }
  };

  const onServiceCheckout = (serviceId: string) => {
    if (paymentRails.length === 0) return;
    if (paymentRails.length === 1) {
      void startCheckout(serviceId, paymentRails[0]);
      return;
    }
    setPendingServiceId(serviceId);
    setMethodDialogOpen(true);
  };

  const checkoutCta =
    paymentRails.length === 1
      ? `Pay with ${customerRailLabel(paymentRails[0]).toLowerCase()}`
      : 'Continue to checkout';

  if (paymentRails.length === 0) {
    return null;
  }

  const showCatalog = hasBothOptions ? purchaseMode === 'catalog' : hasCatalog;
  const showCustom = hasBothOptions ? purchaseMode === 'custom' : allowCustomAmount && !hasCatalog;

  return (
    <div className="min-h-screen bg-muted/30 p-4 pb-12">
      <div className="max-w-3xl mx-auto space-y-10">
        <ReferralCheckoutBranding
          displayName={merchantDisplayName}
          logoUrl={merchantLogoUrl}
          className="pt-6"
        />

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 text-destructive px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}

        {hasBothOptions ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Choose purchase type</h2>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="purchase-mode"
                  checked={purchaseMode === 'custom'}
                  onChange={() => setPurchaseMode('custom')}
                />
                Pay custom amount
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="purchase-mode"
                  checked={purchaseMode === 'catalog'}
                  onChange={() => setPurchaseMode('catalog')}
                />
                Select service/product
              </label>
            </div>
          </section>
        ) : null}

        {showCatalog ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Select service/product</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose what you would like to purchase. Prices are shown in the merchant currency.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {services.map((s) => (
                <Card key={s.id} className="flex flex-col border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg leading-snug">{s.name}</CardTitle>
                    <CardDescription className="line-clamp-3 min-h-[2.5rem]">
                      {s.description?.trim() || 'Service provided by the merchant.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0 space-y-3">
                    <p className="text-xl font-semibold tabular-nums">
                      {formatCurrency(s.price, s.currency)}
                    </p>
                    <Button
                      className="w-full"
                      disabled={!!loadingId}
                      onClick={() => onServiceCheckout(s.id)}
                    >
                      {loadingId === s.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Starting checkout…
                        </>
                      ) : (
                        checkoutCta
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {showCustom ? (
          <section className={`space-y-4 ${showCatalog ? 'border-t pt-10' : ''}`}>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {hasBothOptions ? 'Pay custom amount' : 'Complete your payment'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter an amount if you are paying outside a listed service.
              </p>
            </div>
            <div className="max-w-md">
              <ReferralPayPageClient
                referralCode={referralCode}
                checkoutConfig={checkoutConfig}
                embedded
                paymentRails={paymentRails}
              />
            </div>
          </section>
        ) : null}
      </div>

      <ReferralPaymentMethodDialog
        open={methodDialogOpen}
        onOpenChange={setMethodDialogOpen}
        rails={paymentRails}
        loading={!!loadingId}
        onSelect={(rail) => {
          if (pendingServiceId) void startCheckout(pendingServiceId, rail);
        }}
      />
    </div>
  );
}
