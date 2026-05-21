'use client';

import { ReferralCheckoutBranding } from '@/components/referrals/referral-checkout-branding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  merchantDisplayName: string;
  merchantLogoUrl?: string | null;
};

export function ReferralCheckoutNoPaymentMethods({
  merchantDisplayName,
  merchantLogoUrl,
}: Props) {
  return (
    <div className="min-h-screen bg-muted/30 p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <ReferralCheckoutBranding
          displayName={merchantDisplayName}
          logoUrl={merchantLogoUrl}
        />
        <Card>
          <CardHeader>
            <CardTitle>Checkout unavailable</CardTitle>
            <CardDescription>
              Payment methods are temporarily unavailable for this checkout. Please contact the
              merchant to complete your purchase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The merchant may still be setting up card, bank transfer, or other payment options.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
