import { Button } from '@/components/ui/button';
import { PayoutRailBadge } from '@/components/payouts/payout-rail-badge';
import { assessPayoutRailAvailability } from '@/lib/payouts/payout-rail-availability';
import {
  NOT_YET_ESTIMATED,
  formatPayoutDestination,
  formatPayoutRecipient,
  payoutDestinationTypeLabel,
  payoutFxImplication,
} from '@/lib/payouts/payout-rail-presentation';
import { isPayoutRailId } from '@/lib/payouts/rails/types';
import { cn } from '@/lib/utils';

export type PayoutReviewSummaryProps = {
  recipient?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  methodType?: string | null;
  destinationHandle?: string | null;
  hederaAccountId?: string | null;
  destinationDetails?: Record<string, unknown> | null;
  railId?: string | null;
  merchantHederaReady?: boolean;
  merchantCregisReady?: boolean;
  merchantAirwallexReady?: boolean;
  estimatedSettlement?: string | null;
  estimatedCost?: string | null;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  confirming?: boolean;
  requireAvailableRail?: boolean;
  onConfirm?: () => void;
  className?: string;
};

function formatAmount(amount?: number | string | null, currency?: string | null) {
  if (amount == null || amount === '') return '—';
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  const formatted = Number.isFinite(numeric) ? numeric.toFixed(2) : String(amount);
  return [currency, formatted].filter(Boolean).join(' ');
}

export function PayoutReviewSummary(props: PayoutReviewSummaryProps) {
  const destination = formatPayoutDestination({
    methodType: props.methodType,
    handle: props.destinationHandle,
    hederaAccountId: props.hederaAccountId,
    details: props.destinationDetails,
  });
  const fx = payoutFxImplication({
    railId: props.railId,
    currency: props.currency,
    methodType: props.methodType,
    details: props.destinationDetails,
    payoutAmount: props.amount == null ? null : String(props.amount),
  });
  const selectedRailId = isPayoutRailId(props.railId ?? '') ? props.railId : null;
  const availability = selectedRailId
    ? assessPayoutRailAvailability({
        railId: selectedRailId,
        currency: props.currency ?? '',
        methodType: props.methodType,
        destinationHandle: props.destinationHandle,
        destinationDetails: props.destinationDetails,
        payoutAmount: props.amount == null ? undefined : String(props.amount),
        selectedRailId,
        merchantHederaReady: props.merchantHederaReady,
        merchantCregisReady: props.merchantCregisReady,
        merchantAirwallexReady: props.merchantAirwallexReady,
      })
    : null;
  const requireAvailableRail = props.requireAvailableRail !== false;
  const railExecutable = !requireAvailableRail || !selectedRailId || availability?.available === true;

  const rows = [
    { label: 'Recipient', value: formatPayoutRecipient(props.recipient) },
    { label: 'Amount', value: formatAmount(props.amount, props.currency) },
    { label: 'Currency', value: props.currency || '—' },
    { label: 'Destination type', value: payoutDestinationTypeLabel(props.methodType) },
    { label: 'Payout destination', value: destination },
    {
      label: 'Selected / recommended rail',
      value: <PayoutRailBadge railId={props.railId} />,
    },
    {
      label: 'Rail status',
      value: availability
        ? [availability.label, availability.connectHint].filter(Boolean).join(' · ')
        : 'Not selected',
    },
    {
      label: 'Estimated settlement',
      value: props.estimatedSettlement || NOT_YET_ESTIMATED,
    },
    { label: 'Estimated cost', value: props.estimatedCost || NOT_YET_ESTIMATED },
    { label: 'FX implications', value: fx },
  ];

  return (
    <section className={cn('space-y-4', props.className)}>
      <div>
        <h3 className="text-sm font-semibold">Payout review</h3>
        <p className="text-xs text-muted-foreground">
          The selected rail comes from Provvy&apos;s payout rail selector. Unconfigured rails are
          not executable. This screen does not call a provider.
        </p>
      </div>
      <dl className="space-y-2.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
      {availability && !availability.available ? (
        <p className="text-xs text-muted-foreground">
          This rail cannot be used to confirm or submit this payout.
          {availability.connectHint ? ` ${availability.connectHint}.` : ''}
          {availability.reason ? ` ${availability.reason}.` : ''}
        </p>
      ) : null}
      {props.onConfirm ? (
        <Button
          onClick={props.onConfirm}
          disabled={props.confirmDisabled || props.confirming || !railExecutable}
          className="w-full sm:w-auto"
        >
          {props.confirming ? 'Confirming…' : props.confirmLabel || 'Confirm payout'}
        </Button>
      ) : null}
    </section>
  );
}
