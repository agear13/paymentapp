/**
 * Participant Commercial Lifecycle
 *
 * Canonical end-to-end lifecycle for commercial participant onboarding.
 * Replaces scattered payout-detail flags with stage-based workflow derivation.
 *
 * Stages reflect the real commercial relationship — payout details are never
 * requested before agreement acceptance.
 *
 * Extension points (`ParticipantLifecycleAiHooks`) allow future AI capabilities
 * without restructuring the workflow.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import {
  hasApprovedAgreement,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';
import { buildSupplierOnboardingInput } from '@/lib/commercial/build-supplier-onboarding-input';
import {
  hasParticipantIdentityReady,
  isPaymentRequestSent,
  isSettlementPaid,
  supplierLifecycle,
} from '@/lib/commercial/participant-lifecycle-primitives';
import { deriveParticipantWorkflows, deriveParticipantWorkflowBadges } from '@/lib/commercial/workflows/derive-participant-workflows';
import { mapLegacyParticipantLifecycleStage } from '@/lib/commercial/workflows/map-legacy-lifecycle-stage';

/* ─── Lifecycle stages ───────────────────────────────────────────────────── */

export const PARTICIPANT_COMMERCIAL_LIFECYCLE_STAGES = [
  'DRAFT',
  'EARNINGS_CONFIGURED',
  'AGREEMENT_SENT',
  'AGREEMENT_ACCEPTED',
  'PAYMENT_INFO_PENDING',
  'PAYMENT_INFO_SUBMITTED',
  'OPERATOR_REVIEW',
  'XERO_INVOICE',
  'SETTLEMENT_READY',
  'PAID',
] as const;

export type ParticipantCommercialLifecycleStage =
  (typeof PARTICIPANT_COMMERCIAL_LIFECYCLE_STAGES)[number];

export const LIFECYCLE_STAGE_LABELS: Record<ParticipantCommercialLifecycleStage, string> = {
  DRAFT: 'Participant added',
  EARNINGS_CONFIGURED: 'Earnings configured',
  AGREEMENT_SENT: 'Agreement sent',
  AGREEMENT_ACCEPTED: 'Agreement accepted',
  PAYMENT_INFO_PENDING: 'Payment information pending',
  PAYMENT_INFO_SUBMITTED: 'Payment information submitted',
  OPERATOR_REVIEW: 'Operator review',
  XERO_INVOICE: 'Invoice created',
  SETTLEMENT_READY: 'Settlement ready',
  PAID: 'Paid',
};

/** Operator-facing status chip on participant rows and cards. */
export const PARTICIPANT_STATUS_DISPLAY: Record<ParticipantCommercialLifecycleStage, string> = {
  DRAFT: 'Configure Earnings',
  EARNINGS_CONFIGURED: 'Send Agreement',
  AGREEMENT_SENT: 'Waiting for Acceptance',
  AGREEMENT_ACCEPTED: 'Request Payout Details',
  PAYMENT_INFO_PENDING: 'Waiting for Participant',
  PAYMENT_INFO_SUBMITTED: 'Verify Payout Details',
  OPERATOR_REVIEW: 'Verify Payout Details',
  XERO_INVOICE: 'Push Supplier Bill to Xero',
  SETTLEMENT_READY: 'Ready for Settlement',
  PAID: 'Paid',
};

export function formatParticipantStatusLabel(
  stage: ParticipantCommercialLifecycleStage
): string {
  return PARTICIPANT_STATUS_DISPLAY[stage];
}

export const LIFECYCLE_STAGE_OPERATOR_LABELS: Record<ParticipantCommercialLifecycleStage, string> = {
  DRAFT: 'Configure Earnings',
  EARNINGS_CONFIGURED: 'Agreement Sent',
  AGREEMENT_SENT: 'Waiting for Acceptance',
  AGREEMENT_ACCEPTED: 'Payout Details Requested',
  PAYMENT_INFO_PENDING: 'Waiting for Participant',
  PAYMENT_INFO_SUBMITTED: 'Verify Payout Details',
  OPERATOR_REVIEW: 'Verify Payout Details',
  XERO_INVOICE: 'Supplier Bill Exported',
  SETTLEMENT_READY: 'Ready for Settlement',
  PAID: 'Paid',
};

