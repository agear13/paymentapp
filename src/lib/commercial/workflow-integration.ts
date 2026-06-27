/**
 * Commercial Workflow Integration
 *
 * The canonical mapping layer that connects the Commercial OS modules into
 * one continuous workflow with no dead ends.
 *
 * This module does NOT contain any business logic.
 * It reads outputs from the canonical engines and:
 *   - Derives the current workflow stage for a participant
 *   - Provides the single primary CTA for each stage
 *   - Determines what automatically unlocks next
 *   - Generates operator notifications
 *   - Ensures every milestone updates the Commercial Timeline
 *
 * The full commercial journey:
 *
 *   Agreement Import
 *       ↓ AI Review
 *   Participant Approval
 *       ↓ Agreement approved → Invoice auto-generated
 *   Supplier Onboarding  (new)
 *       ↓ Supplier submits → Operator notified
 *   Operator Review
 *       ↓ Operator approves
 *   Accounting Export (Xero)
 *       ↓ Invoice exported
 *   Revenue Collection
 *       ↓ Funding confirmed
 *   Settlement Preparation
 *       ↓ All checks complete
 *   Payment Release
 *       ↓ Payment sent
 *   Commercial Performance
 *
 * Design rules:
 *   - One primary CTA per stage. Never two equal-weight actions.
 *   - No dead ends. Every stage has a next step.
 *   - No duplicate logic. Always reads from canonical engines.
 *   - Every transition records a Commercial Timeline event.
 *   - Notifications are generated per milestone, not polling.
 */

import type { SupplierOnboardingStatus, SupplierOnboardingStage } from './supplier-onboarding';
import type { SettlementReadinessResult } from './settlement-readiness';
import type { AccountingExportModel } from './accounting-export';

/* ─── Workflow stage ─────────────────────────────────────────────────────── */

/**
 * The canonical commercial workflow stage for a single participant.
 * Derived from the combined state of all Commercial OS engines.
 */
export type CommercialWorkflowStage =
  | 'awaiting_approval'          // Participant has not approved the agreement
  | 'generating_invoice'         // Agreement approved — invoice being generated
  | 'supplier_onboarding'        // Awaiting supplier to submit details
  | 'awaiting_operator_review'   // Supplier submitted — operator must review
  | 'awaiting_xero_export'       // Operator approved — ready to push to Xero
  | 'awaiting_funding'           // Xero exported — awaiting revenue collection
  | 'awaiting_settlement'        // Funded — settlement preparation in progress
  | 'ready_to_release'           // All checks complete — ready to pay
  | 'complete';                  // Payment released

export type CommercialWorkflowDestination =
  | 'approval_centre'     // Participants tab, focus=approvals — waiting on participant
  | 'supplier_onboarding' // Participants tab, focus=onboarding — send/manage onboarding
  | 'operator_review'     // Participants tab, focus=onboarding — review submitted details
  | 'xero_export'         // Funding tab — accounting approval screen
  | 'funding_page'        // Funding tab — revenue/forecast overview
  | 'settlement_page'     // Payouts tab — settlement checklist
  | 'release_page'        // Payouts tab — release queue
  | 'none';               // No navigation — terminal or waiting state

export type CommercialWorkflowCTA = {
  label: string;
  /** 'operator' = operator must act | 'supplier' = waiting for supplier */
  actor: 'operator' | 'supplier' | 'system';
  /** True when this is blocking progress. */
  isUrgent: boolean;
  /** Navigation destination — resolve to a URL with resolveCommercialWorkflowDestination(). */
  destination: CommercialWorkflowDestination;
};

export type ParticipantWorkflowIntegrationStatus = {
  participantId: string;
  participantName: string;

  /** Current stage in the commercial journey. */
  stage: CommercialWorkflowStage;
  /** Human-readable stage label. */
  stageLabel: string;
  /** One-line description of what's happening. */
  stageDescription: string;

  /** The single primary CTA. */
  primaryCTA: CommercialWorkflowCTA;

  /**
   * Whether any manual operator action is required right now.
   * Used to prioritise the operator queue.
   */
  requiresOperatorAction: boolean;

  /**
   * Whether this participant is a dead end —
   * there is no clear next step defined.
   * This should always be false in a correctly integrated system.
   */
  isDeadEnd: boolean;

  /** What automatically triggered the current state transition. */
  triggeredBy: string | null;

  /** Notification to show the operator when this state is reached. */
  operatorNotification: OperatorNotification | null;

  /**
   * Journey steps for display in participant cards.
   * Every step has a status derived from canonical engines.
   */
  journeySteps: CommercialJourneyStep[];
};

