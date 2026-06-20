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
 *   - Conservative: when in doubt about a participant's state, use the
 *     least-advanced stage. Never report a participant as further along
 *     than their persisted data confirms.
 *   - Only uses fields available on DemoParticipant. No inference from
 *     other sources.
 *
 * Usage:
 * ```tsx
 * const inputs = buildWorkflowInputsFromParticipants(projectParticipants, projectId);
 * const status = deriveWorkspaceWorkflowStatus(inputs);
 * <OperatorInbox workspaceStatus={status} projectId={projectId} />
 * ```
 */

import type { WorkflowIntegrationInput } from '@/lib/commercial/workflow-integration';
import { deriveWorkspaceWorkflowStatus } from '@/lib/commercial/workflow-integration';
import type {
  SupplierOnboardingStatus,
  SupplierOnboardingStage,
  SupplierOnboardingTimelineEvent,
  WorkspaceOnboardingStatus,
} from '@/lib/commercial/supplier-onboarding';
import type { AccountingExportModel } from '@/lib/commercial/accounting-export';

/* ─── Types ──────────────────────────────────────────────────────────────── */

/**
 * Minimal participant shape needed by the adapter.
 * Matches the subset of DemoParticipant fields used for workflow derivation.
 */
export type ParticipantPhaseData = {
  id: string;
  name: string;
  role: string;
  approvalStatus: string;
  approvedAt?: string | null;
  payoutOnboardingPhase?: string | null;
  onboardingStatus?: string | null;
  payoutVerificationConfirmed?: boolean | null;
  commissionValue?: number | null;
  commissionKind?: string | null;
  payoutSettlementStatus?: string | null;
};

/* ─── Stage derivation ───────────────────────────────────────────────────── */

const SUPPLIER_STAGE_LABELS: Record<SupplierOnboardingStage, string> = {
  not_started:       'Awaiting agreement approval',
  invoice_generated: 'Supplier setup required',
  in_progress:       'Supplier setup in progress',
  submitted:         'Awaiting operator review',
  operator_approved: 'Approved — ready for Xero',
  xero_exported:     'Complete',
};

/**
 * Derives the `SupplierOnboardingStage` from a participant's persisted
 * onboarding phase fields.
 *
 * Maps:
 *   payoutVerificationConfirmed = true → operator_approved
 *   payoutOnboardingPhase COMPLETED | onboardingStatus COMPLETE → submitted
 *   payoutOnboardingPhase IN_PROGRESS | onboardingStatus INCOMPLETE → in_progress
 *   payoutOnboardingPhase INVITED → invoice_generated
 *   else → not_started
 */
function deriveOnboardingStageFromPhase(p: ParticipantPhaseData): SupplierOnboardingStage {
  if (p.payoutVerificationConfirmed === true) return 'operator_approved';
  if (p.payoutOnboardingPhase === 'COMPLETED' || p.onboardingStatus === 'COMPLETE') return 'submitted';
  if (p.payoutOnboardingPhase === 'IN_PROGRESS' || p.onboardingStatus === 'INCOMPLETE') return 'in_progress';
  if (p.payoutOnboardingPhase === 'INVITED') return 'invoice_generated';
  return 'not_started';
}

/**
 * Builds a minimal `SupplierOnboardingStatus` from a participant's phase data.
 *
 * Only the fields required by `deriveWorkflowStage()` and `deriveParticipantWorkflowStatus()`
 * are populated with real values. The rest use safe defaults.
 *
 * Returns null when the participant has not yet approved their agreement.
 */
