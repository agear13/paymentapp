'use client';

import * as React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { OperationalInitializationSnapshot } from '@/lib/operations/onboarding/operational-transition-types';
import type { OperationalAction } from '@/lib/operations/explainability/types';
import { deriveSettlementInitializationState } from '@/lib/operations/coordination/derive-settlement-initialization-state';
import { OperationalMilestoneStrip } from '@/components/operations/operational-milestone-strip';
import { useOperationalTimelineProjection } from '@/hooks/use-operational-timeline-projection';

type OperationalSettlementInitializationProps = {
  onboarding: OperationalOnboardingState | null | undefined;
  initialization?: OperationalInitializationSnapshot | null;
  loading?: boolean;
  graphSnapshotConverged?: boolean;
  nextActions?: OperationalAction[];
  /** Persisted operational evidence — prevents shell from replacing populated pages. */
  participantCount?: number;
  earningsConfiguredCount?: number;
  obligationCount?: number;
  obligationsLoadedCount?: number;
  children: React.ReactNode;
};

/** Blocks settlement rail projections until OPERATIONAL_GRAPH_READY. */
export function OperationalSettlementInitialization({
  onboarding,
  initialization,
  loading = false,
  graphSnapshotConverged = false,
  nextActions = [],
  participantCount,
  earningsConfiguredCount,
  obligationCount,
  obligationsLoadedCount,
  children,
}: OperationalSettlementInitializationProps) {
  const [refreshing, setRefreshing] = React.useState(false);
  const [recoveryError, setRecoveryError] = React.useState<string | null>(null);

  const settlementInit = deriveSettlementInitializationState({
    activationLoading: loading,
    operationalOnboarding: onboarding,
    operationalInitialization: initialization,
    graphSnapshotConverged,
    nextActions,
    participantCount,
    earningsConfiguredCount,
    obligationCount,
    obligationsLoadedCount,
  });
  const timelineProjection = useOperationalTimelineProjection({ enabled: !loading });

  const effectiveOnboarding = initialization?.onboarding ?? onboarding;
  const correlationId = initialization?.correlationId ?? effectiveOnboarding?.correlationId;
  const retryable = initialization?.retryable ?? true;
  const displayActions = settlementInit.nextActions.length > 0 ? settlementInit.nextActions : nextActions;

  if (loading && settlementInit.showInitializationShell) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing payment setup…
      </div>
    );
  }

  if (!settlementInit.showInitializationShell) {
    return <>{children}</>;
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    setRecoveryError(null);
    try {
      if (retryable) {
        const res = await fetch('/api/operations/initialization/resume', {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          setRecoveryError(json.error ?? 'Recovery orchestration did not complete.');
        }
      }
      notifyWorkspaceActivationRefresh();
    } catch {
      setRecoveryError('Could not reach initialization recovery service.');
    } finally {
      window.setTimeout(() => setRefreshing(false), 800);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/[0.03] p-5">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Payment setup in progress
        </p>
        <h3 className="text-lg font-semibold">{settlementInit.headline}</h3>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {settlementInit.recoveryMessage ??
            'Your payment provider was connected successfully. Business operations are being prepared.'}
        </p>
        {initialization?.failedPhase ? (
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
            Last failure at {initialization.failedPhase.replace(/_/g, ' ').toLowerCase()}.
          </p>
        ) : null}
        {recoveryError ? (
          <p className="text-xs text-destructive">{recoveryError}</p>
        ) : null}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {settlementInit.progressSteps.map((step) => (
          <li
            key={step.id}
            className={`text-sm ${step.complete ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {step.complete ? '✓' : '○'} {step.label}
          </li>
        ))}
      </ul>

      <OperationalMilestoneStrip
        milestones={timelineProjection.milestones}
        confidence={timelineProjection.confidence}
      />

      {timelineProjection.blockers.length > 0 ? (
        <ul className="text-xs text-amber-800/90 dark:text-amber-300/90 space-y-1">
          {timelineProjection.blockers.map((blocker) => (
            <li key={blocker.id}>
              • {blocker.reason} — {blocker.remediation}
            </li>
          ))}
        </ul>
      ) : null}

      {settlementInit.blockers.length > 0 ? (
        <ul className="text-xs text-amber-800/90 dark:text-amber-300/90 space-y-1">
          {settlementInit.blockers.map((blocker: string) => (
            <li key={blocker}>• {blocker}</li>
          ))}
        </ul>
      ) : null}

      {displayActions.length > 0 ? (
        <div className="space-y-2 border-t border-border/30 pt-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Next operational steps
          </p>
          <ul className="space-y-2">
            {displayActions.map((action) => (
              <li key={action.id} className="text-sm">
                <p className="font-medium text-foreground">{action.action}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{action.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={refreshing}
          onClick={() => void handleRefresh()}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Reload coordination snapshot
        </Button>
        {process.env.NODE_ENV === 'development' && correlationId ? (
          <span className="text-[10px] text-muted-foreground font-mono">
            correlation: {correlationId}
          </span>
        ) : null}
      </div>
    </div>
  );
}
