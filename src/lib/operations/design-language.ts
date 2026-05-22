/**
 * Operator-facing design language — calm, explainable, release-safe phrasing.
 * Single source for UI copy; avoid technical / fintech / orchestration jargon.
 */

import type { ReleaseConfidenceLevel } from '@/lib/operations/explainability/types';

export const OPERATOR_LABELS = {
  safeToRelease: 'Safe to release',
  releaseBlocked: 'Release not ready',
  awaitingFunding: 'Awaiting funding',
  participantSetup: 'Participant payout setup',
  fundingConfirmed: 'Funding confirmed',
  releaseCanProceed: 'Ready to release safely',
  actionRequired: 'Setup needed before release',
  needsAttention: 'Needs attention',
  fundingPending: 'Funding pending',
  participantsIncomplete: 'Participants need setup',
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
  HIGH: 'Payouts can be coordinated safely from current funding and setup.',
  MEDIUM: 'Some payouts still need funding or participant setup.',
  LOW: 'Finish setup before releasing payouts.',
  BLOCKED: 'Resolve setup items before payout release.',
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
    title: 'No payout obligations in this project yet',
    body: 'Participant payout obligations will appear here once earnings and funding are configured.',
    cta: 'Configure participant earnings',
  },
  releases: {
    title: 'No payout releases yet',
    body: 'Releases appear when obligations are funded and participant setup is complete.',
    cta: 'Review payout readiness',
  },
  participantEarnings: {
    title: 'No participants yet',
    body: 'Add participants, then define how each earns. This unlocks obligations and payout release.',
    cta: 'Add participant',
  },
  funding: {
    title: 'No funding activity yet',
    body: 'Funding tasks appear once customer payments or obligations are created for this project.',
    cta: 'Add revenue source',
  },
} as const;

/** Humanize internal terms for display */
export function humanizeOperatorText(text: string): string {
  return text
    .replace(/Release readiness/gi, OPERATOR_LABELS.safeToRelease)
    .replace(/operational release confidence degraded/gi, 'Release safety reduced')
    .replace(/Participant compensation configuration incomplete/gi, 'Participant earnings still need setup')
    .replace(/Participant readiness/gi, OPERATOR_LABELS.participantSetup)
    .replace(/\bReady\b/g, OPERATOR_LABELS.safeToRelease)
    .replace(/\bBlocked\b/g, OPERATOR_LABELS.releaseBlocked)
    .replace(/Release blocked/gi, OPERATOR_LABELS.releaseBlocked)
    .replace(/Needs action/gi, OPERATOR_LABELS.actionRequired)
    .replace(/orchestration/gi, 'coordination')
    .replace(/obligation row/gi, 'payout obligation')
    .replace(/operational treasury/gi, 'funding status')
    .replace(/Configure participant earnings before obligations/gi, 'Set up participant earnings first');
}