function buildMinimalOnboardingStatus(
  p: ParticipantPhaseData,
  projectId: string
): SupplierOnboardingStatus | null {
  if (p.approvalStatus !== 'Approved') return null;

  const stage = deriveOnboardingStageFromPhase(p);
  const amount = p.commissionValue ?? 0;
  const now = new Date().toISOString();
  const invoiceId = `${projectId}:${p.id}:supplier_invoice`;

  const onboardingComplete =
    stage === 'submitted' || stage === 'operator_approved' || stage === 'xero_exported';
  const readyForXeroExport = stage === 'operator_approved' || stage === 'xero_exported';

  return {
    participantId: p.id,
    participantName: p.name,
    participantRole: p.role,
    stage,
    stageLabel: SUPPLIER_STAGE_LABELS[stage],
    draftInvoice: {
      invoiceId,
      projectId,
      participantId: p.id,
      agreementReference: null,
      projectName: '',
      participantName: p.name,
      participantRole: p.role,
      description: `${p.role} services`,
      lineItems: [
        {
          id: `${invoiceId}:1`,
          description: `${p.role} services`,
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

/**
 * Converts an array of `DemoParticipant`-compatible objects into
 * `WorkflowIntegrationInput[]` for consumption by `deriveWorkspaceWorkflowStatus()`.
 *
 * @param participants  Array of project participants (DemoParticipant or subset).
 * @param projectId     The project/agreement ID.
 *
 * @example
 * ```tsx
 * const inputs = buildWorkflowInputsFromParticipants(projectParticipants, projectId);
 * const status = deriveWorkspaceWorkflowStatus(inputs);
 * ```
 */
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
 * Synthesises `SupplierOnboardingTimelineEvent[]` from participant phase data.
 *
 * Since participants don't carry a detailed event log, this function infers
 * the most likely milestone events from their persisted phase fields.
 * Events are conservative — only emitted when the evidence is unambiguous.
 *
 * These events are consumed by `buildCommercialTimeline` via
 * `BuildCommercialTimelineInput.supplierOnboardingEvents`.
 */
export function synthesizeSupplierTimelineEvents(
  participants: ParticipantPhaseData[],
  projectId: string
): SupplierOnboardingTimelineEvent[] {
  const events: SupplierOnboardingTimelineEvent[] = [];

  for (const p of participants) {
    if (p.approvalStatus !== 'Approved') continue;

    const participantId = p.id;
    const approvedAt = p.approvedAt ?? new Date().toISOString();

    // Agreement approved → invoice auto-generated
    events.push({
      id: `${projectId}:${participantId}:invoice_generated`,
      projectId,
      participantId,
      type: 'supplier_invoice_generated',
      title: `Draft invoice generated for ${p.name}`,
      description: `${p.name} approved the agreement. A draft invoice was automatically generated from the commercial terms.`,
      commercialImpact: `Invoice auto-generated for ${p.role}`,
      occurredAt: approvedAt,
    });

    // Supplier started onboarding
    if (
      p.payoutOnboardingPhase === 'IN_PROGRESS' ||
      p.payoutOnboardingPhase === 'COMPLETED' ||
      p.onboardingStatus === 'INCOMPLETE' ||
      p.onboardingStatus === 'COMPLETE'
    ) {
      events.push({
        id: `${projectId}:${participantId}:onboarding_started`,
        projectId,
        participantId,
        type: 'supplier_onboarding_started',
        title: `${p.name} started supplier onboarding`,
        description: `${p.name} began providing their bank details, ABN, and GST status.`,
        commercialImpact: 'Supplier onboarding in progress',
        occurredAt: approvedAt,
      });
    }

    // Supplier completed onboarding
    if (
      p.payoutOnboardingPhase === 'COMPLETED' ||
      p.onboardingStatus === 'COMPLETE' ||
      p.payoutVerificationConfirmed === true
    ) {
      events.push({
        id: `${projectId}:${participantId}:onboarding_completed`,
        projectId,
        participantId,
        type: 'supplier_onboarding_completed',
        title: `${p.name} completed supplier onboarding`,
        description: `${p.name} submitted their bank details, ABN, and GST status. Ready for operator review.`,
        commercialImpact: 'Awaiting operator review before Xero export',
        occurredAt: approvedAt,
      });
    }

    // Operator approved (payoutVerificationConfirmed)
    if (p.payoutVerificationConfirmed === true) {
      events.push({
        id: `${projectId}:${participantId}:invoice_approved`,
        projectId,
        participantId,
        type: 'supplier_invoice_approved',
        title: `${p.name}'s invoice approved`,
        description: `Supplier details verified and invoice approved. Ready for Xero export.`,
        commercialImpact: 'Invoice approved — settlement process can begin',
        occurredAt: approvedAt,
      });
    }
  }

  return events;
}

/**
 * Derives `WorkspaceWorkflowIntegrationStatus` from an array of participants.
 * Convenience wrapper combining `buildWorkflowInputsFromParticipants` +
 * `deriveWorkspaceWorkflowStatus`.
 *
 * @example
 * ```tsx
 * const status = deriveWorkspaceStatusFromParticipants(projectParticipants, projectId);
 * <OperatorInbox workspaceStatus={status} projectId={projectId} />
 * ```
 */
export function deriveWorkspaceStatusFromParticipants(
  participants: ParticipantPhaseData[],
  projectId: string
) {
  const inputs = buildWorkflowInputsFromParticipants(participants, projectId);
  return deriveWorkspaceWorkflowStatus(inputs);
}

/**
 * Builds minimal `AccountingExportModel[]` from participant phase data.
 *
 * The models provide enough information for the `XeroExportStatusPanel` to
 * show the operator which participants are ready for Xero export. Full
 * accounting verification data (ABN, bank details) is not available here —
 * the operator will see a preview prompt that routes to the Participants page
 * for completion.
 *
 * Export readiness is derived conservatively from `payoutVerificationConfirmed`:
 *   true  → operator_approved → readyForExport
 *   false → awaiting review or not started → blockedByOnboarding
 */
export function buildMinimalAccountingExportModels(
  participants: ParticipantPhaseData[],
  projectId: string
): AccountingExportModel[] {
  const approved = participants.filter((p) => p.approvalStatus === 'Approved');

  return approved.map((p) => {
    const stage = deriveOnboardingStageFromPhase(p);
    const amount = p.commissionValue ?? 0;
    const exportId = `${projectId}:${p.id}:accounting_export`;

    const isReadyForExport =
      stage === 'operator_approved' || stage === 'xero_exported';
    const isExported = stage === 'xero_exported';

    return {
      exportId,
      participantId: p.id,
      participantName: p.name,
      projectId,
      status: isExported
        ? 'exported'
        : isReadyForExport
        ? 'ready_to_export'
        : 'pending',
      statusLabel: isExported
        ? 'Exported to Xero'
        : isReadyForExport
        ? 'Ready for Xero export'
        : stage === 'submitted'
        ? 'Awaiting operator review'
        : 'Awaiting supplier onboarding',
      exportReadiness: isReadyForExport
        ? { readyForExport: true, blockers: [], primaryBlocker: null }
        : {
            readyForExport: false,
            blockers: [
              {
                id: `${exportId}:blocker`,
                label: SUPPLIER_STAGE_LABELS[stage] ?? 'Onboarding incomplete',
                explanation: isReadyForExport
                  ? null
                  : 'Complete supplier onboarding before exporting to Xero.',
                action: 'Complete supplier onboarding',
                isBlocker: true,
              },
            ],
            primaryBlocker: isReadyForExport
              ? null
              : SUPPLIER_STAGE_LABELS[stage] ?? 'Awaiting supplier onboarding',
          },
      preview: isReadyForExport
        ? {
            supplier: p.name,
            description: `${p.role} services`,
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
      exportedAt: isExported ? new Date().toISOString() : null,
      providerReference: null,
      failureReason: null,
      failureAction: null,
      reExportRequired: false,
      notApplicable: false,
    };
  });
}

/**
 * Derives a `WorkspaceOnboardingStatus` summary from participant phase data.
 * Used to populate `workspaceContext.onboardingWorkspace` on the dashboard.
 *
 * Provides the `SupplierOnboardingDashboardWidget` with the data it needs
 * without requiring a separate API call.
 */
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
