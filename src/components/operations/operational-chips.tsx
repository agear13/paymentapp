'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReleaseConfidenceLevel } from '@/lib/operations/explainability';
import type { WorkspaceState } from '@/lib/operations/states/workspace-state';
import {
  PROJECT_PHASE_OPERATOR,
  WORKSPACE_PHASE_OPERATOR,
  OPERATOR_LABELS,
} from '@/lib/operations/design-language';
import type { ProjectState } from '@/lib/operations/states/project-state';
import type { ParticipantState } from '@/lib/operations/states/participant-state';

export function WorkspacePhaseBadge({
  state,
  className,
}: {
  state: WorkspaceState;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn('font-normal', className)}>
      {WORKSPACE_PHASE_OPERATOR[state] ?? state}
    </Badge>
  );
}

export function ProjectStateChip({
  state,
  className,
}: {
  state: ProjectState;
  className?: string;
}) {
  const attention =
    state === 'BLOCKED' ||
    state === 'FUNDING_PENDING' ||
    state === 'OBLIGATIONS_PENDING';
  return (
    <Badge
      variant={attention ? 'outline' : 'secondary'}
      className={cn(
        'font-normal',
        attention && 'border-amber-500/35 text-amber-900 dark:text-amber-300',
        className
      )}
    >
      {PROJECT_PHASE_OPERATOR[state] ?? state}
    </Badge>
  );
}

export function ParticipantReadinessChip({
  state,
  payoutReady,
  className,
}: {
  state: ParticipantState;
  payoutReady?: boolean;
  className?: string;
}) {
  const labels: Record<ParticipantState, string> = {
    INVITED: 'Invited',
    ONBOARDING: 'Onboarding',
    PAYOUT_DETAILS_PENDING: 'Payout pending',
    COMPENSATION_PENDING: 'Earnings pending',
    READY: 'Payout ready',
    INACTIVE: 'Inactive',
    BLOCKED: 'Blocked',
  };
  return (
    <Badge
      variant={payoutReady ? 'default' : 'outline'}
      className={cn('font-normal text-xs', className)}
    >
      {labels[state]}
    </Badge>
  );
}

export function ReleaseConfidenceChip({
  level,
  className,
}: {
  level: ReleaseConfidenceLevel;
  className?: string;
}) {
  const labels: Record<ReleaseConfidenceLevel, string> = {
    HIGH: OPERATOR_LABELS.releaseCanProceed,
    MEDIUM: 'Review before release',
    LOW: OPERATOR_LABELS.actionRequired,
    BLOCKED: OPERATOR_LABELS.releaseBlocked,
  };
  const variant =
    level === 'HIGH'
      ? 'default'
      : level === 'BLOCKED'
        ? 'destructive'
        : 'outline';
  return (
    <Badge variant={variant} className={cn('font-normal text-xs', className)}>
      {labels[level]}
    </Badge>
  );
}

export function RevenueSettlementChip({
  label,
  health,
  className,
}: {
  label: string;
  health?: 'healthy' | 'pending' | 'risk';
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-normal text-xs',
        health === 'risk' && 'border-amber-500/35',
        health === 'healthy' && 'border-emerald-500/30',
        className
      )}
    >
      {label}
    </Badge>
  );
}
