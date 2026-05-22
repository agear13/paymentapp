'use client';

import Link from 'next/link';
import { Check, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { OnboardingNextActionCard } from '@/components/onboarding/onboarding-next-action-card';
import {
  ACTIVATION_FALLBACK_CHECKLIST,
  needsActivationGuidance,
} from '@/lib/onboarding/workspace-activation-fallback';
import { cn } from '@/lib/utils';

type WorkspaceActivationBannerProps = {
  projectName?: string;
  showProgress?: boolean;
  nextActionVariant?: 'default' | 'merchant-settings';
};

export function WorkspaceActivationBanner({
  projectName,
  showProgress = true,
  nextActionVariant = 'default',
}: WorkspaceActivationBannerProps) {
  const { activation, loading, degraded } = useWorkspaceActivation();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 min-h-[4rem]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace status…
      </div>
    );
  }

  const snapshot = activation;
  const showGuidance =
    !snapshot || needsActivationGuidance(snapshot) || degraded;

  if (!showGuidance && snapshot) {
    return null;
  }

  const checklist = snapshot?.checklist ?? ACTIVATION_FALLBACK_CHECKLIST;
  const phaseLabel = snapshot?.phaseLabel ?? 'Workspace setup in progress';
  const progress = snapshot?.onboardingProgressPercent ?? 0;

  const workspaceHref = projectName
    ? `/dashboard?workspace=ready&project=${encodeURIComponent(projectName)}`
    : '/dashboard?workspace=ready';

  return (
    <div className="space-y-4 min-h-[4rem]">
      {degraded ? (
        <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
          Showing continued setup guidance while workspace status refreshes.
        </p>
      ) : null}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Workspace activation</p>
        <h2 className="text-lg font-semibold">{phaseLabel}</h2>
        {showProgress ? (
          <p className="text-sm text-muted-foreground">{progress}% complete</p>
        ) : null}
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {checklist.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-2 text-sm py-1 transition-colors duration-300',
              item.complete ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {item.complete ? (
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 shrink-0" />
            )}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <OnboardingNextActionCard variant={nextActionVariant} />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/onboarding">Continue setup</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={workspaceHref}>Workspace home</Link>
        </Button>
      </div>
    </div>
  );
}