export const LIFECYCLE_TIMELINE_STEPS: readonly {
  stage: ParticipantCommercialLifecycleStage;
  label: string;
}[] = [
  { stage: 'DRAFT', label: 'Configure Earnings' },
  { stage: 'EARNINGS_CONFIGURED', label: 'Agreement Sent' },
  { stage: 'AGREEMENT_SENT', label: 'Waiting for Acceptance' },
  { stage: 'AGREEMENT_ACCEPTED', label: 'Payout Details Requested' },
  { stage: 'PAYMENT_INFO_PENDING', label: 'Waiting for Participant' },
  { stage: 'OPERATOR_REVIEW', label: 'Verify Payout Details' },
  { stage: 'XERO_INVOICE', label: 'Supplier Bill Exported' },
  { stage: 'SETTLEMENT_READY', label: 'Ready for Settlement' },
  { stage: 'PAID', label: 'Paid' },
];

/* ─── AI extension hooks (future) ────────────────────────────────────────── */

export type ParticipantLifecycleAiHooks = {
  detectMissingTaxInfo?: (participant: DemoParticipant) => string[] | null;
  recommendPaymentMethod?: (participant: DemoParticipant) => string | null;
  flagUnusualPaymentDestination?: (participant: DemoParticipant) => string | null;
  explainGstImplications?: (participant: DemoParticipant) => string | null;
  autoDraftInvoice?: (participant: DemoParticipant) => unknown;
  autoCheckAbnValidity?: (abn: string) => Promise<boolean>;
  detectAgreementPaymentMismatch?: (participant: DemoParticipant) => string | null;
};

/* ─── Derivation helpers ─────────────────────────────────────────────────── */

export type PaymentRequestPortalStatus =
  | 'not_yet_opened'
  | 'opened'
  | 'payment_information_submitted';

export function derivePaymentRequestPortalStatus(
  participant: DemoParticipant
): PaymentRequestPortalStatus {
  const submitted =
    participant.supplierOnboarding?.submission?.submittedAt ||
    participant.supplierOnboarding?.lifecycle === 'SUBMITTED' ||
    participant.supplierOnboarding?.lifecycle === 'UNDER_REVIEW' ||
    participant.supplierOnboarding?.lifecycle === 'APPROVED';
  if (submitted) return 'payment_information_submitted';
  if (participant.paymentSetup?.portalFirstOpenedAt) return 'opened';
  return 'not_yet_opened';
}

export function buildParticipantPaymentPortalUrl(
  participant: DemoParticipant,
  origin?: string
): string | null {
  const token = participant.paymentSetup?.token;
  if (!token) return null;
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? '');
  return `${base}/payment-setup/${token}`;
}

/** Participant record and role are required before agreements. Delivery channels validate contact details separately. */
export { hasParticipantIdentityReady, isPaymentRequestSent, isSettlementPaid } from '@/lib/commercial/participant-lifecycle-primitives';

/**
 * Derive the canonical commercial lifecycle stage for a participant.
 * Pure function — no side effects.
 *
 * Composes independent commercial, settlement, and accounting workflows via
 * `mapLegacyParticipantLifecycleStage` so existing UI keeps stable stage labels.
 */
export function deriveParticipantCommercialLifecycle(
  participant: DemoParticipant
): ParticipantCommercialLifecycleStage {
  const workflows = deriveParticipantWorkflows(participant);
  return mapLegacyParticipantLifecycleStage(participant, workflows);
}

export function lifecycleStageIndex(stage: ParticipantCommercialLifecycleStage): number {
  return PARTICIPANT_COMMERCIAL_LIFECYCLE_STAGES.indexOf(stage);
}

