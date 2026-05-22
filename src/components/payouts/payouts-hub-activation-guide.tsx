'use client';

import { OnboardingNextActionCard } from '@/components/onboarding/onboarding-next-action-card';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { Check, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Derived activation checklist + next step on the payouts hub. */
export function PayoutsHubActivationGuide() {
  const { activation, loading } = useWorkspaceActivation();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace guidance…
      </div>
    );
  }

  if (!activation || activation.onboardingProgressPercent >= 100) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/30 bg-muted/15 px-4 py-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Workspace activation</p>
        <p className="text-sm font-semibold mt-0.5">{activation.phaseLabel}</p>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {activation.checklist.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-2 text-xs py-0.5 transition-colors duration-300',
              item.complete ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {item.complete ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0" />
            )}
            {item.label}
          </li>
        ))}
      </ul>
      <OnboardingNextActionCard compact className="border-t-0 pt-0" />
    </div>
  );
}
