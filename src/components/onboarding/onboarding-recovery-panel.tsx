'use client';

import { Button } from '@/components/ui/button';
import type { MutationStatus } from '@/lib/onboarding/mutation-resilience';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, RefreshCw } from 'lucide-react';

export type OnboardingRecoveryMutation = {
  status: MutationStatus;
  recoveryMessage: string;
  retryRecommended?: boolean;
  safeToRetry?: boolean;
  preservedDraft?: boolean;
  operationReference?: string;
  operationalWarning?: string;
};

export type OnboardingRecoveryPanelProps = {
  mutation: OnboardingRecoveryMutation;
  onRetry?: () => void;
  onContinueLater?: () => void;
  className?: string;
};

export function OnboardingRecoveryPanel({
  mutation,
  onRetry,
  onContinueLater,
  className,
}: OnboardingRecoveryPanelProps) {
  const { status } = mutation;

  if (status === 'SUCCESS') {
    return (
      <div
        className={cn(
          'rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm space-y-2',
          className
        )}
      >
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p>{mutation.recoveryMessage}</p>
        </div>
        {mutation.operationalWarning ? (
          <p className="text-muted-foreground text-xs pl-6">{mutation.operationalWarning}</p>
        ) : null}
      </div>
    );
  }

  if (status === 'PARTIAL_SUCCESS') {
    return (
      <div
        className={cn(
          'rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm space-y-3',
          className
        )}
      >
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">Project created — setup still processing</p>
            <p className="text-muted-foreground">{mutation.recoveryMessage}</p>
            {mutation.operationalWarning ? (
              <p className="text-muted-foreground text-xs">{mutation.operationalWarning}</p>
            ) : null}
          </div>
        </div>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Continue to participants
          </Button>
        ) : null}
      </div>
    );
  }

  const isRecoverable = status === 'RECOVERABLE_FAILURE';

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-4 text-sm space-y-3',
        isRecoverable
          ? 'border-amber-500/25 bg-amber-500/5'
          : 'border-red-500/20 bg-red-500/5',
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className={cn(
            'h-4 w-4 shrink-0 mt-0.5',
            isRecoverable ? 'text-amber-700' : 'text-red-700'
          )}
        />
        <div className="space-y-2 min-w-0">
          <p className="font-medium">
            {isRecoverable
              ? 'We could not finish configuring your project yet'
              : 'Setup could not be completed'}
          </p>
          <p className="text-muted-foreground leading-relaxed">{mutation.recoveryMessage}</p>
          {mutation.preservedDraft !== false ? (
            <p className="text-xs text-muted-foreground">
              Your entered details are preserved safely on this device. You can retry without
              creating duplicates.
            </p>
          ) : null}
          {mutation.operationReference ? (
            <p className="text-xs text-muted-foreground font-mono">
              Reference: {mutation.operationReference}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isRecoverable && mutation.safeToRetry !== false && onRetry ? (
          <Button type="button" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Try again
          </Button>
        ) : null}
        {onContinueLater ? (
          <Button type="button" size="sm" variant="outline" onClick={onContinueLater}>
            Continue later
          </Button>
        ) : null}
      </div>
    </div>
  );
}
