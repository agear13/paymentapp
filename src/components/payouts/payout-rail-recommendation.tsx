import { PayoutRailBadge } from '@/components/payouts/payout-rail-badge';
import {
  recommendPayoutRail,
  type PayoutRailRecommendation,
} from '@/lib/payouts/payout-rail-presentation';
import type { PayoutDestinationKind, PayoutRailId } from '@/lib/payouts/rails/types';
import { cn } from '@/lib/utils';

export type PayoutRailRecommendationCardProps = {
  currency: string;
  methodType?: string | null;
  destinationKind?: PayoutDestinationKind | null;
  destinationHandle?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  payoutAmount?: string;
  merchantHederaReady?: boolean;
  merchantCregisReady?: boolean;
  merchantAirwallexReady?: boolean;
  selectedRailId?: PayoutRailId | null;
  pendingDestination?: boolean;
  recommendation?: PayoutRailRecommendation;
  className?: string;
};

export function PayoutRailRecommendationCard(props: PayoutRailRecommendationCardProps) {
  if (props.pendingDestination) {
    return (
      <section className={cn('rounded-lg border bg-muted/30 p-4 space-y-2', props.className)}>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Provvy recommendation
        </p>
        <h3 className="text-sm font-semibold">Provvy chooses the payout rail</h3>
        <p className="text-sm text-muted-foreground">
          Provvy determines which payout rail can service each destination when the batch is
          created. Registered rails can appear in comparison before they are configured. Only a
          configured, eligible rail can be recommended or executed. Manual is the fallback.
        </p>
      </section>
    );
  }

  const recommendation =
    props.recommendation ??
    recommendPayoutRail({
      currency: props.currency,
      methodType: props.methodType,
      destinationKind: props.destinationKind,
      destinationHandle: props.destinationHandle,
      destinationDetails: props.destinationDetails,
      payoutAmount: props.payoutAmount,
      merchantHederaReady: props.merchantHederaReady,
      merchantCregisReady: props.merchantCregisReady,
      merchantAirwallexReady: props.merchantAirwallexReady,
      selectedRailId: props.selectedRailId,
    });

  return (
    <section className={cn('rounded-lg border bg-muted/30 p-4 space-y-3', props.className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Provvy recommendation
      </p>
      <div>
        <h3 className="text-sm font-semibold">
          {recommendation.railId === 'manual'
            ? 'Manual is the available fallback'
            : 'Provvy\u2019s recommended route'}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <PayoutRailBadge railId={recommendation.railId} />
          {recommendation.destinationSummary ? (
            <span className="text-sm font-medium">{recommendation.destinationSummary}</span>
          ) : null}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Why Provvy recommends this</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {recommendation.reasons.map((reason) => (
            <li key={reason.label} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{reason.label}</span>
              <span className="text-right font-medium">{reason.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