export function isLifecycleStageComplete(
  current: ParticipantCommercialLifecycleStage,
  target: ParticipantCommercialLifecycleStage
): boolean {
  return lifecycleStageIndex(current) > lifecycleStageIndex(target);
}

export function isLifecycleStageAtOrPast(
  current: ParticipantCommercialLifecycleStage,
  target: ParticipantCommercialLifecycleStage
): boolean {
  return lifecycleStageIndex(current) >= lifecycleStageIndex(target);
}

/* ─── Operator next action ───────────────────────────────────────────────── */

export type ParticipantWorkflowReadiness = 'blocked' | 'waiting' | 'ready' | 'complete';

export type ParticipantWorkflowCtaDestination =
  | 'configure_earnings'
  | 'send_agreement'
  | 'await_participant'
  | 'send_payment_request'
  | 'review_payment'
  | 'xero_export'
  | 'settlement'
  | 'none';

export type ParticipantWorkflowCtaKind =
  | 'configure_earnings'
  | 'send_agreement'
  | 'waiting_participant'
  | 'request_payout_details'
  | 'verify_payout_details'
  | 'push_to_xero'
  | 'ready_for_settlement'
  | 'completed'
  | 'none';

export type ParticipantWorkflowCta = {
  kind: ParticipantWorkflowCtaKind;
  label: string;
  destination: ParticipantWorkflowCtaDestination;
  urgency: 'none' | 'attention' | 'action_required';
  buttonVariant: 'default' | 'outline';
};

export type ParticipantWorkflowIntegrityIssue = {
  field: 'name' | 'email' | 'role' | 'compensationProfile';
  severity: 'warning' | 'blocker';
  message: string;
};

export type ParticipantOperationalWorkflow = {
  stage: ParticipantCommercialLifecycleStage;
  badge: string;
  statusText: string;
  explanation: string;
  readiness: ParticipantWorkflowReadiness;
  progress: {
    currentStep: number;
    totalSteps: number;
    percent: number;
  };
  primaryCta: ParticipantWorkflowCta;
  secondaryCtas: ParticipantWorkflowCta[];
  integrityIssues: ParticipantWorkflowIntegrityIssue[];
};

const WORKFLOW_STAGE_ORDER: ParticipantCommercialLifecycleStage[] = [
  'DRAFT',
  'EARNINGS_CONFIGURED',
  'AGREEMENT_SENT',
  'AGREEMENT_ACCEPTED',
  'PAYMENT_INFO_PENDING',
  'PAYMENT_INFO_SUBMITTED',
  'XERO_INVOICE',
  'SETTLEMENT_READY',
  'PAID',
];

const WORKFLOW_STAGE_CONFIG: Record<
  ParticipantCommercialLifecycleStage,
  Omit<ParticipantOperationalWorkflow, 'stage' | 'explanation' | 'progress' | 'integrityIssues'>
