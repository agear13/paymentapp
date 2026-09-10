import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  buildPayoutRailComparison,
  type PayoutRailComparisonRow,
} from '@/lib/payouts/payout-rail-presentation';
import type { PayoutDestinationKind, PayoutRailId } from '@/lib/payouts/rails/types';
import { cn } from '@/lib/utils';

export type PayoutRailComparisonProps = {
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
  hideRecommendation?: boolean;
  rows?: PayoutRailComparisonRow[];
  className?: string;
};

export function PayoutRailComparison(props: PayoutRailComparisonProps) {
  const rows =
    props.rows ??
    buildPayoutRailComparison({
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
      hideRecommendation: props.hideRecommendation,
    });

  return (
    <div className={cn('space-y-2', props.className)}>
      <div>
        <h3 className="text-sm font-semibold">Rail comparison</h3>
        <p className="text-xs text-muted-foreground">
          Registered rails can appear here before they are configured. A rail is available only
          when it is configured and eligible for this destination. Cost and settlement speed are
          shown only when estimated.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rail</TableHead>
            <TableHead>Compatible</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Estimated cost</TableHead>
            <TableHead>Estimated settlement</TableHead>
            <TableHead>FX</TableHead>
            <TableHead>Recommended</TableHead>
            <TableHead>Reasons</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.railId} data-rail-id={row.railId}>
              <TableCell>
                <div className="font-medium">{row.label}</div>
                <div className="text-[11px] text-muted-foreground">{row.destinationKindLabel}</div>
              </TableCell>
              <TableCell>{row.compatibilityLabel}</TableCell>
              <TableCell>
                <div>{row.availabilityLabel}</div>
                {row.connectHint ? (
                  <div className="text-[11px] text-muted-foreground">{row.connectHint}</div>
                ) : null}
                {row.unavailabilityReason ? (
                  <div className="max-w-[12rem] text-[11px] text-muted-foreground">
                    {row.unavailabilityReason}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-muted-foreground">{row.estimatedCost}</TableCell>
              <TableCell>
                <div className="text-muted-foreground">{row.estimatedSettlementSpeed}</div>
                <div className="text-[11px] text-muted-foreground/80">
                  Typical: {row.typicalSettlement}
                </div>
              </TableCell>
              <TableCell className="max-w-[14rem] text-xs text-muted-foreground">
                {row.fxRequirement}
              </TableCell>
              <TableCell>
                {row.recommended ? (
                  <Badge variant="success">Recommended</Badge>
                ) : row.inUse ? (
                  <Badge variant="outline">In use</Badge>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="max-w-[16rem]">
                <div className="flex flex-wrap gap-1">
                  {row.reasonCodes.map((code) => (
                    <Badge key={`${row.railId}-${code}`} variant="outline" className="font-normal text-[10px]">
                      {code.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
