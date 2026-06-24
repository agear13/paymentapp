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
import {
  deriveLifecycle,
  type SupplierOnboardingLifecycle,
  type StoredOnboardingState,
} from '@/lib/commercial/supplier-onboarding-domain';
import { buildSupplierOnboardingInput } from '@/lib/commercial/build-supplier-onboarding-input';

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
};

/** Operator-facing status chip on participant rows and cards. */
export const PARTICIPANT_STATUS_DISPLAY: Record<ParticipantCommercialLifecycleStage, string> = {
  DRAFT: 'Draft',
  EARNINGS_CONFIGURED: 'Earnings Configured',
  AGREEMENT_SENT: 'Agreement Sent',
  AGREEMENT_ACCEPTED: 'Agreement Accepted',
  PAYMENT_INFO_PENDING: 'Payment Information Pending',
  PAYMENT_INFO_SUBMITTED: 'Payment Information Submitted',
  OPERATOR_REVIEW: 'Operator Review',
  XERO_INVOICE: 'Invoice Created',
  SETTLEMENT_READY: 'Settlement Ready',
};

export function formatParticipantStatusLabel(
  stage: ParticipantCommercialLifecycleStage
): string {
  return PARTICIPANT_STATUS_DISPLAY[stage];
}

export const LIFECYCLE_STAGE_OPERATOR_LABELS: Record<ParticipantCommercialLifecycleStage, string> = {
  DRAFT: 'Add participant details',
  EARNINGS_CONFIGURED: 'Configure earnings',
  AGREEMENT_SENT: 'Awaiting participant acceptance',
  AGREEMENT_ACCEPTED: 'Send payment & tax form',
  PAYMENT_INFO_PENDING: 'Payment & tax forms awaiting completion',
  PAYMENT_INFO_SUBMITTED: 'Payment profiles awaiting review',
  OPERATOR_REVIEW: 'Review payment & tax information',
  XERO_INVOICE: 'Push to Xero',
  SETTLEMENT_READY: 'Ready for settlement',
};