> = {
  DRAFT: {
    badge: 'Configure Earnings',
    statusText: 'Earnings not configured',
    readiness: 'blocked',
    primaryCta: {
      kind: 'configure_earnings',
      label: 'Configure Earnings',
      destination: 'configure_earnings',
      urgency: 'action_required',
      buttonVariant: 'outline',
    },
    secondaryCtas: [],
  },
  EARNINGS_CONFIGURED: {
    badge: 'Agreement Ready',
    statusText: 'Agreement not sent',
    readiness: 'ready',
    primaryCta: {
      kind: 'send_agreement',
      label: 'Send Agreement',
      destination: 'send_agreement',
      urgency: 'action_required',
      buttonVariant: 'default',
    },
    secondaryCtas: [],
  },
  AGREEMENT_SENT: {
    badge: 'Waiting for Acceptance',
    statusText: 'Agreement pending',
    readiness: 'waiting',
    primaryCta: {
      kind: 'waiting_participant',
      label: 'Waiting for Acceptance',
      destination: 'await_participant',
      urgency: 'attention',
      buttonVariant: 'outline',
    },
    secondaryCtas: [],
  },
  AGREEMENT_ACCEPTED: {
    badge: 'Agreement Accepted',
    statusText: 'Payout details missing',
    readiness: 'ready',
    primaryCta: {
      kind: 'request_payout_details',
      label: 'Request Payout Details',
      destination: 'send_payment_request',
      urgency: 'action_required',
      buttonVariant: 'default',
    },
    secondaryCtas: [],
  },
  PAYMENT_INFO_PENDING: {
    badge: 'Waiting for Participant',
    statusText: 'Payout request sent',
    readiness: 'waiting',
    primaryCta: {
      kind: 'waiting_participant',
      label: 'Waiting for Participant',
      destination: 'await_participant',
      urgency: 'attention',
      buttonVariant: 'outline',
    },
    secondaryCtas: [],
  },
  PAYMENT_INFO_SUBMITTED: {
    badge: 'Verify Payout Details',
    statusText: 'Payout details submitted',
    readiness: 'ready',
    primaryCta: {
      kind: 'verify_payout_details',
      label: 'Verify Payout Details',
      destination: 'review_payment',
      urgency: 'action_required',
      buttonVariant: 'default',
    },
    secondaryCtas: [],
  },
  OPERATOR_REVIEW: {
    badge: 'Verify Payout Details',
    statusText: 'Payout details submitted',
    readiness: 'ready',
    primaryCta: {
      kind: 'verify_payout_details',
      label: 'Verify Payout Details',
      destination: 'review_payment',
      urgency: 'action_required',
      buttonVariant: 'default',
    },
    secondaryCtas: [],
  },
  XERO_INVOICE: {
    badge: 'Ready for Xero',
    statusText: 'Commercial data complete',
    readiness: 'ready',
    primaryCta: {
      kind: 'push_to_xero',
      label: 'Push Supplier Bill to Xero',
      destination: 'xero_export',
      urgency: 'action_required',
      buttonVariant: 'default',
    },
    secondaryCtas: [],
  },
  SETTLEMENT_READY: {
    badge: 'Ready for Settlement',
    statusText: 'Supplier bill created',
    readiness: 'complete',
    primaryCta: {
      kind: 'ready_for_settlement',
      label: 'Release Settlement',
      destination: 'settlement',
      urgency: 'none',
      buttonVariant: 'outline',
    },
    secondaryCtas: [],
  },
  PAID: {
    badge: 'Paid',
    statusText: 'Settlement completed',
    readiness: 'complete',
    primaryCta: {
      kind: 'completed',
      label: 'Paid',
      destination: 'none',
      urgency: 'none',
      buttonVariant: 'outline',
    },
    secondaryCtas: [],
  },
};

function workflowStageOrderIndex(stage: ParticipantCommercialLifecycleStage): number {
  const index = WORKFLOW_STAGE_ORDER.indexOf(stage);
  if (index >= 0) return index;
  if (stage === 'OPERATOR_REVIEW') return WORKFLOW_STAGE_ORDER.indexOf('PAYMENT_INFO_SUBMITTED');
  return 0;
}

function workflowExplanation(
  stage: ParticipantCommercialLifecycleStage,
  name: string
): string {
  switch (stage) {
    case 'DRAFT':
      return `${name} needs earnings configuration before an agreement can be sent.`;
    case 'EARNINGS_CONFIGURED':
      return `${name} is ready for the commercial agreement to be sent.`;
    case 'AGREEMENT_SENT':
      return `Agreement sent to ${name}. Waiting for acceptance.`;
    case 'AGREEMENT_ACCEPTED':
      return `${name} accepted the agreement. Request payout and tax details next.`;
    case 'PAYMENT_INFO_PENDING':
      return `Payout request sent to ${name}. Waiting for participant submission.`;
    case 'PAYMENT_INFO_SUBMITTED':
    case 'OPERATOR_REVIEW':
      return `${name} submitted payout details. Verify them before exporting to Xero.`;
    case 'XERO_INVOICE':
      return `${name}'s commercial data is complete. Push the supplier bill to Xero.`;
    case 'SETTLEMENT_READY':
      return `${name}'s supplier bill is in Xero and they are ready for settlement.`;
    case 'PAID':
      return `${name} has been paid.`;
    default:
      return '';
  }
}

