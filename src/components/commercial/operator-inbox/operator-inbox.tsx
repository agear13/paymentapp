'use client';

/**
 * Operator Inbox
 *
 * A unified operational queue that surfaces every pending commercial action
 * across all participants in one place.
 *
 * Design principles:
 *   - One primary action per participant — never competing actions.
 *   - Grouped by urgency: action required → waiting → complete.
 *   - Each item shows why it matters commercially, not just what to click.
 *   - No searching across screens — everything an operator needs to act on today.
 *
 * Data flow:
 *   deriveWorkspaceWorkflowStatus() → WorkspaceWorkflowIntegrationStatus
 *     → Groups notifications by urgency
 *     → Renders participant work items
 */

import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  WorkspaceWorkflowIntegrationStatus,
  ParticipantWorkflowIntegrationStatus,
  OperatorNotification,
} from '@/lib/commercial/workflow-integration';
import { resolveCommercialCTAHref } from '@/lib/commercial/workflow-routes';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type OperatorInboxProps = {
  /** Derived from deriveWorkspaceWorkflowStatus(). */
  workspaceStatus: WorkspaceWorkflowIntegrationStatus;
  projectId: string;
  /** Optional: override for each notification's CTA href. */
  resolveHref?: (notification: OperatorNotification) => string | null;
  className?: string;
};

/* ─── Stage label helpers ────────────────────────────────────────────────── */

const STAGE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  awaiting_approval:        'secondary',
  generating_invoice:       'default',
  supplier_onboarding:      'default',
  awaiting_operator_review: 'default',
  awaiting_xero_export:     'default',
  awaiting_funding:         'secondary',
  awaiting_settlement:      'secondary',
  ready_to_release:         'default',
  complete:                 'outline',
};

/* ─── Single participant work item ───────────────────────────────────────── */

