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
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        attention
          ? 'border-amber-500/30 text-amber-900 dark:text-amber-200 bg-amber-500/5'
          : 'border-border/70 text-muted-foreground bg-background',
        className
      )}
    >
      {label}
    </span>
  );
}
