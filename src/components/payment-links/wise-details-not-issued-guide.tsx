'use client';

import Link from 'next/link';
import { Building2, Info, Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { COLLECTION_SETTLEMENT_SETTINGS_HREF } from '@/lib/navigation/payment-routes';

type WiseDetailsNotIssuedGuideProps = {
  /** Currency used for Wise receiving-account lookups. */
  currency: string;
  wiseProfileId?: string | null;
  configuredWiseCurrency?: string | null;
  onRecheck?: () => void;
  isRechecking?: boolean;
  onDismiss?: () => void;
};

export function WiseDetailsNotIssuedGuide({
  currency,
  wiseProfileId,
  configuredWiseCurrency,
  onRecheck,
  isRechecking = false,
  onDismiss,
}: WiseDetailsNotIssuedGuideProps) {
  const displayCurrency = currency.trim().toUpperCase() || 'AUD';
  const configuredCurrencyDisplay = configuredWiseCurrency?.trim().toUpperCase() || null;

  return (
    <div className="space-y-4">
      <Alert className="border-amber-200 bg-amber-50 text-amber-950">
        <Building2 className="h-4 w-4 text-amber-700" />
        <AlertTitle className="text-amber-950">
          Your Wise {displayCurrency} receiving account hasn&apos;t been activated yet
        </AlertTitle>
        <AlertDescription className="text-amber-900/90 space-y-3">
          <p>
            Before you can accept Wise payments, Wise needs to issue your receiving bank account
            details for {displayCurrency}.
          </p>

          <div className="rounded-md border border-amber-200/80 bg-white/60 px-3 py-2.5 text-sm">
            <p className="font-medium text-amber-950 mb-1.5">Your Provvypay Wise configuration</p>
            <dl className="space-y-1">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-amber-900/80">Profile ID:</dt>
                <dd className="font-mono text-amber-950">
                  {wiseProfileId?.trim() || 'Not configured'}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-amber-900/80">Configured currency:</dt>
                <dd className="font-medium text-amber-950">
                  {configuredCurrencyDisplay ?? (
                    <>
                      Not set{' '}
                      <span className="font-normal text-amber-900/80">
                        (invoice currency {displayCurrency} is used for Wise lookups)
                      </span>
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <p className="font-medium text-amber-950 mb-2">To complete setup:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm">
              <li>Log in to your Wise Business account.</li>
              <li>Go to Balances.</li>
              <li>Select {displayCurrency}.</li>
              <li>
                Click <span className="font-medium">Generate</span> or{' '}
                <span className="font-medium">Get receiving account details</span> (if prompted).
              </li>
              <li>
                Once your {displayCurrency} receiving account is active, return here and click{' '}
                <span className="font-medium">Re-check Wise Account</span> to continue creating this
                invoice.
              </li>
            </ol>
          </div>
          <p className="text-sm">
            You can also verify your Wise Profile ID and currency settings under{' '}
            <span className="font-medium">Collection &amp; Settlement → Wise</span>.
          </p>
        </AlertDescription>
      </Alert>

      <Card className="border-slate-200 bg-slate-50/80">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 shrink-0 text-slate-500 mt-0.5" />
            <div className="space-y-1 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Why am I seeing this?</p>
              <p>
                Provvypay retrieves your Wise receiving account details automatically when generating
                a Wise payment request. Wise has indicated that your {displayCurrency} receiving
                account hasn&apos;t been issued yet, so there are no bank details available to display
                on the invoice.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {onRecheck ? (
          <Button type="button" onClick={onRecheck} disabled={isRechecking}>
            {isRechecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking Wise account…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-check Wise Account
              </>
            )}
          </Button>
        ) : null}
        <Button asChild variant={onRecheck ? 'outline' : 'default'}>
          <Link href={COLLECTION_SETTLEMENT_SETTINGS_HREF}>Open Collection &amp; Settlement</Link>
        </Button>
        {onDismiss ? (
          <Button type="button" variant="outline" onClick={onDismiss} disabled={isRechecking}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
