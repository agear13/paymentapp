'use client';

import Link from 'next/link';
import { Check, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { OnboardingNextActionCard } from '@/components/onboarding/onboarding-next-action-card';
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
  const { activation, loading } = useWorkspaceActivation();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace status…
      </div>
    );
  }

  if (!activation || activation.onboardingProgressPercent >= 100) {
    return null;
  }

  const workspaceHref = projectName
    ? `/dashboard?workspace=ready&project=${encodeURIComponent(projectName)}`
    : '/dashboard?workspace=ready';

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Workspace activation</p>
        <h2 className="text-lg font-semibold">{activation.phaseLabel}</h2>
        {showProgress ? (
          <p className="text-sm text-muted-foreground">
            {activation.onboardingProgressPercent}% complete
          </p>
        ) : null}
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {activation.checklist.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-2 text-sm py-1 transition-colors duration-300',
              item.complete ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {item.complete ? (
              <Check className="h-4 w-4 text-emerald-600 shrink-0 animate-in zoom-in-50 duration-200" />
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
