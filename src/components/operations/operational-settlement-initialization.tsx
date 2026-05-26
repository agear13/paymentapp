'use client';

import * as React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import { onboardingInitializationProgress } from '@/lib/operations/onboarding/operational-onboarding-phases';

type OperationalSettlementInitializationProps = {
  onboarding: OperationalOnboardingState | null | undefined;
  loading?: boolean;
  children: React.ReactNode;
};

/** Blocks settlement rail projections until OPERATIONAL_GRAPH_READY. */
export function OperationalSettlementInitialization({
  onboarding,
  loading = false,
  children,
}: OperationalSettlementInitializationProps) {
  const [refreshing, setRefreshing] = React.useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settlement infrastructure…
      </div>
    );
  }

  if (!onboarding || onboarding.graphReady) {
    return <>{children}</>;
  }

  const progress = onboardingInitializationProgress(onboarding);

  const handleRefresh = () => {
    setRefreshing(true);
    notifyWorkspaceActivationRefresh();
    window.setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/[0.03] p-5">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Settlement infrastructure initializing
        </p>
        <h3 className="text-lg font-semibold">{progress.headline}</h3>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {effectiveOnboarding.recoveryMessage ??
            'Your payment rails were connected successfully. Operational coordination is being prepared.'}
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
        {progress.steps.map((step) => (
          <li
            key={step.id}
            className={`text-sm ${step.complete ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {step.complete ? '✓' : '○'} {step.label}
          </li>
        ))}
      </ul>

      {effectiveOnboarding.blockers.length > 0 ? (
        <ul className="text-xs text-amber-800/90 dark:text-amber-300/90 space-y-1">
          {effectiveOnboarding.blockers.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={refreshing}
          onClick={handleRefresh}
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
