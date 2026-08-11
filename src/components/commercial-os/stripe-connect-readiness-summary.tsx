'use client';

import { useEffect, useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';

type StripeConnectReadinessProps = {
  className?: string;
};

/**
 * Lightweight Stripe Connect status — infrastructure only, not Provvy entitlement.
 */
export function StripeConnectReadinessSummary({ className }: StripeConnectReadinessProps) {
  const { organizationId } = useOrganization();
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setConnected(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/merchant-settings?organizationId=${encodeURIComponent(organizationId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          if (!cancelled) setConnected(false);
          return;
        }
        const rows = (await res.json()) as Array<{ stripe_account_id?: string | null }>;
        const stripeId = rows[0]?.stripe_account_id?.trim();
        if (!cancelled) setConnected(Boolean(stripeId));
      } catch {
        if (!cancelled) setConnected(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (connected === null) {
    return (
      <div className={`rounded-xl border border-border bg-secondary/30 p-4 text-[13px] text-ink-soft ${className ?? ''}`}>
        Checking Stripe connection…
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-secondary/30 p-4 ${className ?? ''}`}>
      <div className="flex items-center gap-2 text-[14px] font-semibold">
        <CreditCard className="h-4 w-4" />
        Your Stripe account
      </div>
      <div className="mt-2 flex items-center gap-2 text-[14px]">
        {connected ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Connected</span>
          </>
        ) : (
          <span className="text-ink-soft">Not connected</span>
        )}
      </div>
      <p className="mt-2 text-[13px] text-ink-soft leading-relaxed">
        {connected
          ? 'Stripe is ready to accept payments once your workspace has access to Payment Links.'
          : 'Connect Stripe in Payments & Settlement to collect card payments on invoices.'}
      </p>
    </div>
  );
}
