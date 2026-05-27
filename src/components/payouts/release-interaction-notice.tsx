'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import type { ReleaseInteractionState } from '@/lib/operations/capabilities/derive-release-interaction-state';
import { cn } from '@/lib/utils';

type ReleaseInteractionNoticeProps = {
  state: ReleaseInteractionState;
  className?: string;
  showRetry?: boolean;
};

export function ReleaseInteractionNotice({
  state,
  className,
  showRetry = true,
}: ReleaseInteractionNoticeProps) {
  if (state.releaseInteractionEnabled || !state.interactionGuidance) {
    return null;
  }

  const retryable =
    showRetry &&
    (state.disabledCategory === 'graph_converging' ||
      state.disabledCategory === 'settlement_initializing');

  return (
    <div
      className={cn(
        'rounded-lg border border-primary/20 bg-primary/[0.03] px-4 py-3 text-sm',
        className
      )}
      role="status"
    >
      <p className="font-medium text-foreground">Release actions unavailable</p>
      <p className="mt-1 text-muted-foreground">{state.interactionGuidance}</p>
      {retryable ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 h-8"
          onClick={() => notifyWorkspaceActivationRefresh()}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Reload coordination
        </Button>
      ) : null}
    </div>
  );
}
