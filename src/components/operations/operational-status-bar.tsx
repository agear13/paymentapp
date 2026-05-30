'use client';

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability';
import { labelSafeToRelease, WORKSPACE_PHASE_OPERATOR } from '@/lib/operations/design-language';
import { OperationalStatePill } from '@/components/operations/operational-state-pill';
import { SafeOperationalLink } from '@/components/operations/safe-operational-link';
import { opTypeMeta } from '@/lib/design/operational-typography';
import { opSpace } from '@/lib/design/operational-spacing';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type OperationalStatusBarProps = {
  title?: string;
  guidance: OperationalGuidanceBundle | null;
  loading?: boolean;
  degraded?: boolean;
  activation?: WorkspaceActivationSnapshot | null;
  compact?: boolean;
  sticky?: boolean;
  className?: string;
};

export function OperationalStatusBar({
  guidance,
  loading,
  degraded,
  activation: activationProp,
  compact = true,
  sticky,
  className,
}: OperationalStatusBarProps) {
  const activation = activationProp ?? null;

  if (loading) {
    return (
      <div
        className={cn(
          'border-b border-border/80 bg-background/95',
          opSpace.stripY,
          sticky && 'sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/90',
          className
        )}
        aria-busy="true"
      >
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  const exp = guidance?.explanation;
  const action = guidance?.actions[0];
  const blockers = exp?.blockers.length ?? 0;
  const conf = guidance?.releaseConfidence.level ?? 'LOW';
  const phase = exp?.phaseLabel ?? 'CONFIGURING';
  const phaseLabel = WORKSPACE_PHASE_OPERATOR[phase] ?? phase;

  return (
    <div
      className={cn(
        'border-b border-border/80 bg-background/95',
        sticky && 'sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/90',
        degraded && 'border-amber-500/25',
        className
      )}
      aria-label="Workspace status"
    >
      <div
        className={cn(
          'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm',
          opSpace.stripY,
          compact && 'gap-y-1'
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 text-foreground/85">
          <OperationalStatePill phase={phase} scope="workspace" />
          <span className="hidden sm:inline text-foreground/45">·</span>
          <span className={cn(opTypeMeta, 'truncate')}>{phaseLabel}</span>
          <span className="hidden md:inline text-foreground/45">·</span>
          <span className={opTypeMeta}>
            <span className="text-foreground/65">Release: </span>
            <span className="font-medium text-foreground">{labelSafeToRelease(conf)}</span>
          </span>
          {blockers > 0 ? (
            <>
              <span className="hidden md:inline text-foreground/45">·</span>
              <span className={cn(opTypeMeta, 'font-medium text-amber-900 dark:text-amber-200')}>
                {blockers} blocker{blockers === 1 ? '' : 's'}
              </span>
            </>
          ) : null}
        </div>

        {action ? (
          <Button asChild size="sm" variant="ghost" className="h-8 w-fit shrink-0 text-xs px-2">
            <SafeOperationalLink
              intent={
                /earnings|compensation/i.test(action.action)
                  ? 'configure_earnings'
                  : /obligation/i.test(action.action)
                    ? 'review_obligations'
                    : 'resolve_issue'
              }
              projectId={activation?.primaryProjectId}
            >
              {action.ctaLabel ?? action.action}
              <ChevronRight className="ml-1 h-3 w-3" />
            </SafeOperationalLink>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
