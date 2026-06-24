/**
 * Participant Workflow Adapter
 *
 * Bridges `DemoParticipant` (the canonical participant type used across the
 * project workspace) into the Commercial OS engine types:
 *
 *   DemoParticipant[]
 *       ↓
 *   WorkflowIntegrationInput[]   (for deriveWorkspaceWorkflowStatus)
 *   WorkspaceOnboardingStatus    (for SupplierOnboardingDashboardWidget)
 *
 * Design rules:
 *   - PURE function — no network calls, no side effects.
 *   - `deriveParticipantCommercialLifecycle()` is the single source of truth
 *     for participant stage; adapters translate from lifecycle, not duplicate
 *     payout phase heuristics.
 *   - Conservative: when in doubt, use the least-advanced stage.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { WorkflowIntegrationInput } from '@/lib/commercial/workflow-integration';
import { deriveWorkspaceWorkflowStatus } from '@/lib/commercial/workflow-integration';
import type {
  SupplierOnboardingStatus,
  SupplierOnboardingStage,
  SupplierOnboardingTimelineEvent,
  WorkspaceOnboardingStatus,
} from '@/lib/commercial/supplier-onboarding';
import type { AccountingExportModel } from '@/lib/commercial/accounting-export';
import type { AccountingSyncStatus } from '@/lib/commercial/accounting-connector';
import {
  deriveParticipantCommercialLifecycle,
  type ParticipantCommercialLifecycleStage,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { normalizeDemoParticipantRole } from '@/lib/projects/normalize-participant-role';

/* ─── Types ──────────────────────────────────────────────────────────────── */

/**
 * Minimal participant shape needed by the adapter.
 * Matches the subset of DemoParticipant fields used for workflow derivation.
 */
export type ParticipantPhaseData = {
  id: string;
  name: string;
  email?: string;
  role: string;
  approvalStatus: string;
  approvedAt?: string | null;
  payoutOnboardingPhase?: string | null;
  onboardingStatus?: string | null;
  payoutVerificationConfirmed?: boolean | null;
  commissionValue?: number | null;
  commissionKind?: string | null;
  payoutSettlementStatus?: string | null;
  supplierOnboarding?: DemoParticipant['supplierOnboarding'];
  compensationProfile?: DemoParticipant['compensationProfile'];
  /** C-4: paymentSetup persisted by the new Payment Setup workflow */
  paymentSetup?: {
    token?: string | null;
    paymentRequestGeneratedAt?: string | null;
    portalFirstOpenedAt?: string | null;
    xeroExportedAt?: string | null;
    xeroSyncStatus?: string | null;
    draftInvoice?: { status?: string } | null;
  } | null;
};

/* ─── Stage derivation ───────────────────────────────────────────────────── */

const SUPPLIER_STAGE_LABELS: Record<SupplierOnboardingStage, string> = {
  not_started:       'Awaiting agreement approval',
  invoice_generated: 'Payment request ready to send',
  in_progress:       'Payment information in progress',
  submitted:         'Awaiting operator review',
  operator_approved: 'Approved — ready for Xero',
  xero_exported:     'Complete',
};

function toLifecycleParticipant(p: ParticipantPhaseData): DemoParticipant {
  return {
    id: p.id,
    name: p.name,
    email: p.email ?? '',
    role: normalizeDemoParticipantRole(p.role),
    approvalStatus: p.approvalStatus as DemoParticipant['approvalStatus'],
    approvedAt: p.approvedAt,
    payoutOnboardingPhase: p.payoutOnboardingPhase as DemoParticipant['payoutOnboardingPhase'],
    onboardingStatus: p.onboardingStatus as DemoParticipant['onboardingStatus'],
    payoutVerificationConfirmed: p.payoutVerificationConfirmed,
    commissionValue: p.commissionValue,
    commissionKind: p.commissionKind as DemoParticipant['commissionKind'],
    payoutSettlementStatus: p.payoutSettlementStatus as DemoParticipant['payoutSettlementStatus'],
    paymentSetup: p.paymentSetup as DemoParticipant['paymentSetup'],
    supplierOnboarding: p.supplierOnboarding,
    compensationProfile: p.compensationProfile,
  } as DemoParticipant;
}