function deriveOperationalIntegrityIssues(
  participant: DemoParticipant,
  stage: ParticipantCommercialLifecycleStage
): ParticipantWorkflowIntegrityIssue[] {
  if (workflowStageOrderIndex(stage) < workflowStageOrderIndex('AGREEMENT_ACCEPTED')) return [];

  const issues: ParticipantWorkflowIntegrityIssue[] = [];
  if (!participant.name?.trim()) {
    issues.push({
      field: 'name',
      severity: 'warning',
      message: 'Participant name missing. Review before settlement.',
    });
  }
  if (!participant.email?.trim()) {
    issues.push({
      field: 'email',
      severity: 'warning',
      message: 'Participant email missing. Agreement may have been accepted via shared link.',
    });
  }
  if (!participant.role?.trim()) {
    issues.push({
      field: 'role',
      severity: 'warning',
      message: 'Participant role missing. Review before settlement.',
    });
  }
  if (
    !isParticipantCompensationExempt(participant) &&
    !isParticipantEarningsConfigured(participant)
  ) {
    issues.push({
      field: 'compensationProfile',
      severity: 'warning',
      message: 'Compensation profile missing. Review before settlement.',
    });
  }
  return issues;
}

export function deriveParticipantOperationalWorkflow(
  participant: DemoParticipant
): ParticipantOperationalWorkflow {
  const stage = deriveParticipantCommercialLifecycle(participant);
  const name = participant.name?.trim() || 'Participant';
  const currentIndex = workflowStageOrderIndex(stage);
  const totalSteps = WORKFLOW_STAGE_ORDER.length;
  const config = WORKFLOW_STAGE_CONFIG[stage];

  return {
    stage,
    ...config,
    explanation: workflowExplanation(stage, name),
    integrityIssues: deriveOperationalIntegrityIssues(participant, stage),
    progress: {
      currentStep: currentIndex + 1,
      totalSteps,
      percent: Math.round(((currentIndex + 1) / totalSteps) * 100),
    },
  };
}

export type ParticipantLifecycleAction = {
  label: string;
  description: string;
  urgency: 'none' | 'attention' | 'action_required';
  destination:
    | 'configure_earnings'
    | 'send_agreement'
    | 'await_participant'
    | 'send_payment_request'
    | 'share_payment_request'
    | 'review_payment'
    | 'xero_export'
    | 'settlement'
    | 'none';
};

export function deriveParticipantLifecycleAction(
  participant: DemoParticipant
): ParticipantLifecycleAction {
  const workflow = deriveParticipantOperationalWorkflow(participant);
  return {
    label: workflow.primaryCta.label,
    description: workflow.explanation,
    urgency: workflow.primaryCta.urgency,
    destination: workflow.primaryCta.destination,
  };
}

/** Whether payout / payment details should surface in UI for this participant. */
export function shouldRequestPayoutDetails(participant: DemoParticipant): boolean {
  return isLifecycleStageAtOrPast(
    deriveParticipantCommercialLifecycle(participant),
    'AGREEMENT_ACCEPTED'
  );
}

/* ─── Operator table presentation (single source for row columns) ─────────── */

export type ParticipantCommercialTablePrimaryActionKind =
  | 'send_payment_request'
  | 'review_payment'
  | 'configure_earnings'
  | 'send_agreement'
  | 'xero_export'
  | 'settlement'
  | 'none';

