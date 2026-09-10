'use client';

import { PayoutRailComparison } from '@/components/payouts/payout-rail-comparison';
import { PayoutRailRecommendationCard } from '@/components/payouts/payout-rail-recommendation';
import { PayoutReviewSummary } from '@/components/payouts/payout-review-summary';
import { usePayoutRailReadiness } from '@/hooks/use-payout-rail-readiness';

type WorkspaceSettlementRailIntelligenceProps = {
  currency: string;
  recipient?: string | null;
  amount?: number | null;
};

/**
 * Workspace Settlement review panel. Reuses the canonical rail UX.
 * Destinations are resolved by POST /api/payout-batches/create, not here.
 */
export function WorkspaceSettlementRailIntelligence(
  props: WorkspaceSettlementRailIntelligenceProps
) {
  const readiness = usePayoutRailReadiness();

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-soft leading-relaxed">
        Based on destination, currency, availability and payout requirements, Provvy selects the
        most appropriate payment rail. Unconfigured rails stay visible as coming soon and cannot
        be executed. Manual is the fallback. Destinations come from each participant&apos;s saved
        payout method when the release is created.
      </p>
      <PayoutReviewSummary
        recipient={props.recipient}
        amount={props.amount}
        currency={props.currency}
        requireAvailableRail={false}
      />
      <PayoutRailRecommendationCard
        currency={props.currency}
        pendingDestination
        merchantHederaReady={readiness.merchantHederaReady}
        merchantCregisReady={readiness.merchantCregisReady}
        merchantAirwallexReady={readiness.merchantAirwallexReady}
      />
      <PayoutRailComparison
        currency={props.currency}
        hideRecommendation
        merchantHederaReady={readiness.merchantHederaReady}
        merchantCregisReady={readiness.merchantCregisReady}
        merchantAirwallexReady={readiness.merchantAirwallexReady}
      />
    </div>
  );
}