function lifecycleToSupplierStage(
  stage: ParticipantCommercialLifecycleStage,
  p: ParticipantPhaseData
): SupplierOnboardingStage {
  switch (stage) {
    case 'SETTLEMENT_READY':
      return 'xero_exported';
    case 'XERO_INVOICE':
      return p.paymentSetup?.xeroExportedAt ? 'xero_exported' : 'operator_approved';
    case 'OPERATOR_REVIEW':
    case 'PAYMENT_INFO_SUBMITTED':
      return 'submitted';
    case 'PAYMENT_INFO_PENDING':
      return 'in_progress';
    case 'AGREEMENT_ACCEPTED':
      return 'invoice_generated';
    default:
      return 'not_started';
  }
}

type MinimalAccountingView = {
  status: AccountingSyncStatus;
  statusLabel: string;
  ready: boolean;
  nextAction: string | null;
  blockerReason: 'invoice_not_received' | 'invoice_not_verified' | 'settlement_readiness_incomplete' | null;
};

function deriveMinimalAccountingView(
  lifecycleStage: ParticipantCommercialLifecycleStage,
  p: ParticipantPhaseData
): MinimalAccountingView {
  const synced =
    p.paymentSetup?.xeroSyncStatus === 'synced' ||
    lifecycleStage === 'SETTLEMENT_READY';

  if (p.paymentSetup?.xeroExportedAt) {
    return {
      status: 'exported',
      statusLabel: synced ? 'Synced' : 'Exported',
      ready: false,
      nextAction: null,
      blockerReason: null,
    };
  }

  if (lifecycleStage === 'XERO_INVOICE') {
    return {
      status: 'ready',
      statusLabel: 'Ready for Xero',
      ready: true,
      nextAction: null,
      blockerReason: null,
    };
  }

  if (lifecycleStage === 'OPERATOR_REVIEW' || lifecycleStage === 'PAYMENT_INFO_SUBMITTED') {
    return {
      status: 'needs_review',
      statusLabel: 'Awaiting Review',
      ready: false,
      nextAction: 'Review payment & tax information',
      blockerReason: 'invoice_not_verified',
    };
  }

  if (lifecycleStage === 'PAYMENT_INFO_PENDING') {
    return {
      status: 'ready',
      statusLabel: 'Awaiting supplier onboarding',
      ready: false,
      nextAction: 'Share payment request with participant',
      blockerReason: 'invoice_not_received',
    };
  }

  if (lifecycleStage === 'AGREEMENT_ACCEPTED') {
    return {
      status: 'ready',
      statusLabel: 'Draft',
      ready: false,
      nextAction: 'Send payment request',
      blockerReason: 'invoice_not_received',
    };
  }

  return {
    status: 'ready',
    statusLabel: 'Not ready',
    ready: false,
    nextAction: null,
    blockerReason: 'settlement_readiness_incomplete',
  };
}

/**
 * Builds a minimal `SupplierOnboardingStatus` from lifecycle-derived stage data.
 */
