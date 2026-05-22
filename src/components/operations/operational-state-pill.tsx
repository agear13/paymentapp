'use client';

import { cn } from '@/lib/utils';
import {
  PROJECT_PHASE_OPERATOR,
  WORKSPACE_PHASE_OPERATOR,
} from '@/lib/operations/design-language';

export function OperationalStatePill({
  phase,
  scope = 'workspace',
  className,
}: {
  phase: string;
  scope?: 'workspace' | 'project';
  className?: string;
}) {
  const labels = scope === 'project' ? PROJECT_PHASE_OPERATOR : WORKSPACE_PHASE_OPERATOR;
  const label = labels[phase] ?? phase.replace(/_/g, ' ').toLowerCase();
  const attention =
    phase === 'DEGRADED' ||
    phase === 'BLOCKED' ||
    phase === 'FUNDING_PENDING' ||
    phase === 'COMPENSATION_PENDING';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs sm:text-sm font-medium transition-colors duration-150',
        attention
          ? 'border-amber-500/35 text-amber-950 dark:text-amber-100 bg-amber-500/8'
          : 'border-border/80 text-foreground/75 bg-muted/30',
        className
      )}
    >
      {label}
    </span>
  );
}
