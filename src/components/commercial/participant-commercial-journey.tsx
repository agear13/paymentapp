'use client';

/**
 * ParticipantCommercialJourney
 *
 * Displays the complete commercial journey for a single participant.
 *
 * Shows every stage from agreement approval through to payment released.
 * Derives entirely from deriveParticipantWorkflowStatus() — no independent calculations.
 *
 * Usage in participant cards, operator review, and settlement screens.
 *
 * Sections shown:
 *   Agreement → Supplier Setup → Invoice → ABN → GST → Accounting → Settlement
 */

import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  ArrowRight,
  FileText,
  Building2,
  ShieldCheck,
  CreditCard,
  BarChart3,
  FileCheck2,
} from 'lucide-react';

import type {
  CommercialJourneyStep,
  JourneyStepStatus,
  ParticipantWorkflowIntegrationStatus,
  CommercialWorkflowCTA,
} from '@/lib/commercial/workflow-integration';

/* ─── Step icon ──────────────────────────────────────────────────────────── */
const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  agreement: FileCheck2,
  supplier_setup: CreditCard,
  invoice: FileText,
  abn: Building2,
  gst: ShieldCheck,
  accounting: BarChart3,
  settlement: FileCheck2,
};

function stepStatusIcon(status: JourneyStepStatus) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'active':
      return <Clock className="h-4 w-4 text-amber-500" />;
    case 'requires_review':
      return <AlertCircle className="h-4 w-4 text-amber-600" />;
    case 'pending':
      return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  }
}

function stepTextClass(status: JourneyStepStatus): string {
  switch (status) {
    case 'complete': return 'text-foreground';
    case 'active': return 'text-foreground font-medium';
    case 'requires_review': return 'text-amber-700';
    case 'pending': return 'text-muted-foreground/60';
  }
}

/* ─── Single step ────────────────────────────────────────────────────────── */
function JourneyStep({ step }: { step: CommercialJourneyStep }) {
  const Icon = STEP_ICONS[step.id] ?? FileText;
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">{stepStatusIcon(step.status)}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${stepTextClass(step.status)}`}>{step.label}</p>
        {step.detail && (
          <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Compact mode (participant card) ────────────────────────────────────── */

export type ParticipantCommercialJourneyCompactProps = {
  status: ParticipantWorkflowIntegrationStatus;
  onCTAClick?: () => void;
};

/**
 * Compact inline view — used inside participant cards.
 * Shows the current stage label and primary CTA.
 */
export function ParticipantCommercialJourneyCompact({
  status,
  onCTAClick,
}: ParticipantCommercialJourneyCompactProps) {
  const { stage, stageLabel, stageDescription, primaryCTA } = status;

  const stageClass =
    stage === 'complete'
      ? 'text-green-700 bg-green-50 border-green-200'
      : stage === 'awaiting_operator_review' || stage === 'ready_to_release'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : stage === 'supplier_onboarding' || stage === 'generating_invoice'
      ? 'text-blue-700 bg-blue-50 border-blue-200'
      : 'text-muted-foreground bg-muted/40 border-border';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${stageClass}`}
        >
          {stage === 'complete' && <CheckCircle2 className="h-3 w-3" />}
          {stage === 'awaiting_operator_review' && <AlertCircle className="h-3 w-3" />}
          {stageLabel}
        </span>
        {primaryCTA.actor === 'operator' && primaryCTA.isUrgent && (
          <button
            type="button"
            onClick={onCTAClick}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {primaryCTA.label}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {status.triggeredBy && (
        <p className="text-xs text-muted-foreground">{status.triggeredBy}</p>
      )}
    </div>
  );
}

/* ─── Full journey view ──────────────────────────────────────────────────── */

export type ParticipantCommercialJourneyFullProps = {
  status: ParticipantWorkflowIntegrationStatus;
  onCTAClick?: (destination: CommercialWorkflowCTA['destination']) => void;
};

/**
 * Full journey display with all 7 steps.
 * Used in operator review panels and settlement screens.
 */
export function ParticipantCommercialJourneyFull({
  status,
  onCTAClick,
}: ParticipantCommercialJourneyFullProps) {
  const { primaryCTA, stageDescription, journeySteps, operatorNotification } = status;

  return (
    <div className="space-y-4">
      {/* Notification banner */}
      {operatorNotification && operatorNotification.urgency === 'action_required' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">{operatorNotification.title}</p>
          <p className="text-xs text-amber-700 mt-0.5">{operatorNotification.message}</p>
        </div>
      )}

      {/* Journey steps */}
      <div className="space-y-3">
        {journeySteps.map((step) => (
          <JourneyStep key={step.id} step={step} />
        ))}
      </div>

      {/* Primary CTA */}
      {primaryCTA.actor === 'operator' && primaryCTA.destination !== 'none' && (
        <button
          type="button"
          onClick={() => onCTAClick?.(primaryCTA.destination)}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {primaryCTA.label}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
      {primaryCTA.actor === 'supplier' && (
        <div className="rounded-lg border bg-muted/30 p-3 text-center">
          <p className="text-sm text-muted-foreground">
            Waiting for supplier to complete onboarding.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Operator notification card ─────────────────────────────────────────── */

export type OperatorNotificationCardProps = {
  notification: NonNullable<ParticipantWorkflowIntegrationStatus['operatorNotification']>;
  onAction?: () => void;
};

/**
 * Standalone notification card for the operator queue.
 * Every notification has exactly one next action.
 */
export function OperatorNotificationCard({
  notification,
  onAction,
}: OperatorNotificationCardProps) {
  const urgencyClass =
    notification.urgency === 'action_required'
      ? 'border-amber-200 bg-amber-50'
      : notification.urgency === 'complete'
      ? 'border-green-200 bg-green-50'
      : 'border-border bg-card';

  return (
    <div className={`rounded-lg border p-4 ${urgencyClass}`}>
      <p className="text-sm font-semibold">{notification.title}</p>
      <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
      {notification.urgency === 'action_required' && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          {notification.nextAction}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