export type ParticipantTableNextActionKind =
  | 'configure_earnings'
  | 'generate_agreement'
  | 'share_payment_request'
  | 'review_submission'
  | 'push_to_xero'
  | 'waiting_participant'
  | 'ready_for_settlement'
  | 'completed'
  | 'none';

export type ParticipantTableNextAction = {
  kind: ParticipantTableNextActionKind;
  label: string;
  buttonVariant: 'default' | 'outline';
};

export type ParticipantCommercialTablePrimaryAction = {
  kind: ParticipantCommercialTablePrimaryActionKind;
  label: string;
};

function deriveAgreementTableLabel(participant: DemoParticipant): {
  label: string;
  hint: string | null;
} {
  const stage = deriveParticipantCommercialLifecycle(participant);
  if (hasApprovedAgreement(participant)) {
    return { label: 'Accepted', hint: null };
  }
  if (stage === 'AGREEMENT_SENT') {
    return { label: 'Sent', hint: null };
  }
  if (stage === 'EARNINGS_CONFIGURED') {
    return { label: 'Ready to send', hint: null };
  }
  if (stage === 'DRAFT') {
    const hint =
      !isParticipantEarningsConfigured(participant) && !isParticipantCompensationExempt(participant)
        ? 'Configure earnings first'
        : !participant.id?.trim() || !participant.role?.trim()
          ? 'Complete participant details'
          : null;
    return { label: 'Draft', hint };
  }
  return { label: 'Draft', hint: null };
}

export function deriveParticipantCommercialTableNextAction(
  participant: DemoParticipant
): ParticipantTableNextAction {
  const workflow = deriveParticipantOperationalWorkflow(participant);
  const kindByWorkflow: Record<ParticipantWorkflowCtaKind, ParticipantTableNextActionKind> = {
    configure_earnings: 'configure_earnings',
    send_agreement: 'generate_agreement',
    waiting_participant: 'waiting_participant',
    request_payout_details: 'share_payment_request',
    verify_payout_details: 'review_submission',
    push_to_xero: 'push_to_xero',
    ready_for_settlement: 'ready_for_settlement',
    completed: 'completed',
    none: 'none',
  };

  return {
    kind: kindByWorkflow[workflow.primaryCta.kind],
    label: workflow.primaryCta.label,
    buttonVariant: workflow.primaryCta.buttonVariant,
  };
}

export function deriveParticipantCommercialTablePrimaryAction(
  participant: DemoParticipant
): ParticipantCommercialTablePrimaryAction {
  const workflow = deriveParticipantOperationalWorkflow(participant);
  const kindByDestination: Record<
    ParticipantWorkflowCtaDestination,
    ParticipantCommercialTablePrimaryActionKind
  > = {
    configure_earnings: 'configure_earnings',
    send_agreement: 'send_agreement',
    await_participant: 'none',
    send_payment_request: 'send_payment_request',
    review_payment: 'review_payment',
    xero_export: 'xero_export',
    settlement: 'settlement',
    none: 'none',
  };

  return {
    kind: kindByDestination[workflow.primaryCta.destination],
    label: workflow.primaryCta.urgency === 'none' ? '' : workflow.primaryCta.label,
  };
}

export type ParticipantCommercialTablePresentation = {
  stage: ParticipantCommercialLifecycleStage;
  workflow: ParticipantOperationalWorkflow;
  agreementChip: string;
  agreementSecondary: string;
  commercialChip: string;
  commercialSecondary: string;
  /** Independent workflow dimensions (commercial / settlement / accounting). */
  workflowBadges: {
    commercialStatus: string;
    settlementStatus: string;
    accountingStatus: string;
  };
  payoutColumnActive: boolean;
  primaryAction: ParticipantCommercialTablePrimaryAction;
  nextAction: ParticipantTableNextAction;
};