function buildMinimalOnboardingStatus(
  p: ParticipantPhaseData,
  projectId: string
): SupplierOnboardingStatus | null {
  if (p.approvalStatus !== 'Approved') return null;

  const lifecycleStage = deriveParticipantCommercialLifecycle(toLifecycleParticipant(p));
  const stage = lifecycleToSupplierStage(lifecycleStage, p);
  const amount = p.commissionValue ?? 0;
  const now = new Date().toISOString();
  const invoiceId = `${projectId}:${p.id}:supplier_invoice`;
  const role = normalizeDemoParticipantRole(p.role);

  const onboardingComplete =
    stage === 'submitted' || stage === 'operator_approved' || stage === 'xero_exported';
  const readyForXeroExport = stage === 'operator_approved' || stage === 'xero_exported';

  return {
    participantId: p.id,
    participantName: p.name,
    participantRole: role,
    stage,
    stageLabel: SUPPLIER_STAGE_LABELS[stage],
    draftInvoice: {
      invoiceId,
      projectId,
      participantId: p.id,
      agreementReference: null,
      projectName: '',
      participantName: p.name,
      participantRole: role,
      description: `${role} services`,
      lineItems: [
        {
          id: `${invoiceId}:1`,
          description: `${role} services`,
          quantity: 1,
          unitAmount: amount,
          taxType: 'PENDING',
          lineTotal: amount,
          currency: 'AUD',
        },
      ],
      subtotal: amount,
      gstAmount: null,
      total: amount,
      currency: 'AUD',
      gstStatus: 'pending',
      dueDate: null,
      commercialReference: `${projectId}:${p.id}`,
      generatedAt: now,
      confirmedAt: onboardingComplete ? now : null,
      approvedAt: readyForXeroExport ? now : null,
    },
    abnValidation: {
      abn: '',
      isValid: false,
      isNotApplicable: false,
      requiresManualReview: false,
      formattedABN: null,
      businessName: null,
      abnStatus: null,
      errorMessage: null,
    },
    bankValidation: {
      accountName: null,
      bsb: null,
      accountNumber: null,
      bsbValid: false,
      accountNumberValid: false,
      accountNameValid: false,
      isComplete: false,
      errors: [],
    },
    checklist: [],
    onboardingComplete,
    readyForXeroExport,
    xeroReadiness: {
      readyForExport: readyForXeroExport,
      checklist: [],
      primaryBlocker: readyForXeroExport ? null : SUPPLIER_STAGE_LABELS[stage],
    },
    nextAction: onboardingComplete ? `Review ${p.name}'s details` : null,
    requiresManualReview: false,
    timelineEvents: [],
  };
}

/* ─── Public API ─────────────────────────────────────────────────────────── */

export function buildWorkflowInputsFromParticipants(
  participants: ParticipantPhaseData[],
  projectId: string
): WorkflowIntegrationInput[] {
  return participants.map((p) => {
    const onboarding = buildMinimalOnboardingStatus(p, projectId);
    const agreementApproved = p.approvalStatus === 'Approved';
    const paymentReleased = p.payoutSettlementStatus === 'Paid';

    return {
      projectId,
      participant: {
        id: p.id,
        name: p.name,
        agreementApproved,
        approvedAt: p.approvedAt ?? null,
        paymentReleased,
      },
      onboarding,
      settlement: null,
      accounting: null,
      currentDate: new Date().toISOString(),
    };
  });
}

/**
 * Synthesises timeline events from participant lifecycle fields for
 * `buildCommercialTimeline({ supplierOnboardingEvents })`.
 */
