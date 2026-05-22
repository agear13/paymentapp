'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability';
import {
  labelSafeToRelease,
  OPERATOR_LABELS,
  WORKSPACE_PHASE_OPERATOR,
} from '@/lib/operations/design-language';
import { OperationalStatePill } from '@/components/operations/operational-state-pill';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type OperationalStatusBarProps = {
  title?: string;
  guidance: OperationalGuidanceBundle | null;
  loading?: boolean;
  degraded?: boolean;
  compact?: boolean;
  sticky?: boolean;
  className?: string;
};

export function OperationalStatusBar({
  guidance,
  loading,
  degraded,
  compact = true,
  sticky,
  className,
}: OperationalStatusBarProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'border-b border-border/60 bg-background/95 px-4 py-2.5',
          sticky && 'sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/80',
          className
        )}
        aria-busy="true"
      >
        <Skeleton className="h-4 w-72" />
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
        'border-b border-border/60 bg-background/95',
        sticky && 'sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        degraded && 'border-amber-500/20',
        className
      )}
      aria-label="Workspace status"
    >
      <div
        className={cn(
          'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-2.5 text-sm',
          compact && 'gap-y-1.5'
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <OperationalStatePill phase={phase} scope="workspace" />
          <span className="text-muted-foreground text-xs hidden sm:inline">·</span>
          <span className="text-xs text-muted-foreground truncate">{phaseLabel}</span>
          <span className="text-muted-foreground text-xs hidden md:inline">·</span>
          <span className="text-xs">
            <span className="text-muted-foreground">{OPERATOR_LABELS.safeToRelease}: </span>
            <span className="font-medium">{labelSafeToRelease(conf)}</span>
          </span>
          {blockers > 0 ? (
            <>
              <span className="text-muted-foreground text-xs hidden md:inline">·</span>
              <span className="text-xs text-amber-800 dark:text-amber-300">
                {blockers} blocker{blockers === 1 ? '' : 's'}
              </span>
            </>
          ) : null}
        </div>

        {action ? (
          <Button asChild size="sm" variant="ghost" className="h-8 w-fit shrink-0 text-xs px-2">
            <Link href={action.destination}>
              {action.action}
              <ChevronRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