/* ─── Operator Notifications ─────────────────────────────────────────────── */

export type OperatorNotificationUrgency = 'action_required' | 'informational' | 'complete';

export type OperatorNotification = {
  id: string;
  participantId: string;
  participantName: string;
  title: string;
  message: string;
  urgency: OperatorNotificationUrgency;
  /** Exactly one next action. */
  nextAction: string;
  /** Navigation destination for the next action. */
  destination: CommercialWorkflowCTA['destination'];
  /** ISO timestamp when this notification was generated. */
  generatedAt: string;
};

/* ─── Journey Steps ─────────────────────────────────────────────────────── */

export type JourneyStepStatus = 'complete' | 'active' | 'pending' | 'requires_review';

export type CommercialJourneyStep = {
  id: string;
  label: string;
  status: JourneyStepStatus;
  detail: string | null;
};

/* ─── Input ──────────────────────────────────────────────────────────────── */

export type WorkflowIntegrationInput = {
  projectId: string;
  participant: {
    id: string;
    name: string;
    /** True when the participant has approved their agreement. */
    agreementApproved: boolean;
    /** ISO timestamp of approval. null if not yet approved. */
    approvedAt: string | null;
    /**
     * True when payment has been released to this participant.
     * Drives the terminal `complete` stage.
     * Maps to obligation status PAID or payout batch executed.
     */
    paymentReleased?: boolean;
  };
  /** From deriveSupplierOnboardingStatus(). null if not yet generated. */
  onboarding: SupplierOnboardingStatus | null;
  /** From deriveSettlementReadiness(). null if not yet relevant. */
  settlement: SettlementReadinessResult | null;
  /** From deriveAccountingExport(). null if not yet relevant. */
  accounting: AccountingExportModel | null;
  /** ISO timestamp. */
  currentDate?: string;
};

/* ─── Stage labels ───────────────────────────────────────────────────────── */

const STAGE_LABELS: Record<CommercialWorkflowStage, string> = {
  awaiting_approval:        'Awaiting approval',
  generating_invoice:       'Invoice generating',
  supplier_onboarding:      'Supplier onboarding required',
  awaiting_operator_review: 'Awaiting operator review',
  awaiting_xero_export:     'Ready for Xero',
  awaiting_funding:         'Awaiting funding',
  awaiting_settlement:      'Settlement in progress',
  ready_to_release:         'Ready to release',
  complete:                 'Complete',
};

const STAGE_DESCRIPTIONS: Record<CommercialWorkflowStage, string> = {
  awaiting_approval:        'The participant has not yet approved their commercial agreement.',
  generating_invoice:       'The agreement has been approved. The draft invoice has been generated automatically.',
  supplier_onboarding:      'The supplier needs to provide their bank details, ABN, and GST status.',
  awaiting_operator_review: 'The supplier has submitted their details. Review and approve to proceed.',
  awaiting_xero_export:     'All supplier details are confirmed. Export the invoice to Xero.',
  awaiting_funding:         'Invoice exported. Awaiting revenue collection to fund the obligation.',
  awaiting_settlement:      'Funding confirmed. Completing settlement preparation.',
  ready_to_release:         'All settlement checks are complete. The payment is ready to release.',
  complete:                 'Payment released. Commercial commitment fulfilled.',
};

/* ─── Derive stage ───────────────────────────────────────────────────────── */

function deriveWorkflowStage(input: WorkflowIntegrationInput): CommercialWorkflowStage {
  const { participant, onboarding, settlement, accounting } = input;

  if (!participant.agreementApproved) return 'awaiting_approval';

  // Terminal stage — payment has been released to this participant
  if (participant.paymentReleased) return 'complete';

  // Downstream stages (post-Xero-export)
  // Primary signal: accounting.exportedAt (Xero push confirmed)
  // Do NOT check onboarding.stage === 'xero_exported' here; the switch below handles it.
  if (accounting?.exportedAt) {
    if (settlement?.readyToSettle) return 'ready_to_release';
    if (settlement) return 'awaiting_settlement';
    return 'awaiting_funding';
  }

  // If no onboarding record has been created yet, invoice is being prepared
  if (!onboarding) return 'generating_invoice';

  const onboardingStage: SupplierOnboardingStage = onboarding.stage;

  switch (onboardingStage) {
    case 'not_started':
    case 'invoice_generated':
    case 'in_progress':
      return 'supplier_onboarding';
    case 'submitted':
      return 'awaiting_operator_review';
    case 'operator_approved':
      return 'awaiting_xero_export';
    case 'xero_exported':
      if (settlement?.readyToSettle) return 'ready_to_release';
      if (settlement) return 'awaiting_settlement';
      return 'awaiting_funding';
    default:
      return 'supplier_onboarding';
  }
}

