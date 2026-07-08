'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Check, Circle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { toast } from 'sonner';
import type { PaymentHealthStatus } from '@/lib/payments/lifecycle/lifecycle-stages';
import type { PaymentTransactionLayers } from '@/lib/payments/payment-layers';
import { PaymentTransactionLayersPanel } from '@/components/payment-links/payment-transaction-layers-panel';

type LifecycleTimelineItem = {
  id: string;
  stage: string;
  label: string;
  createdAt: string;
  actor: string | null;
  provider: string | null;
  reached: boolean;
};

type LayerTimelineItem = {
  stage: string;
  label: string;
  reached: boolean;
  createdAt: string | null;
};

type SettlementItem = {
  id: string;
  status: string;
  currency: string;
  amount: string;
  provider: string | null;
  settledAt: string | null;
  reference: string | null;
};

type LifecycleSnapshot = {
  health: PaymentHealthStatus;
  healthLabel: string;
  currentStage: string | null;
  timeline: LifecycleTimelineItem[];
  layerTimeline?: LayerTimelineItem[];
  transactionLayers?: PaymentTransactionLayers;
  xeroContext?: Record<string, unknown> | null;
  settlements: SettlementItem[];
};

const SETTLEMENT_FLOW = ['Paid', 'Settlement Pending', 'Settled', 'Reconciled'] as const;

function settlementFlowStep(settlements: SettlementItem[], linkStatus: string): number {
  if (settlements.some((s) => s.status === 'RECONCILED')) return 3;
  if (settlements.some((s) => s.status === 'SETTLED')) return 2;
  if (
    linkStatus === 'PAID' ||
    linkStatus === 'PAID_UNVERIFIED' ||
    linkStatus === 'REQUIRES_REVIEW' ||
    settlements.some((s) => s.status === 'PENDING' || s.status === 'IN_PROGRESS')
  ) {
    return 1;
  }
  if (linkStatus === 'PAID' || linkStatus === 'PARTIALLY_REFUNDED') return 0;
  return -1;
}

export function PaymentLifecyclePanel({
  paymentLinkId,
  linkStatus,
}: {
  paymentLinkId: string;
  linkStatus: string;
}) {
  const [loading, setLoading] = React.useState(true);
  const [snapshot, setSnapshot] = React.useState<LifecycleSnapshot | null>(null);
  const [markingId, setMarkingId] = React.useState<string | null>(null);

  const loadLifecycle = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await csrfAwareFetch(
        `/api/payment-links/${encodeURIComponent(paymentLinkId)}/lifecycle`
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load lifecycle');
      }
      setSnapshot(payload.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load lifecycle');
    } finally {
      setLoading(false);
    }
  }, [paymentLinkId]);

  React.useEffect(() => {
    loadLifecycle();
  }, [loadLifecycle]);

  async function handleMarkSettled(settlementId: string) {
    setMarkingId(settlementId);
    try {
      const response = await csrfAwareFetch(
        `/api/payment-links/${encodeURIComponent(paymentLinkId)}/settlements/${encodeURIComponent(settlementId)}/mark-settled`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to mark settled');
      }
      toast.success('Settlement marked as settled');
      await loadLifecycle();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark settled');
    } finally {
      setMarkingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment lifecycle...
      </div>
    );
  }

  if (!snapshot) {
    return null;
  }

  const flowIndex = settlementFlowStep(snapshot.settlements, linkStatus);
  const displayTimeline =
    snapshot.layerTimeline && snapshot.layerTimeline.length > 0
      ? snapshot.layerTimeline.map((item) => ({
          id: item.stage,
          stage: item.stage,
          label: item.label,
          createdAt: item.createdAt ?? new Date(0).toISOString(),
          actor: null,
          provider: null,
          reached: item.reached,
        }))
      : snapshot.timeline.filter((item) =>
          [
            'INVOICE_CREATED',
            'PAYMENT_CONFIRMED',
            'FX_SNAPSHOT_LOCKED',
            'SETTLEMENT_PENDING',
            'SETTLEMENT_COMPLETED',
            'RECONCILED',
          ].includes(item.stage)
        );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Payment Health</span>
        <Badge variant="secondary">{snapshot.healthLabel}</Badge>
        {snapshot.currentStage ? (
          <span className="text-xs text-muted-foreground">
            Current stage: {snapshot.currentStage.replace(/_/g, ' ').toLowerCase()}
          </span>
        ) : null}
      </div>

      {flowIndex >= 0 ? (
        <div>
          <p className="text-sm font-medium mb-3">Settlement Progress</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {SETTLEMENT_FLOW.map((label, index) => {
              const active = index <= flowIndex;
              const current = index === flowIndex;
              return (
                <React.Fragment key={label}>
                  {index > 0 ? <span className="text-muted-foreground">↓</span> : null}
                  <span
                    className={cn(
                      'rounded-md px-2 py-1 border',
                      active
                        ? current
                          ? 'border-primary bg-primary/5 font-medium'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-muted text-muted-foreground'
                    )}
                  >
                    {label}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-sm font-medium mb-3">Timeline</p>
        <ol className="space-y-3">
          {displayTimeline.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border',
                  item.reached
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {item.reached ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm',
                    item.reached ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </p>
                {item.reached && item.createdAt && item.createdAt !== new Date(0).toISOString() ? (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(item.createdAt), 'PPpp')}
                    {item.provider ? ` · ${item.provider}` : ''}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {snapshot.transactionLayers ? (
        <PaymentTransactionLayersPanel
          layers={snapshot.transactionLayers}
          xeroContext={snapshot.xeroContext}
        />
      ) : null}

      {snapshot.settlements.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">Settlements</p>
          {snapshot.settlements.map((settlement) => (
            <div
              key={settlement.id}
              className="rounded-lg border p-3 text-sm flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium">
                  {settlement.amount} {settlement.currency}
                </p>
                <p className="text-xs text-muted-foreground">
                  {settlement.provider ?? 'Unknown provider'} · {settlement.status}
                </p>
              </div>
              {settlement.status === 'PENDING' || settlement.status === 'IN_PROGRESS' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={markingId === settlement.id}
                  onClick={() => handleMarkSettled(settlement.id)}
                >
                  {markingId === settlement.id ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Mark Settled'
                  )}
                </Button>
              ) : settlement.settledAt ? (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(settlement.settledAt), 'PPpp')}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
