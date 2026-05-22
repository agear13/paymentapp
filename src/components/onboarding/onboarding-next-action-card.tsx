'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import {
  createFallbackNextAction,
  deriveMerchantSettingsNextAction,
  deriveNextRecommendedAction,
} from '@/lib/onboarding/next-recommended-action';
import { cn } from '@/lib/utils';

type OnboardingNextActionCardProps = {
  className?: string;
  compact?: boolean;
  variant?: 'default' | 'merchant-settings';
};

export function OnboardingNextActionCard({
  className,
  compact,
  variant = 'default',
}: OnboardingNextActionCardProps) {
  const { activation, nextAction: apiNextAction, loading, degraded } = useWorkspaceActivation();

  if (loading) {
    return null;
  }

  const nextAction =
    activation && !degraded
      ? variant === 'merchant-settings'
        ? deriveMerchantSettingsNextAction(activation) ?? deriveNextRecommendedAction(activation)
        : apiNextAction ?? deriveNextRecommendedAction(activation)
      : createFallbackNextAction(activation?.primaryProjectId);

  if (!nextAction) {
    return null;
  }

  if (compact) {
    if (nextAction.instructionalOnly) {
      return (
        <div className={cn('text-sm', className)}>
          <p className="text-xs font-medium text-muted-foreground">Next step</p>
          <p className="mt-0.5">{nextAction.description}</p>
        </div>
      );
    }
    return (
      <div
        className={cn(
          'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
          className
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Next recommended step</p>
          <p className="text-sm font-medium mt-0.5">{nextAction.title}</p>
        </div>
        <Button size="sm" className="shrink-0" asChild>
          <Link href={nextAction.href}>{nextAction.ctaLabel}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3 pt-4 border-t border-border/25', className)}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Next recommended step
        </p>
        <p className="text-sm font-semibold mt-1">{nextAction.title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{nextAction.description}</p>
        {nextAction.blockers && nextAction.blockers.length > 0 ? (
          <ul className="mt-2 text-xs text-amber-800/90 dark:text-amber-300/90 space-y-0.5">
            {nextAction.blockers.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {nextAction.instructionalOnly ? (
        <p className="text-sm text-muted-foreground">
          Complete provider setup in the form below.
        </p>
      ) : (
        <Button asChild>
          <Link href={nextAction.href}>
            {nextAction.ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