export const LIFECYCLE_TIMELINE_STEPS: readonly {
  stage: ParticipantCommercialLifecycleStage;
  label: string;
}[] = [
  { stage: 'DRAFT', label: 'Participant added' },
  { stage: 'EARNINGS_CONFIGURED', label: 'Earnings configured' },
  { stage: 'AGREEMENT_SENT', label: 'Agreement sent' },
  { stage: 'AGREEMENT_ACCEPTED', label: 'Agreement accepted' },
  { stage: 'PAYMENT_INFO_PENDING', label: 'Payment information' },
  { stage: 'OPERATOR_REVIEW', label: 'Operator review' },
  { stage: 'XERO_INVOICE', label: 'Invoice created' },
  { stage: 'SETTLEMENT_READY', label: 'Settlement ready' },
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

function supplierLifecycle(participant: DemoParticipant): SupplierOnboardingLifecycle {
  const stored = participant.supplierOnboarding as StoredOnboardingState | undefined;
  return deriveLifecycle(stored, {
    payoutVerificationConfirmed: participant.payoutVerificationConfirmed,
    payoutOnboardingPhase: participant.payoutOnboardingPhase,
    onboardingStatus: participant.onboardingStatus,
  });
}

function isXeroExported(participant: DemoParticipant): boolean {
  const ps = participant.paymentSetup;
  return Boolean(ps?.xeroExportedAt && ps?.xeroSyncStatus === 'synced');
}

/** Name, email, and role — required before agreements or payment requests. */
export function hasParticipantIdentityReady(participant: DemoParticipant): boolean {
  return Boolean(
    participant.name?.trim() && participant.email?.trim() && participant.role?.trim()
  );
}

function isAgreementGenerated(participant: DemoParticipant): boolean {
  const agreement = deriveAgreementLifecycleState(participant);
  if (agreement === 'GENERATED' || agreement === 'SHARED' || agreement === 'VIEWED' || agreement === 'SIGNED' || agreement === 'APPROVED') {
    return true;
  }
  return Boolean(participant.agreementUrl?.trim());
}

/**
 * Agreement was intentionally shared with the participant — not merely added to the roster.
 * `inviteStatus === 'Invited'` on create does NOT count as sent.
 */
function isAgreementSent(participant: DemoParticipant): boolean {
  if (hasApprovedAgreement(participant)) return false;
  const agreement = deriveAgreementLifecycleState(participant);
  if (agreement === 'SHARED' || agreement === 'VIEWED' || agreement === 'SIGNED') return true;
  if (participant.inviteSentAt || participant.agreementSharedAt) return true;
  if (participant.agreementViewedAt) return true;
  return false;
}

function mapSupplierToCommercialStage(
  supplier: SupplierOnboardingLifecycle,
  xeroExported: boolean
): ParticipantCommercialLifecycleStage {
  if (xeroExported) return 'SETTLEMENT_READY';
  if (supplier === 'APPROVED') return 'XERO_INVOICE';
  if (supplier === 'SUBMITTED' || supplier === 'UNDER_REVIEW') return 'OPERATOR_REVIEW';
  if (supplier === 'REJECTED') return 'PAYMENT_INFO_PENDING';
  if (supplier === 'IN_PROGRESS') return 'PAYMENT_INFO_PENDING';
  if (supplier === 'INVITED') return 'PAYMENT_INFO_PENDING';
  return 'AGREEMENT_ACCEPTED';
}

/** Operator generated and shared the payment & tax portal with the participant. */
export function isPaymentRequestSent(participant: DemoParticipant): boolean {
  if (participant.paymentSetup?.paymentRequestGeneratedAt) return true;
  if (!hasApprovedAgreement(participant)) return false;
  const sl = supplierLifecycle(participant);
  return sl !== 'NOT_STARTED';
}

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

/**
 * Derive the canonical commercial lifecycle stage for a participant.
 * Pure function — no side effects.
 */
export function deriveParticipantCommercialLifecycle(
  participant: DemoParticipant
): ParticipantCommercialLifecycleStage {
  const identityReady = hasParticipantIdentityReady(participant);
  const earningsReady =
    isParticipantCompensationExempt(participant) || isParticipantEarningsConfigured(participant);

  if (!identityReady || !earningsReady) {
    return 'DRAFT';
  }

  if (isParticipantCompensationExempt(participant)) {
    if (hasApprovedAgreement(participant)) {
      if (isXeroExported(participant)) return 'SETTLEMENT_READY';
      if (supplierLifecycle(participant) === 'APPROVED') return 'XERO_INVOICE';
      return 'AGREEMENT_ACCEPTED';
    }
    if (isAgreementSent(participant)) return 'AGREEMENT_SENT';
    return 'EARNINGS_CONFIGURED';
  }

  if (hasApprovedAgreement(participant)) {
    if (!isPaymentRequestSent(participant)) {
      return 'AGREEMENT_ACCEPTED';
    }
    return mapSupplierToCommercialStage(
      supplierLifecycle(participant),
      isXeroExported(participant)
    );
  }

  if (isAgreementSent(participant)) return 'AGREEMENT_SENT';

  return 'EARNINGS_CONFIGURED';
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
  const stage = deriveParticipantCommercialLifecycle(participant);
  const name = participant.name?.trim() || 'Participant';

  switch (stage) {
    case 'DRAFT':
      return {
        label: 'Configure earnings',
        description: `${name} needs earnings configuration before an agreement can be generated.`,
        urgency: 'action_required',
        destination: 'configure_earnings',
      };
    case 'EARNINGS_CONFIGURED':
      return {
        label: 'Generate agreement',
        description: `${name} is ready — generate and send the commercial agreement.`,
        urgency: 'action_required',
        destination: 'send_agreement',
      };
    case 'AGREEMENT_SENT':
      return {
        label: 'Awaiting acceptance',
        description: `Agreement sent to ${name} — waiting for acceptance.`,
        urgency: 'attention',
        destination: 'await_participant',
      };
    case 'AGREEMENT_ACCEPTED':
      return {
        label: 'Send payment request',
        description: `${name} accepted the agreement. Generate and share the payment & tax information form.`,
        urgency: 'action_required',
        destination: 'send_payment_request',
      };
    case 'PAYMENT_INFO_PENDING':
      return {
        label: 'Share payment request',
        description: `${name} has a payment request — share the secure link or send via your usual channel.`,
        urgency: 'attention',
        destination: 'share_payment_request',
      };
    case 'PAYMENT_INFO_SUBMITTED':
      return {
        label: 'Review payment information',
        description: `${name} submitted payment & tax information.`,
        urgency: 'action_required',
        destination: 'review_payment',
      };
    case 'OPERATOR_REVIEW':
      return {
        label: 'Review payment information',
        description: `Review ${name}'s payment method, tax details, and ABN before approving.`,
        urgency: 'action_required',
        destination: 'review_payment',
      };
    case 'XERO_INVOICE':
      return {
        label: 'Push to Xero',
        description: `${name} is approved — review the invoice before pushing to Xero.`,
        urgency: 'action_required',
        destination: 'xero_export',
      };
    case 'SETTLEMENT_READY':
      return {
        label: 'Ready for settlement',
        description: `${name} is ready for settlement.`,
        urgency: 'none',
        destination: 'settlement',
      };
    default:
      return {
        label: 'No action required',
        description: '',
        urgency: 'none',
        destination: 'none',
      };
  }
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
  | 'share_payment_request'
  | 'review_payment'
  | 'configure_earnings'
  | 'send_agreement'
  | 'none';

export type ParticipantCommercialTablePrimaryAction = {
  kind: ParticipantCommercialTablePrimaryActionKind;
  label: string;
};

export type ParticipantCommercialTablePresentation = {
  stage: ParticipantCommercialLifecycleStage;
  agreementChip: string;
  agreementSecondary: string;
  commercialChip: string;
  commercialSecondary: string;
  /** Payout/commercial column is actionable only after agreement acceptance. */
  payoutColumnActive: boolean;
  primaryAction: ParticipantCommercialTablePrimaryAction;
};

export function deriveParticipantCommercialTablePrimaryAction(
  participant: DemoParticipant
): ParticipantCommercialTablePrimaryAction {
  const stage = deriveParticipantCommercialLifecycle(participant);
  switch (stage) {
    case 'EARNINGS_CONFIGURED':
      return { kind: 'send_agreement', label: 'Send Agreement' };
    case 'AGREEMENT_ACCEPTED':
      return { kind: 'send_payment_request', label: 'Send Payment Request' };
    case 'PAYMENT_INFO_PENDING':
      return { kind: 'share_payment_request', label: 'Share Payment Request' };
    case 'PAYMENT_INFO_SUBMITTED':
    case 'OPERATOR_REVIEW':
      return { kind: 'review_payment', label: 'Review Payment Info' };
    case 'XERO_INVOICE':
      return { kind: 'review_payment', label: 'Review & Export' };
    case 'DRAFT':
      return { kind: 'configure_earnings', label: 'Configure Earnings' };
    default:
      return { kind: 'none', label: '' };
  }
}

function draftSecondaryReason(participant: DemoParticipant): string {
  if (!participant.email?.trim()) return 'Email required before agreement can be sent';
  if (!participant.name?.trim() || !participant.role?.trim()) return 'Complete participant details';
  if (!isParticipantEarningsConfigured(participant) && !isParticipantCompensationExempt(participant)) {
    return 'Configure earnings before generating an agreement';
  }
  return 'Complete participant setup';
}

/**
 * Canonical labels for the participant table — agreement and commercial columns
 * derive from the same lifecycle stage. No independent agreement or payout flags.
 */
export function deriveParticipantCommercialTablePresentation(
  participant: DemoParticipant
): ParticipantCommercialTablePresentation {
  const stage = deriveParticipantCommercialLifecycle(participant);
  const payoutColumnActive = isLifecycleStageAtOrPast(stage, 'AGREEMENT_ACCEPTED');
  const name = participant.name?.trim() || 'Participant';
  const primaryAction = deriveParticipantCommercialTablePrimaryAction(participant);

  switch (stage) {
    case 'DRAFT':
      return {
        stage,
        agreementChip: 'Awaiting agreement',
        agreementSecondary: draftSecondaryReason(participant),
        commercialChip: 'Not started',
        commercialSecondary: 'Payment setup begins after agreement acceptance',
        payoutColumnActive: false,
        primaryAction,
      };
    case 'EARNINGS_CONFIGURED':
      return {
        stage,
        agreementChip: isAgreementGenerated(participant) ? 'Agreement ready' : 'Awaiting agreement',
        agreementSecondary: isAgreementGenerated(participant)
          ? 'Generate and send the commercial agreement'
          : 'Configure agreement before payment setup',
        commercialChip: 'Awaiting agreement',
        commercialSecondary: 'Payment setup begins after agreement acceptance',
        payoutColumnActive: false,
        primaryAction,
      };
    case 'AGREEMENT_SENT':
      return {
        stage,
        agreementChip: 'Awaiting acceptance',
        agreementSecondary: `${name} must accept the commercial agreement`,
        commercialChip: 'Awaiting acceptance',
        commercialSecondary: 'Participant must accept before payment information is collected',
        payoutColumnActive: false,
        primaryAction,
      };
    case 'AGREEMENT_ACCEPTED':
      return {
        stage,
        agreementChip: 'Agreement accepted',
        agreementSecondary: participant.approvedAt
          ? `Accepted ${new Date(participant.approvedAt).toLocaleDateString('en-AU')}`
          : 'Commercial terms accepted',
        commercialChip: formatParticipantStatusLabel(stage),
        commercialSecondary: 'Send payment & tax information request',
        payoutColumnActive: true,
        primaryAction,
      };
    case 'PAYMENT_INFO_PENDING':
      return {
        stage,
        agreementChip: 'Agreement accepted',
        agreementSecondary: 'Commercial terms accepted',
        commercialChip: formatParticipantStatusLabel(stage),
        commercialSecondary: 'Awaiting payment information',
        payoutColumnActive: true,
        primaryAction,
      };
    case 'PAYMENT_INFO_SUBMITTED':
      return {
        stage,
        agreementChip: 'Agreement accepted',
        agreementSecondary: 'Commercial terms accepted',
        commercialChip: formatParticipantStatusLabel(stage),
        commercialSecondary: 'Awaiting operator review',
        payoutColumnActive: true,
        primaryAction,
      };
    case 'OPERATOR_REVIEW':
      return {
        stage,
        agreementChip: 'Agreement accepted',
        agreementSecondary: 'Commercial terms accepted',
        commercialChip: formatParticipantStatusLabel(stage),
        commercialSecondary: 'Awaiting operator review',
        payoutColumnActive: true,
        primaryAction,
      };
    case 'XERO_INVOICE':
      return {
        stage,
        agreementChip: 'Agreement accepted',
        agreementSecondary: 'Payment profile approved',
        commercialChip: formatParticipantStatusLabel(stage),
        commercialSecondary: 'Ready to push to Xero',
        payoutColumnActive: true,
        primaryAction,
      };
    case 'SETTLEMENT_READY':
      return {
        stage,
        agreementChip: 'Agreement accepted',
        agreementSecondary: 'Invoice created in Xero',
        commercialChip: formatParticipantStatusLabel(stage),
        commercialSecondary: 'Settlement ready',
        payoutColumnActive: true,
        primaryAction,
      };
    default:
      return {
        stage: 'DRAFT',
        agreementChip: 'Awaiting agreement',
        agreementSecondary: draftSecondaryReason(participant),
        commercialChip: 'Not started',
        commercialSecondary: 'Payment setup begins after agreement acceptance',
        payoutColumnActive: false,
        primaryAction: deriveParticipantCommercialTablePrimaryAction(participant),
      };
  }
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
    default:
      return '';
  }
}

function notificationUrgency(stage: ParticipantCommercialLifecycleStage): WorkspaceLifecycleNotification['urgency'] {
  if (stage === 'SETTLEMENT_READY') return 'none';
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
