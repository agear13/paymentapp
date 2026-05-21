'use client';

import * as React from 'react';
import Link from 'next/link';
import { useOrganization } from '@/hooks/use-organization';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { formatPayoutCurrency } from '@/lib/payouts/format-payout-currency';
import {
  computePayoutAttentionSummary,
  formatRelativeTime,
} from '@/lib/payouts/payout-attention-summary';
import {
  PAYOUTS_COMMISSIONS_HREF,
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';
import { cn } from '@/lib/utils';

function InlineSegment({
  href,
  children,
  tone,
}: {
  href: string;
  children: React.ReactNode;
  tone?: 'warning' | 'success' | 'neutral';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'underline-offset-2 hover:underline transition-colors',
        tone === 'warning' && 'text-amber-800 dark:text-amber-300',
        tone === 'success' && 'text-emerald-800 dark:text-emerald-300',
        tone === 'neutral' && 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </Link>
  );
}

function Separator() {
  return <span className="text-muted-foreground/30 mx-1.5 select-none" aria-hidden>·</span>;
}

export function PayoutsNeedsAttentionStrip() {
  const { organizationId } = useOrganization();
  const { currency: orgCurrency } = useOrganizationCurrency();
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState(computePayoutAttentionSummary([]));
  const [lastReleaseAt, setLastReleaseAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const [obligationsRes, batchesRes] = await Promise.all([
          fetch('/api/deal-network-pilot/obligations', { credentials: 'include' }),
          organizationId
            ? fetch(`/api/payout-batches?organizationId=${organizationId}`)
            : Promise.resolve(null),
        ]);

        if (obligationsRes.ok) {
          const json = (await obligationsRes.json()) as { data: unknown[] };
          const rows = Array.isArray(json.data) ? json.data : [];
          if (!cancelled) {
            setSummary(
              computePayoutAttentionSummary(
                rows as Parameters<typeof computePayoutAttentionSummary>[0]
              )
            );
          }
        }

        if (batchesRes?.ok) {
          const batchJson = (await batchesRes.json()) as {
            data?: Array<{ createdAt: string }>;
          };
          const batches = batchJson.data ?? [];
          if (!cancelled) {
            if (batches.length === 0) {
              setLastReleaseAt(null);
            } else {
              const latest = [...batches].sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )[0];
              setLastReleaseAt(latest?.createdAt ?? null);
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const fundingLabel =
    summary.unfundedCount === 1
      ? '1 needs funding'
      : `${summary.unfundedCount} need funding`;
  const onboardingLabel =
    summary.awaitingOnboardingCount === 1
      ? '1 awaiting onboarding'
      : `${summary.awaitingOnboardingCount} awaiting onboarding`;
  const readyLabel =
    summary.readyForReleaseCount === 1
      ? '1 ready for release'
      : `${summary.readyForReleaseCount} ready for release`;
  const lastReleaseLabel = loading
    ? '…'
    : lastReleaseAt
      ? `Last payout release ${formatRelativeTime(lastReleaseAt)}`
      : 'No payout releases yet';

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Needs attention</p>
      <p className="text-sm leading-relaxed text-foreground/90">
        {loading ? (
          <span className="text-muted-foreground">Loading…</span>
        ) : (
          <>
            <InlineSegment
              href={`${PAYOUTS_OBLIGATIONS_HREF}?needsAction=1&focus=unfunded`}
              tone={summary.unfundedCount > 0 ? 'warning' : 'neutral'}
            >
              {fundingLabel}
            </InlineSegment>
            <Separator />
            <InlineSegment
              href={`${PAYOUTS_COMMISSIONS_HREF}#awaiting-onboarding`}
              tone={summary.awaitingOnboardingCount > 0 ? 'warning' : 'neutral'}
            >
              {onboardingLabel}
            </InlineSegment>
            <Separator />
            <InlineSegment
              href={`${PAYOUTS_OBLIGATIONS_HREF}?status=AVAILABLE_FOR_PAYOUT`}
              tone={summary.readyForReleaseCount > 0 ? 'success' : 'neutral'}
            >
              {readyLabel}
              {summary.readyForReleaseCount > 0 && summary.primaryCurrency ? (
                <span className="text-muted-foreground font-normal">
                  {' '}
                  (
                  {formatPayoutCurrency(
                    summary.readyForReleaseAmount,
                    summary.primaryCurrency,
                    orgCurrency
                  )}
                  )
                </span>
              ) : null}
            </InlineSegment>
            <Separator />
            <InlineSegment href={PAYOUTS_SETTLEMENTS_HREF} tone="neutral">
              {lastReleaseLabel}
            </InlineSegment>
          </>
        )}
      </p>
    </div>
  );
}