export function synthesizeSupplierTimelineEvents(
  participants: ParticipantPhaseData[],
  projectId: string
): SupplierOnboardingTimelineEvent[] {
  const events: SupplierOnboardingTimelineEvent[] = [];

  for (const p of participants) {
    if (p.approvalStatus !== 'Approved') continue;

    const participant = toLifecycleParticipant(p);
    const lifecycleStage = deriveParticipantCommercialLifecycle(participant);
    const participantId = p.id;
    const approvedAt = p.approvedAt ?? new Date().toISOString();
    const role = normalizeDemoParticipantRole(p.role);

    if (p.paymentSetup?.paymentRequestGeneratedAt) {
      events.push({
        id: `${projectId}:${participantId}:payment_request_generated`,
        projectId,
        participantId,
        type: 'supplier_invoice_generated',
        title: 'Payment request generated',
        description: `A secure payment portal was prepared for ${p.name}.`,
        commercialImpact: 'Share the payment request so the participant can submit payment & tax details.',
        occurredAt: p.paymentSetup.paymentRequestGeneratedAt,
      });
    }

    if (p.paymentSetup?.portalFirstOpenedAt) {
      events.push({
        id: `${projectId}:${participantId}:payment_request_opened`,
        projectId,
        participantId,
        type: 'supplier_onboarding_started',
        title: 'Payment request opened',
        description: `${p.name} opened the payment & tax portal.`,
        commercialImpact: 'Participant is reviewing what is required before submitting.',
        occurredAt: p.paymentSetup.portalFirstOpenedAt,
      });
    }

  if (
      lifecycleStage === 'PAYMENT_INFO_SUBMITTED' ||
      lifecycleStage === 'OPERATOR_REVIEW' ||
      lifecycleStage === 'XERO_INVOICE' ||
      lifecycleStage === 'SETTLEMENT_READY' ||
      p.payoutOnboardingPhase === 'COMPLETED' ||
      p.onboardingStatus === 'COMPLETE' ||
      p.payoutVerificationConfirmed === true
    ) {
      const submittedAt =
        p.supplierOnboarding?.submission?.submittedAt ?? approvedAt;
      events.push({
        id: `${projectId}:${participantId}:payment_information_submitted`,
        projectId,
        participantId,
        type: 'supplier_onboarding_completed',
        title: 'Payment information submitted',
        description: `${p.name} submitted payment & tax information.`,
        commercialImpact: 'Ready for operator review before Xero export.',
        occurredAt: submittedAt,
      });
    }

    if (lifecycleStage === 'OPERATOR_REVIEW') {
      events.push({
        id: `${projectId}:${participantId}:operator_review_started`,
        projectId,
        participantId,
        type: 'supplier_onboarding_completed',
        title: 'Operator review started',
        description: `${p.name}'s payment & tax details are awaiting operator review.`,
        commercialImpact: 'Review and approve before pushing to Xero.',
        occurredAt: approvedAt,
      });
    }

    if (p.payoutVerificationConfirmed === true || lifecycleStage === 'XERO_INVOICE') {
      events.push({
        id: `${projectId}:${participantId}:operator_approved`,
        projectId,
        participantId,
        type: 'supplier_invoice_approved',
        title: 'Operator approved',
        description: `${p.name}'s payment & tax information was approved.`,
        commercialImpact: 'Invoice is ready to push to Xero.',
        occurredAt: approvedAt,
      });
    }

    if (p.paymentSetup?.xeroExportedAt) {
      events.push({
        id: `${projectId}:${participantId}:xero_invoice_created`,
        projectId,
        participantId,
        type: 'supplier_invoice_exported_to_xero',
        title: 'Xero invoice created',
        description: `Invoice exported to Xero for ${p.name}.`,
        commercialImpact: 'Accounting record is in sync — settlement can proceed.',
        occurredAt: p.paymentSetup.xeroExportedAt,
      });
    }

    if (lifecycleStage === 'SETTLEMENT_READY') {
      events.push({
        id: `${projectId}:${participantId}:settlement_ready`,
        projectId,
        participantId,
        type: 'supplier_invoice_exported_to_xero',
        title: 'Settlement ready',
        description: `${p.name} is cleared for settlement.`,
        commercialImpact: 'All commercial and accounting steps are complete.',
        occurredAt: p.paymentSetup?.xeroExportedAt ?? approvedAt,
      });
    }

    // Legacy fallback when paymentSetup timestamps are absent
    if (!p.paymentSetup?.paymentRequestGeneratedAt && lifecycleStage !== 'AGREEMENT_ACCEPTED') {
      events.push({
        id: `${projectId}:${participantId}:invoice_generated`,
        projectId,
        participantId,
        type: 'supplier_invoice_generated',
        title: `Draft invoice generated for ${p.name}`,
        description: `${p.name} approved the agreement. A draft invoice was generated from the commercial terms.`,
        commercialImpact: `Invoice auto-generated for ${role}`,
        occurredAt: approvedAt,
      });
    }
  }

  return events;
}

export function deriveWorkspaceStatusFromParticipants(
  participants: ParticipantPhaseData[],
  projectId: string
) {
  const inputs = buildWorkflowInputsFromParticipants(participants, projectId);
  return deriveWorkspaceWorkflowStatus(inputs);
}