export function deriveParticipantCommercialTablePresentation(
  participant: DemoParticipant
): ParticipantCommercialTablePresentation {
  const workflow = deriveParticipantOperationalWorkflow(participant);
  const stage = workflow.stage;
  const payoutColumnActive = isLifecycleStageAtOrPast(stage, 'AGREEMENT_ACCEPTED');
  const agreement = deriveAgreementTableLabel(participant);
  const commercialLabel = workflow.badge;
  const commercialSecondary = workflow.integrityIssues.map((issue) => issue.message).join(' ');
  const nextAction = deriveParticipantCommercialTableNextAction(participant);
  const primaryAction = deriveParticipantCommercialTablePrimaryAction(participant);
  const workflowBadges = deriveParticipantWorkflowBadges(participant);

  return {
    stage,
    workflow,
    agreementChip: agreement.label,
    agreementSecondary: agreement.hint ?? '',
    commercialChip: commercialLabel,
    commercialSecondary,
    workflowBadges,
    payoutColumnActive,
    primaryAction,
    nextAction,
  };
}

/* ─── Workspace notifications ────────────────────────────────────────────── */

export type WorkspaceLifecycleNotification = {
  stage: ParticipantCommercialLifecycleStage;
  count: number;
  message: string;
  urgency: 'none' | 'attention' | 'action_required';
  destination: ParticipantLifecycleAction['destination'];
};

export type WorkspaceLifecycleSummary = {
  notifications: WorkspaceLifecycleNotification[];
  primaryNotification: WorkspaceLifecycleNotification | null;
  byStage: Record<ParticipantCommercialLifecycleStage, number>;
  participants: Array<{
    id: string;
    name: string;
    stage: ParticipantCommercialLifecycleStage;
    action: ParticipantLifecycleAction;
  }>;
};

const NOTIFICATION_PRIORITY: ParticipantCommercialLifecycleStage[] = [
  'DRAFT',
  'EARNINGS_CONFIGURED',
  'AGREEMENT_SENT',
  'OPERATOR_REVIEW',
  'PAYMENT_INFO_SUBMITTED',
  'AGREEMENT_ACCEPTED',
  'PAYMENT_INFO_PENDING',
  'XERO_INVOICE',
  'SETTLEMENT_READY',
  'PAID',
];

function notificationMessage(stage: ParticipantCommercialLifecycleStage, count: number): string {
  const n = count;
  const plural = n !== 1;
  switch (stage) {
    case 'DRAFT':
      return `${n} participant${plural ? 's' : ''} require earnings configuration`;
    case 'EARNINGS_CONFIGURED':
      return `${n} agreement${plural ? 's' : ''} ready to send`;
    case 'AGREEMENT_SENT':
      return `${n} agreement${plural ? 's' : ''} awaiting acceptance`;
    case 'AGREEMENT_ACCEPTED':
      return `Payment requests ready to send (${n})`;
    case 'PAYMENT_INFO_PENDING':
      return `Payment requests awaiting participant response (${n})`;
    case 'PAYMENT_INFO_SUBMITTED':
    case 'OPERATOR_REVIEW':
      return `${n} payment profile${plural ? 's' : ''} awaiting operator review`;
    case 'XERO_INVOICE':
      return `${n} participant${plural ? 's' : ''} ready for invoicing`;
    case 'SETTLEMENT_READY':
      return `${n} settlement${plural ? 's' : ''} ready`;
    case 'PAID':
      return `${n} participant${plural ? 's' : ''} paid`;
    default:
      return '';
  }
}

function notificationUrgency(stage: ParticipantCommercialLifecycleStage): WorkspaceLifecycleNotification['urgency'] {
  if (stage === 'SETTLEMENT_READY' || stage === 'PAID') return 'none';
  if (stage === 'AGREEMENT_SENT' || stage === 'PAYMENT_INFO_PENDING') {
    return 'attention';
  }
  if (stage === 'AGREEMENT_ACCEPTED') {
    return 'action_required';
  }
  return 'action_required';
}