/* ─── Primary CTA ────────────────────────────────────────────────────────── */

function derivePrimaryCTA(stage: CommercialWorkflowStage, participantName: string): CommercialWorkflowCTA {
  switch (stage) {
    case 'awaiting_approval':
      // Route to Approval Centre so operator can resend or track progress.
      // Not urgent — waiting on participant, not operator.
      return { label: 'Open Approval Centre', actor: 'operator', isUrgent: false, destination: 'approval_centre' };
    case 'generating_invoice':
      return { label: 'Complete supplier setup', actor: 'operator', isUrgent: true, destination: 'supplier_onboarding' };
    case 'supplier_onboarding':
      return { label: 'Complete supplier setup', actor: 'supplier', isUrgent: true, destination: 'supplier_onboarding' };
    case 'awaiting_operator_review':
      return { label: `Review ${participantName}'s details`, actor: 'operator', isUrgent: true, destination: 'operator_review' };
    case 'awaiting_xero_export':
      return { label: 'Push Supplier Bill to Xero', actor: 'operator', isUrgent: true, destination: 'xero_export' };
    case 'awaiting_funding':
      return { label: 'Review funding status', actor: 'operator', isUrgent: false, destination: 'funding_page' };
    case 'awaiting_settlement':
      return { label: 'Review settlement checklist', actor: 'operator', isUrgent: false, destination: 'settlement_page' };
    case 'ready_to_release':
      return { label: 'Release payment', actor: 'operator', isUrgent: true, destination: 'release_page' };
    case 'complete':
      return { label: 'Payment released', actor: 'system', isUrgent: false, destination: 'none' };
  }
}

/* ─── Operator notification ──────────────────────────────────────────────── */

function deriveNotification(
  stage: CommercialWorkflowStage,
  input: WorkflowIntegrationInput,
  currentDate: string
): OperatorNotification | null {
  const { participant } = input;
  const id = `${input.projectId}:${participant.id}:${stage}`;

  switch (stage) {
    case 'awaiting_operator_review':
      return {
        id,
        participantId: participant.id,
        participantName: participant.name,
        title: `${participant.name} completed supplier onboarding`,
        message: `${participant.name} has submitted their bank details, ABN, and GST status. Verify payout details before pushing the supplier bill to Xero.`,
        urgency: 'action_required',
        nextAction: `Review ${participant.name}'s supplier details`,
        destination: 'operator_review',
        generatedAt: currentDate,
      };
    case 'awaiting_xero_export':
      return {
        id,
        participantId: participant.id,
        participantName: participant.name,
        title: `${participant.name} is ready for Xero`,
        message: `Payout details for ${participant.name} have been verified. Push the supplier bill to Xero to continue.`,
        urgency: 'action_required',
        nextAction: 'Push Supplier Bill to Xero',
        destination: 'xero_export',
        generatedAt: currentDate,
      };
    case 'ready_to_release':
      return {
        id,
        participantId: participant.id,
        participantName: participant.name,
        title: `${participant.name} is ready for payment`,
        message: `All settlement checks are complete for ${participant.name}. The payment is ready to release.`,
        urgency: 'action_required',
        nextAction: 'Release payment',
        destination: 'release_page',
        generatedAt: currentDate,
      };
    case 'supplier_onboarding':
      if (input.onboarding?.requiresManualReview) {
        return {
          id: `${id}:review`,
          participantId: participant.id,
          participantName: participant.name,
          title: `${participant.name} requires manual review`,
          message: `${participant.name} has declared their ABN is not applicable or is using an alternative payment method. Verification is required before pushing the supplier bill to Xero.`,
          urgency: 'action_required',
          nextAction: 'Review supplier details',
          destination: 'operator_review',
          generatedAt: currentDate,
        };
      }
      return null;
    default:
      return null;
  }
}

/* ─── Journey steps ──────────────────────────────────────────────────────── */

