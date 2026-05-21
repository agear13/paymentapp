import Link from 'next/link';
import { ReferralCheckoutBranding } from '@/components/referrals/referral-checkout-branding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  merchantDisplayName: string;
  merchantLogoUrl?: string | null;
  title: string;
  message: string;
  showRetry?: boolean;
};

/** Customer-safe fallback when referral checkout cannot load. */
export function ReferralCheckoutUnavailable({
  merchantDisplayName,
  merchantLogoUrl,
  title,
  message,
  showRetry = true,
}: Props) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <ReferralCheckoutBranding
          displayName={merchantDisplayName}
          logoUrl={merchantLogoUrl}
        />
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              If you were sent this link by a partner, ask them to confirm the link is still active
              or contact the merchant directly.
            </p>
            {showRetry ? (
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Return home</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
