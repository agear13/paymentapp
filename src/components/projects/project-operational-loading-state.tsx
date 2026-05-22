'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ProjectOperationalLoadingStateProps = {
  variant?: 'loading' | 'configuring' | 'error';
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function ProjectOperationalLoadingState({
  variant = 'loading',
  message,
  onRetry,
  className,
}: ProjectOperationalLoadingStateProps) {
  const defaultMessage =
    variant === 'loading'
      ? 'Loading project workspace…'
      : variant === 'configuring'
        ? 'This project is still being configured.'
        : 'We could not load this project workspace.';

  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-border/30 bg-muted/15 px-4 py-6',
        className
      )}
    >
      {variant === 'loading' ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : null}
      <p className="text-sm text-muted-foreground">{message ?? defaultMessage}</p>
      {variant === 'configuring' ? (
        <p className="text-xs text-muted-foreground">
          Add participants, configure earnings, then connect collection before obligations or payout
          release.
        </p>
      ) : null}
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
