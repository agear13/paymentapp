/**
 * Operator-facing design language — calm, explainable, release-safe phrasing.
 * Single source for UI copy; avoid technical / fintech / orchestration jargon.
 */

import type { ReleaseConfidenceLevel } from '@/lib/operations/explainability/types';

export const OPERATOR_LABELS = {
  safeToRelease: 'Settlement ready',
  releaseBlocked: 'Settlement not ready',
  awaitingFunding: 'Awaiting funding',
  participantSetup: 'Settlement confirmation pending',
  fundingConfirmed: 'Funding confirmed',
  releaseCanProceed: 'Ready for settlement',
  actionRequired: 'Setup needed before settlement',
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
      return 'Review before settlement';
    case 'LOW':
      return OPERATOR_LABELS.actionRequired;
    case 'BLOCKED':
      return OPERATOR_LABELS.releaseBlocked;
    default:
      return OPERATOR_LABELS.actionRequired;
  }
}

export const CONFIDENCE_HEADLINES: Record<ReleaseConfidenceLevel, string> = {
  HIGH: 'Settlement can proceed safely from current obligations and funding.',
  MEDIUM: 'Some obligations still need funding or participant setup.',
  LOW: 'Finish setup before settlement.',
  BLOCKED: 'Resolve setup items before settlement.',
};

export const WORKSPACE_PHASE_OPERATOR: Record<string, string> = {
  DRAFT: 'Setting up workspace',
  CONFIGURING: 'Setting up workspace',
  COLLECTING: 'Collecting revenue',
  COORDINATING: 'Coordinating obligations',
  READY_FOR_SETTLEMENT: 'Preparing settlement',
  ACTIVE: 'Releasing settlements',
  DEGRADED: 'Action required before settlement',
  ARCHIVED: 'Workspace archived',
};

export const PROJECT_PHASE_OPERATOR: Record<string, string> = {
  DRAFT: 'Setting up agreement',
  CONFIGURING: 'Setting up agreement',
  FUNDING_PENDING: 'Funding pending',
  ALLOCATIONS_PENDING: 'Allocations pending',
  OBLIGATIONS_PENDING: 'Obligations pending',
  READY_FOR_RELEASE: 'Settlement ready',
  RELEASE_IN_PROGRESS: 'Settlement in progress',
  SETTLING: 'Recently settling',
  SETTLED: 'Recently settled',
  BLOCKED: 'Settlement blocked',
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
    title: 'No obligations in this agreement yet',
    body: 'Obligations will appear here once participant earnings and funding are configured.',
    cta: 'Configure participant earnings',
  },
  releases: {
    title: 'No settlement releases yet',
    body: 'Settlement releases appear when obligations are funded and participant setup is complete.',
    cta: 'Review settlement readiness',
  },
  participantEarnings: {
    title: 'No team members added yet',
    body: 'Add the people who will earn from this agreement and set up how each gets paid. Everyone must approve before payments can flow.',
    cta: 'Add team member',
  },
  funding: {
    title: 'No funding activity yet',
    body: 'Funding tasks appear once revenue is collected or obligations are created for this agreement.',
    cta: 'Add revenue source',
  },
} as const;

/** Humanize internal terms for display */
export function humanizeOperatorText(text: string): string {
  return text
    .replace(/Release readiness/gi, OPERATOR_LABELS.safeToRelease)
    .replace(/operational release confidence degraded/gi, 'Settlement readiness reduced')
    .replace(/Participant compensation configuration incomplete/gi, 'Participant earnings still need setup')
    .replace(/Participant readiness/gi, OPERATOR_LABELS.participantSetup)
    .replace(/\bReady\b/g, OPERATOR_LABELS.safeToRelease)
    .replace(/\bBlocked\b/g, OPERATOR_LABELS.releaseBlocked)
    .replace(/Release blocked/gi, OPERATOR_LABELS.releaseBlocked)
    .replace(/Needs action/gi, OPERATOR_LABELS.actionRequired)
    .replace(/orchestration/gi, 'coordination')
    .replace(/obligation row/gi, 'obligation')
    .replace(/payout obligation/gi, 'obligation')
    .replace(/operational treasury/gi, 'funding status')
    .replace(/Payout onboarding/gi, 'Settlement confirmation')
    .replace(/payout verification required/gi, 'Settlement confirmation pending')
    .replace(/compliance incomplete/gi, 'Settlement confirmation pending')
    .replace(/Configure participant earnings before obligations/gi, 'Set up participant earnings first')
    .replace(/Agreement generated/gi, 'Ready to send')
    .replace(/Agreement viewed/gi, 'Opened by participant')
    .replace(/Settlement pending/gi, 'Waiting until payment is due')
    .replace(/\bInfrastructure\b/g, 'Payment provider')
    .replace(/payment infrastructure/gi, 'payment provider');
}