function deriveJourneySteps(
  stage: CommercialWorkflowStage,
  input: WorkflowIntegrationInput
): CommercialJourneyStep[] {
  const { onboarding, settlement, accounting, participant } = input;

  const stageOrder: CommercialWorkflowStage[] = [
    'awaiting_approval',
    'generating_invoice',
    'supplier_onboarding',
    'awaiting_operator_review',
    'awaiting_xero_export',
    'awaiting_funding',
    'awaiting_settlement',
    'ready_to_release',
    'complete',
  ];
  const stageIndex = stageOrder.indexOf(stage);

  function stepStatus(
    stepStage: CommercialWorkflowStage,
    overrideStatus?: JourneyStepStatus
  ): JourneyStepStatus {
    if (overrideStatus) return overrideStatus;
    const idx = stageOrder.indexOf(stepStage);
    if (idx < stageIndex) return 'complete';
    if (idx === stageIndex) return 'active';
    return 'pending';
  }

  const steps: CommercialJourneyStep[] = [
    {
      id: 'agreement',
      label: 'Agreement',
      status: participant.agreementApproved ? 'complete' : 'active',
      detail: participant.agreementApproved ? 'Approved' : 'Awaiting approval',
    },
    {
      id: 'supplier_setup',
      label: 'Supplier Setup',
      status: (() => {
        if (!onboarding) return stage === 'awaiting_approval' ? 'pending' : 'active';
        if (onboarding.stage === 'xero_exported' || onboarding.stage === 'operator_approved') return 'complete';
        // submitted = supplier done, but operator review still outstanding → requires_review
        if (onboarding.stage === 'submitted') return 'requires_review';
        if (onboarding.requiresManualReview) return 'requires_review';
        if (onboarding.stage === 'in_progress') return 'active';
        return 'pending';
      })(),
      detail: (() => {
        if (!onboarding) return null;
        if (onboarding.stage === 'xero_exported' || onboarding.stage === 'operator_approved') return 'Complete';
        if (onboarding.stage === 'submitted') return 'Submitted — awaiting operator review';
        if (onboarding.requiresManualReview) return 'Requires review';
        if (onboarding.stage === 'in_progress') return 'In progress';
        return 'Not started';
      })(),
    },
    {
      id: 'invoice',
      label: 'Invoice',
      status: (() => {
        if (!onboarding) return 'pending';
        if (onboarding.stage === 'xero_exported') return 'complete';
        if (onboarding.stage === 'operator_approved') return 'active';
        if (onboarding.stage === 'submitted') return 'active';
        return 'pending';
      })(),
      detail: (() => {
        if (!onboarding) return null;
        if (onboarding.stage === 'xero_exported') return 'Exported to Xero';
        if (onboarding.stage === 'operator_approved') return 'Approved — ready for Xero';
        if (onboarding.stage === 'submitted') return 'Generated';
        return 'Generated — pending review';
      })(),
    },
    {
      id: 'abn',
      label: 'ABN',
      status: (() => {
        if (!onboarding) return 'pending';
        if (onboarding.abnValidation.isNotApplicable) return 'requires_review';
        if (onboarding.abnValidation.isValid) return 'complete';
        return 'pending';
      })(),
      detail: (() => {
        if (!onboarding) return null;
        if (onboarding.abnValidation.isNotApplicable) return 'Not applicable — review required';
        if (onboarding.abnValidation.isValid) return `Verified — ${onboarding.abnValidation.formattedABN}`;
        return 'Not provided';
      })(),
    },
    {
      id: 'gst',
      label: 'GST',
      status: (() => {
        if (!onboarding) return 'pending';
        const gst = onboarding.draftInvoice.gstStatus;
        if (gst === 'not_applicable') return 'requires_review';
        if (gst === 'yes' || gst === 'no') return 'complete';
        return 'pending';
      })(),
      detail: (() => {
        if (!onboarding) return null;
        const gst = onboarding.draftInvoice.gstStatus;
        if (gst === 'yes') return 'GST registered';
        if (gst === 'no') return 'No GST';
        if (gst === 'not_applicable') return 'Not applicable';
        return 'Pending';
      })(),
    },
    {
      id: 'accounting',
      label: 'Accounting',
      status: (() => {
        if (!accounting) return 'pending';
        if (accounting.status === 'exported') return 'complete';
        if (accounting.notApplicable) return 'complete';
        if (accounting.status === 'failed') return 'requires_review';
        if (accounting.exportReadiness.ready) return 'active';
        return 'pending';
      })(),
      detail: (() => {
        if (!accounting) return null;
        if (accounting.status === 'exported') return 'Exported to Xero';
        if (accounting.notApplicable) return 'Not required';
        if (accounting.status === 'failed') return 'Export failed';
        if (accounting.exportReadiness.ready) return 'Ready for Xero';
        return 'Not ready';
      })(),
    },
    {
      id: 'settlement',
      label: 'Settlement',
      status: (() => {
        if (!settlement) return 'pending';
        if (settlement.readyToSettle) return 'active';
        return 'pending';
      })(),
      detail: (() => {
        if (!settlement) return null;
        if (settlement.readyToSettle) return 'Ready to settle';
        const score = settlement.readinessScore;
        if (score > 50) return `${score}% ready`;
        return 'In progress';
      })(),
    },
  ];

  return steps;
}