function ParticipantWorkItem({
  participant,
  projectId,
  resolveHref,
}: {
  participant: ParticipantWorkflowIntegrationStatus;
  projectId: string;
  resolveHref?: (n: OperatorNotification) => string | null;
}) {
  const { primaryCTA, operatorNotification, stage, stageLabel, triggeredBy } = participant;
  const notification = operatorNotification;

  const isComplete = stage === 'complete';
  const isActionRequired = notification?.urgency === 'action_required';
  const isDeadEnd = participant.isDeadEnd;

  const href = React.useMemo(() => {
    if (notification && resolveHref) {
      const override = resolveHref(notification);
      if (override) return override;
    }
    return resolveCommercialCTAHref(primaryCTA.destination, projectId, participant.participantId) ?? null;
  }, [notification, primaryCTA, projectId, resolveHref]);

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors',
        isActionRequired && !isComplete && 'border-amber-200/60 bg-amber-50/30 dark:border-amber-800/30 dark:bg-amber-950/10',
        isComplete && 'border-border/40 bg-muted/20',
        isDeadEnd && 'border-red-200/60 bg-red-50/20 dark:border-red-800/30',
        !isActionRequired && !isComplete && !isDeadEnd && 'border-border/50 bg-card'
      )}
    >
      {/* Left: participant identity + status */}
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
            isComplete ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            isActionRequired ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
            'bg-muted text-muted-foreground'
          )}
        >
          {participant.participantName?.charAt(0).toUpperCase() ?? <User className="h-3.5 w-3.5" />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              {participant.participantName}
            </span>
            <Badge variant={STAGE_BADGE_VARIANT[stage] ?? 'secondary'} className="text-xs h-5">
              {stageLabel}
            </Badge>
          </div>

          {/* Notification message — why this matters */}
          {notification && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {notification.message}
            </p>
          )}

          {/* Triggered-by context */}
          {triggeredBy && !isComplete && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 italic">
              {triggeredBy}
            </p>
          )}

          {/* Dead end warning */}
          {isDeadEnd && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
              No clear next action — requires operator attention.
            </p>
          )}
        </div>
      </div>

      {/* Right: single primary action */}
      <div className="shrink-0">
        {isComplete ? (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Complete
          </div>
        ) : href ? (
          <Button
            size="sm"
            variant={isActionRequired ? 'default' : 'outline'}
            className="h-8 gap-1.5 text-xs whitespace-nowrap"
            asChild
          >
            <a href={href}>
              {notification?.nextAction ?? primaryCTA.label}
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {notification?.nextAction ?? 'Waiting'}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Section header ─────────────────────────────────────────────────────── */

function SectionHeader({
  icon,
  label,
  count,
  urgent,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  urgent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-muted-foreground', urgent && 'text-amber-600 dark:text-amber-400')}>
        {icon}
      </span>
      <span className={cn('text-xs font-semibold uppercase tracking-wider',
        urgent ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
      )}>
        {label}
      </span>
      <span className={cn(
        'text-xs font-bold px-1.5 py-0.5 rounded-full',
        urgent
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
      )}>
        {count}
      </span>
    </div>
  );
}

/* ─── Operator Inbox ─────────────────────────────────────────────────────── */

/**
 * The canonical operator inbox for the Commercial OS.
 *
 * Feed it the result of `deriveWorkspaceWorkflowStatus()` and it surfaces
 * every pending commercial action across all participants in one place.
 *
 * @example
 * ```tsx
 * const status = deriveWorkspaceWorkflowStatus(participantInputs);
 * <OperatorInbox workspaceStatus={status} projectId={projectId} />
 * ```
 */
export function OperatorInbox({
  workspaceStatus,
  projectId,
  resolveHref,
  className,
}: OperatorInboxProps) {
  const { participants, actionRequired, deadEnds, allComplete } = workspaceStatus;

  const actionRequiredParticipants = participants.filter(
    (p) => p.operatorNotification?.urgency === 'action_required' && p.stage !== 'complete'
  );
  const waitingParticipants = participants.filter(
    (p) => p.operatorNotification?.urgency !== 'action_required' && p.stage !== 'complete'
  );
  const completedParticipants = participants.filter((p) => p.stage === 'complete');

  if (participants.length === 0) {
    return (
      <div className={cn('text-center py-8 text-sm text-muted-foreground', className)}>
        No participants in this agreement yet.
      </div>
    );
  }

  if (allComplete) {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border border-green-200/60 bg-green-50/30 dark:border-green-800/30 dark:bg-green-950/10 p-4', className)}>
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">All payments released</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {participants.length} participant{participants.length !== 1 ? 's' : ''} — agreement commercially complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-5', className)}>
      {/* Dead ends — should never happen in a well-integrated system */}
      {deadEnds.length > 0 && (
        <div className="space-y-2">
          <SectionHeader
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            label="Needs attention"
            count={deadEnds.length}
            urgent
          />
          {deadEnds.map((p) => (
            <ParticipantWorkItem
              key={p.participantId}
              participant={p}
              projectId={projectId}
              resolveHref={resolveHref}
            />
          ))}
        </div>
      )}

      {/* Action required */}
      {actionRequiredParticipants.length > 0 && (
        <div className="space-y-2">
          <SectionHeader
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            label="Action required"
            count={actionRequiredParticipants.length}
            urgent
          />
          {actionRequiredParticipants.map((p) => (
            <ParticipantWorkItem
              key={p.participantId}
              participant={p}
              projectId={projectId}
              resolveHref={resolveHref}
            />
          ))}
        </div>
      )}

      {/* Waiting on supplier / external */}
      {waitingParticipants.length > 0 && (
        <div className="space-y-2">
          <SectionHeader
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Waiting"
            count={waitingParticipants.length}
          />
          {waitingParticipants.map((p) => (
            <ParticipantWorkItem
              key={p.participantId}
              participant={p}
              projectId={projectId}
              resolveHref={resolveHref}
            />
          ))}
        </div>
      )}

      {/* Completed */}
      {completedParticipants.length > 0 && (
        <div className="space-y-2">
          <SectionHeader
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="Complete"
            count={completedParticipants.length}
          />
          {completedParticipants.map((p) => (
            <ParticipantWorkItem
              key={p.participantId}
              participant={p}
              projectId={projectId}
              resolveHref={resolveHref}
            />
          ))}
        </div>
      )}

      {/* Summary footer */}
      {actionRequired.length > 0 && (
        <p className="text-xs text-muted-foreground text-right pt-1">
          {actionRequired.length} action{actionRequired.length !== 1 ? 's' : ''} required
          {waitingParticipants.length > 0 ? ` · ${waitingParticipants.length} waiting` : ''}
        </p>
      )}
    </div>
  );
}