export function deriveWorkspaceLifecycleSummary(
  participants: DemoParticipant[]
): WorkspaceLifecycleSummary {
  const byStage = Object.fromEntries(
    PARTICIPANT_COMMERCIAL_LIFECYCLE_STAGES.map((s) => [s, 0])
  ) as Record<ParticipantCommercialLifecycleStage, number>;

  const mapped = participants.map((p) => {
    const stage = deriveParticipantCommercialLifecycle(p);
    byStage[stage] += 1;
    return {
      id: p.id,
      name: p.name,
      stage,
      action: deriveParticipantLifecycleAction(p),
    };
  });

  const notifications: WorkspaceLifecycleNotification[] = [];
  for (const stage of NOTIFICATION_PRIORITY) {
    const count = byStage[stage];
    if (count === 0) continue;
    const sample = mapped.find((m) => m.stage === stage);
    notifications.push({
      stage,
      count,
      message: notificationMessage(stage, count),
      urgency: notificationUrgency(stage),
      destination: sample?.action.destination ?? 'none',
    });
  }

  const primaryNotification =
    notifications.find((n) => n.urgency === 'action_required') ??
    notifications.find((n) => n.urgency === 'attention') ??
    null;

  return { notifications, primaryNotification, byStage, participants: mapped };
}

/* ─── Agreement summary input ────────────────────────────────────────────── */

export type AgreementSummaryData = {
  role: string;
  commercialAgreement: string;
  paymentStructure: string;
  paymentSchedule: string;
  agreedPayoutDate: string | null;
  acceptedDate: string | null;
  obligationsSummary: string;
  projectName: string;
  participantName: string;
};

export function buildAgreementSummaryData(
  participant: DemoParticipant,
  deal?: { id: string; name: string }
): AgreementSummaryData {
  const input = deal
    ? buildSupplierOnboardingInput(participant, deal)
    : null;
  const profile = participant.compensationProfile;
  const commissionKind = participant.commissionKind ?? 'fixed_amount';

  let paymentStructure = 'Not configured';
  if (profile?.compensationType === 'REVENUE_SHARE' || commissionKind === 'pct_deal_value') {
    paymentStructure = `Revenue share — ${participant.commissionValue ?? profile?.percentage ?? 0}%`;
  } else if (profile?.compensationType === 'COMMISSION') {
    paymentStructure = `Commission — ${participant.commissionValue ?? 0}`;
  } else if (profile?.compensationType === 'FIXED_FEE' || commissionKind === 'fixed_amount') {
    paymentStructure = `Fixed payment — ${participant.commissionValue ?? profile?.fixedAmount ?? 0}`;
  } else if (profile?.compensationType === 'HYBRID') {
    paymentStructure = 'Hybrid — fixed + variable components';
  } else if (isParticipantCompensationExempt(participant)) {
    paymentStructure = 'Unpaid / internal — no payout';
  }

  const schedule = participant.payoutCondition?.trim() || profile?.notes?.trim() || 'Per commercial agreement terms';
  const payoutDate = participant.payoutDueDate ?? input?.obligation.dueDate ?? null;

  return {
    role: participant.role,
    commercialAgreement: deal?.name ?? input?.agreement.projectName ?? 'Commercial participation agreement',
    paymentStructure,
    paymentSchedule: schedule,
    agreedPayoutDate: payoutDate,
    acceptedDate: participant.approvedAt ?? input?.agreement.approvedAt ?? null,
    obligationsSummary:
      input?.obligation.description ??
      `${participant.role} services — ${deal?.name ?? 'project'}`,
    projectName: deal?.name ?? input?.agreement.projectName ?? '',
    participantName: participant.name,
  };
}

/* ─── Migration / backfill ───────────────────────────────────────────────── */

/**
 * Infer lifecycle stage for existing records without persisted commercialLifecycle.
 * Used for display only — does not mutate storage.
 */
export function inferLegacyCommercialLifecycle(
  participant: DemoParticipant
): ParticipantCommercialLifecycleStage {
  return deriveParticipantCommercialLifecycle(participant);
}