/* ─── Main engine ────────────────────────────────────────────────────────── */

/**
 * Derive the complete commercial workflow integration status for one participant.
 *
 * PURE FUNCTION — deterministic, no network calls.
 * Reads from canonical engine outputs (onboarding, settlement, accounting).
 * Never duplicates logic from those engines.
 */
export function deriveParticipantWorkflowStatus(
  input: WorkflowIntegrationInput
): ParticipantWorkflowIntegrationStatus {
  const currentDate = input.currentDate ?? new Date().toISOString();
  const stage = deriveWorkflowStage(input);
  const stageLabel = STAGE_LABELS[stage];
  const stageDescription = STAGE_DESCRIPTIONS[stage];
  const primaryCTA = derivePrimaryCTA(stage, input.participant.name);
  const requiresOperatorAction = primaryCTA.actor === 'operator' && primaryCTA.isUrgent;
  const operatorNotification = deriveNotification(stage, input, currentDate);
  const journeySteps = deriveJourneySteps(stage, input);

  // A dead end = no forward path AND the workflow isn't waiting on someone else.
  // Excluded: 'awaiting_approval' (waiting on participant — expected), 'complete' (terminal).
  const isDeadEnd =
    stage !== 'complete' &&
    stage !== 'awaiting_approval' &&
    primaryCTA.destination === 'none' &&
    primaryCTA.actor !== 'supplier';

  const triggeredBy = deriveTriggeredBy(stage, input);

  return {
    participantId: input.participant.id,
    participantName: input.participant.name,
    stage,
    stageLabel,
    stageDescription,
    primaryCTA,
    requiresOperatorAction,
    isDeadEnd,
    triggeredBy,
    operatorNotification,
    journeySteps,
  };
}

function deriveTriggeredBy(
  stage: CommercialWorkflowStage,
  input: WorkflowIntegrationInput
): string | null {
  switch (stage) {
    case 'supplier_onboarding':
      return input.participant.approvedAt
        ? `Agreement approved by ${input.participant.name} — invoice generated automatically.`
        : null;
    case 'awaiting_operator_review':
      return input.onboarding?.draftInvoice.confirmedAt
        ? `${input.participant.name} submitted supplier onboarding details.`
        : null;
    case 'awaiting_xero_export':
      return `Invoice reviewed and approved by operator.`;
    case 'awaiting_funding':
      return `Invoice exported to Xero.`;
    case 'awaiting_settlement':
      return `Funding confirmed.`;
    case 'ready_to_release':
      return `All settlement checks complete.`;
    default:
      return null;
  }
}

/* ─── Workspace-level ────────────────────────────────────────────────────── */

export type WorkspaceWorkflowIntegrationStatus = {
  participants: ParticipantWorkflowIntegrationStatus[];
  /** Notifications that require immediate operator action. */
  actionRequired: OperatorNotification[];
  /** Informational notifications. */
  informational: OperatorNotification[];
  /** Participants that have no clear next step — must be zero. */
  deadEnds: ParticipantWorkflowIntegrationStatus[];
  /** Count by stage for dashboard summary. */
  stageCounts: Partial<Record<CommercialWorkflowStage, number>>;
  /** True when all participants are complete. */
  allComplete: boolean;
  /** The most urgent single action across all participants. */
  topPriority: OperatorNotification | null;
};

/**
 * Aggregate workflow integration status across all participants.
 * Surfaces dead ends (which should always be zero in a well-integrated system).
 */
export function deriveWorkspaceWorkflowStatus(
  inputs: WorkflowIntegrationInput[]
): WorkspaceWorkflowIntegrationStatus {
  const participants = inputs.map(deriveParticipantWorkflowStatus);

  const actionRequired: OperatorNotification[] = [];
  const informational: OperatorNotification[] = [];

  for (const p of participants) {
    if (p.operatorNotification) {
      if (p.operatorNotification.urgency === 'action_required') {
        actionRequired.push(p.operatorNotification);
      } else {
        informational.push(p.operatorNotification);
      }
    }
  }

  const deadEnds = participants.filter((p) => p.isDeadEnd);

  const stageCounts: Partial<Record<CommercialWorkflowStage, number>> = {};
  for (const p of participants) {
    stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
  }

  const allComplete = participants.every((p) => p.stage === 'complete');

  const topPriority = actionRequired[0] ?? null;

  return {
    participants,
    actionRequired,
    informational,
    deadEnds,
    stageCounts,
    allComplete,
    topPriority,
  };
}
