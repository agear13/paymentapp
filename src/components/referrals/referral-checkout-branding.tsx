'use client';

import { MerchantBranding } from '@/components/public/merchant-branding';

type Props = {
  displayName: string;
  logoUrl?: string | null;
  className?: string;
};

/** Branded header for referral / customer checkout pages. */
export function ReferralCheckoutBranding({ displayName, logoUrl, className }: Props) {
  return (
    <div className={className}>
      <MerchantBranding merchantName={displayName} logoUrl={logoUrl} />
      <p className="text-center text-xs text-muted-foreground -mt-1">
        Secure checkout powered by Provvypay
      </p>
    </div>
  );
}