export function buildMinimalAccountingExportModels(
  participants: ParticipantPhaseData[],
  projectId: string
): AccountingExportModel[] {
  const approved = participants.filter((p) => p.approvalStatus === 'Approved');

  return approved.map((p) => {
    const lifecycleStage = deriveParticipantCommercialLifecycle(toLifecycleParticipant(p));
    const accountingView = deriveMinimalAccountingView(lifecycleStage, p);
    const amount = p.commissionValue ?? 0;
    const exportId = `${projectId}:${p.id}:accounting_export`;
    const role = normalizeDemoParticipantRole(p.role);

    const blockers =
      accountingView.ready || !accountingView.blockerReason
        ? []
        : [
            {
              reason: accountingView.blockerReason,
              explanation:
                accountingView.blockerReason === 'invoice_not_received'
                  ? 'Payment & tax information has not been received from the participant.'
                  : accountingView.blockerReason === 'invoice_not_verified'
                  ? 'Operator review is required before export.'
                  : 'Settlement readiness is incomplete.',
              consequence: 'Invoice cannot be exported to Xero until this is resolved.',
              action: accountingView.nextAction ?? 'Complete the required step',
            },
          ];

    return {
      exportId,
      participantId: p.id,
      participantName: p.name,
      participantRole: role,
      projectId,
      status: accountingView.status,
      statusLabel: accountingView.statusLabel,
      exportReadiness: {
        ready: accountingView.ready,
        blockers,
        nextAction: accountingView.nextAction,
      },
      preview: accountingView.ready
        ? {
            supplier: p.name,
            description: `${role} services`,
            reference: `${projectId}:${p.id}`,
            invoiceNumber: null,
            amount,
            gstAmount: 0,
            gstIncluded: false,
            currency: 'AUD',
            trackingCategory: null,
            dueDate: null,
            accountingSystem: 'xero',
            accountingSystemLabel: 'Xero',
            abn: null,
          }
        : null,
      exportApprovedAt: null,
      exportedAt: p.paymentSetup?.xeroExportedAt ?? null,
      providerReference: null,
      failureReason: accountingView.status === 'failed' ? 'Export failed' : null,
      failureAction: accountingView.status === 'failed' ? 'Review the error and retry export.' : null,
      reExportRequired: false,
      notApplicable: false,
    };
  });
}

export function deriveWorkspaceOnboardingFromParticipants(
  participants: ParticipantPhaseData[],
  projectId: string
): WorkspaceOnboardingStatus {
  const approved = participants.filter((p) => p.approvalStatus === 'Approved');
  const statuses = approved.map((p) => buildMinimalOnboardingStatus(p, projectId)!);

  const completedCount = statuses.filter((s) => s.onboardingComplete).length;
  const inProgressCount = statuses.filter(
    (s) => s.stage === 'in_progress' || s.stage === 'invoice_generated'
  ).length;
  const notStartedCount = statuses.filter((s) => s.stage === 'not_started').length;
  const requiresReviewCount = statuses.filter((s) => s.requiresManualReview).length;
  const readyForExportCount = statuses.filter((s) => s.readyForXeroExport).length;

  const totalCount = statuses.length;

  const summary =
    totalCount === 0
      ? 'No participants requiring onboarding.'
      : completedCount === totalCount
      ? `All ${totalCount} supplier${totalCount !== 1 ? 's have' : ' has'} completed onboarding.`
      : `${completedCount} of ${totalCount} suppliers have completed onboarding.`;

  const primaryCta =
    readyForExportCount > 0
      ? `Approve ${readyForExportCount} supplier${readyForExportCount !== 1 ? 's' : ''} for Xero export`
      : notStartedCount > 0
      ? `Send onboarding to ${notStartedCount} supplier${notStartedCount !== 1 ? 's' : ''}`
      : inProgressCount > 0
      ? `${inProgressCount} supplier${inProgressCount !== 1 ? 's' : ''} completing onboarding`
      : null;

  const pendingSuppliers = statuses
    .filter((s) => !s.onboardingComplete)
    .map((s) => ({
      participantName: s.participantName,
      primaryNeed:
        s.stage === 'not_started'
          ? 'Onboarding not started'
          : s.stage === 'invoice_generated'
          ? 'Awaiting supplier response'
          : s.stage === 'in_progress'
          ? 'Supplier onboarding in progress'
          : 'Awaiting operator review',
    }));

  return {
    participants: statuses,
    totalCount,
    completedCount,
    inProgressCount,
    notStartedCount,
    requiresReviewCount,
    readyForExportCount,
    summary,
    primaryCta,
    pendingSuppliers,
  };
}
