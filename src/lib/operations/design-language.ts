/**
 * Operator-facing design language — calm, explainable, release-safe phrasing.
 * Single source for UI copy; avoid technical / fintech / orchestration jargon.
 */

import type { ReleaseConfidenceLevel } from '@/lib/operations/explainability/types';

export const OPERATOR_LABELS = {
  safeToRelease: 'Safe to release',
  releaseBlocked: 'Release blocked',
  awaitingFunding: 'Awaiting funding',
  participantSetup: 'Participant payout setup',
  fundingConfirmed: 'Funding confirmed',
  releaseCanProceed: 'Release can proceed safely',
  actionRequired: 'Action required before release',
  needsAttention: 'Needs attention',
  fundingPending: 'Funding pending',
  participantsIncomplete: 'Participants incomplete',
} as const;

/** Replace abstract readiness language */
export function labelSafeToRelease(confidence: ReleaseConfidenceLevel): string {
  switch (confidence) {
    case 'HIGH':
      return OPERATOR_LABELS.releaseCanProceed;
    case 'MEDIUM':
      return 'Review before release';
    case 'LOW':
      return OPERATOR_LABELS.actionRequired;
    case 'BLOCKED':
      return OPERATOR_LABELS.releaseBlocked;
    default:
      return OPERATOR_LABELS.actionRequired;
  }
}

export const CONFIDENCE_HEADLINES: Record<ReleaseConfidenceLevel, string> = {
  HIGH: 'Most payouts can now be safely coordinated.',
  MEDIUM: 'Some payouts remain blocked pending funding or participant setup.',
  LOW: 'Setup is incomplete before payouts can be released.',
  BLOCKED: 'Release blocked until critical issues are resolved.',
};

export const WORKSPACE_PHASE_OPERATOR: Record<string, string> = {
  DRAFT: 'Setting up workspace',
  CONFIGURING: 'Setting up workspace',
  COLLECTING: 'Collecting revenue',
  COORDINATING: 'Coordinating payouts',
  READY_FOR_SETTLEMENT: 'Preparing payout release',
  ACTIVE: 'Releasing settlements',
  DEGRADED: 'Action required before release',
  ARCHIVED: 'Workspace archived',
};

export const PROJECT_PHASE_OPERATOR: Record<string, string> = {
  DRAFT: 'Setting up project',
  CONFIGURING: 'Setting up project',
  FUNDING_PENDING: 'Funding pending',
  ALLOCATIONS_PENDING: 'Allocations pending',
  OBLIGATIONS_PENDING: 'Payout obligations pending',
  READY_FOR_RELEASE: 'Safe to release',
  RELEASE_IN_PROGRESS: 'Release in progress',
  SETTLING: 'Recently settling',
  SETTLED: 'Recently settled',
  BLOCKED: 'Release blocked',
  ARCHIVED: 'Archived',
};

export const SEVERITY_TONE = {
  CRITICAL: {
    label: 'Critical',
    border: 'border-red-500/25',
    text: 'text-red-900 dark:text-red-300',
    bg: 'bg-red-500/5',
  },
  ACTION_REQUIRED: {
    label: 'Action required',
    border: 'border-amber-500/25',
    text: 'text-amber-900 dark:text-amber-300',
    bg: 'bg-amber-500/5',
  },
  WARNING: {
    label: 'Warning',
    border: 'border-amber-500/20',
    text: 'text-amber-800/90 dark:text-amber-400/90',
    bg: 'bg-amber-500/5',
  },
  INFORMATIONAL: {
    label: 'Update',
    border: 'border-border/60',
    text: 'text-muted-foreground',
    bg: 'bg-transparent',
  },
} as const;

export const EMPTY_STATE_COPY = {
  obligations: {
    title: 'No payout obligations yet',
    body: 'Customer payments will create payout obligations automatically.',
    cta: 'View payment activity',
  },
  releases: {
    title: 'No payout releases yet',
    body: 'Create your first payout release once funding and participant setup are complete.',
    cta: 'Review safe to release',
  },
  participantEarnings: {
    title: 'No participant earnings yet',
    body: 'Participant earnings will appear after you configure how each person earns.',
    cta: 'Configure participant earnings',
  },
  funding: {
    title: 'No funding sources yet',
    body: 'Add invoices or payment links so customer revenue can fund payouts.',
    cta: 'Add revenue',
  },
} as const;

/** Humanize internal terms for display */
export function humanizeOperatorText(text: string): string {
  return text
    .replace(/Release readiness/gi, OPERATOR_LABELS.safeToRelease)
    .replace(/Participant readiness/gi, OPERATOR_LABELS.participantSetup)
    .replace(/\bReady\b/g, OPERATOR_LABELS.safeToRelease)
    .replace(/\bBlocked\b/g, OPERATOR_LABELS.releaseBlocked)
    .replace(/Needs action/gi, OPERATOR_LABELS.actionRequired)
    .replace(/orchestration/gi, 'coordination')
    .replace(/obligation row/gi, 'payout obligation')
    .replace(/operational treasury/gi, 'funding status');
}
