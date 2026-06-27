/**
 * Commercial Workflow Notifications
 *
 * Canonical notification generator for commercial workflow milestones.
 *
 * Design rules:
 *   - Each notification has exactly ONE next action.
 *   - Notifications are generated per commercial milestone, not by polling.
 *   - Urgency is derived from the stage — never from human judgment.
 *   - Copy is operator-realistic: specific, actionable, commercial.
 *   - This module does NOT render UI. It produces notification records only.
 *
 * Used by:
 *   - Dashboard notification queue
 *   - Provvy Daily Queue
 *   - Email queuing (future)
 *   - Push notifications (future)
 */

import type { CommercialWorkflowStage, OperatorNotification } from './workflow-integration';
import type { WorkspaceWorkflowIntegrationStatus } from './workflow-integration';

/* ─── Notification types ────────────────────────────────────────────────── */

export type WorkflowNotificationFeed = {
  /** Notifications that need operator action right now. */
  actionRequired: OperatorNotification[];
  /** Informational milestone updates. */
  informational: OperatorNotification[];
  /** All notifications sorted newest first. */
  all: OperatorNotification[];
  /** Count of action-required notifications. */
  urgentCount: number;
};

/* ─── Notification templates ─────────────────────────────────────────────── */

/**
 * Build notification copy for a specific commercial workflow milestone.
 *
 * Every template:
 *   - Has a specific title (names the participant)
 *   - Has a one-sentence message explaining why it matters
 *   - Has exactly ONE next action (the only thing the operator should do)
 */
export function buildWorkflowNotificationForStage(
  stage: CommercialWorkflowStage,
  context: {
    participantId: string;
    participantName: string;
    projectId: string;
    generatedAt: string;
  }
): OperatorNotification | null {
  const { participantId, participantName, projectId, generatedAt } = context;
  const id = `notif:${projectId}:${participantId}:${stage}`;

  switch (stage) {
    case 'generating_invoice':
      return {
        id,
        participantId,
        participantName,
        title: `Draft invoice generated for ${participantName}`,
        message: `${participantName} approved the agreement. Their invoice was generated automatically from the commercial terms.`,
        urgency: 'informational',
        nextAction: 'Send supplier onboarding',
        destination: 'supplier_onboarding',
        generatedAt,
      };

    case 'supplier_onboarding':
      return {
        id,
        participantId,
        participantName,
        title: `${participantName} requires supplier onboarding`,
        message: `The agreement is approved. Collect bank details, ABN, and GST status from ${participantName} to proceed to settlement.`,
        urgency: 'action_required',
        nextAction: 'Complete supplier setup',
        destination: 'supplier_onboarding',
        generatedAt,
      };

    case 'awaiting_operator_review':
      return {
        id,
        participantId,
        participantName,
        title: `${participantName} completed supplier onboarding`,
        message: `${participantName} submitted their bank details, ABN, and GST status. Review and approve before exporting to Xero.`,
        urgency: 'action_required',
        nextAction: `Review ${participantName}'s details`,
        destination: 'operator_review',
        generatedAt,
      };

    case 'awaiting_xero_export':
      return {
        id,
        participantId,
        participantName,
        title: `${participantName} is ready for Xero`,
        message: `Invoice for ${participantName} is approved. Export to Xero to complete accounting before settlement.`,
        urgency: 'action_required',
        nextAction: 'Push Supplier Bill to Xero',
        destination: 'xero_export',
        generatedAt,
      };

    case 'awaiting_funding':
      return {
        id,
        participantId,
        participantName,
        title: `${participantName}'s invoice exported to Xero`,
        message: `Accounting is complete for ${participantName}. Awaiting revenue collection to fund the obligation.`,
        urgency: 'informational',
        nextAction: 'Review funding status',
        destination: 'funding_page',
        generatedAt,
      };

    case 'ready_to_release':
      return {
        id,
        participantId,
        participantName,
        title: `${participantName} is ready for payment`,
        message: `All settlement checks are complete. Release the payment to ${participantName} to fulfil the commercial obligation.`,
        urgency: 'action_required',
        nextAction: 'Release payment',
        destination: 'release_page',
        generatedAt,
      };

    case 'complete':
      return {
        id,
        participantId,
        participantName,
        title: `${participantName} has been paid`,
        message: `The commercial obligation to ${participantName} has been fulfilled. Payment released successfully.`,
        urgency: 'complete',
        nextAction: 'View commercial performance',
        destination: 'none',
        generatedAt,
      };

    default:
      return null;
  }
}

/* ─── Feed builder ───────────────────────────────────────────────────────── */

/**
 * Build the complete notification feed from workspace workflow status.
 *
 * Aggregates all participant notifications into a prioritised feed.
 * Action-required items always appear first.
 */
export function buildWorkflowNotificationFeed(
  status: WorkspaceWorkflowIntegrationStatus
): WorkflowNotificationFeed {
  const actionRequired: OperatorNotification[] = [];
  const informational: OperatorNotification[] = [];

  for (const p of status.participants) {
    if (!p.operatorNotification) continue;
    if (p.operatorNotification.urgency === 'action_required') {
      actionRequired.push(p.operatorNotification);
    } else {
      informational.push(p.operatorNotification);
    }
  }

  const all = [
    ...actionRequired,
    ...informational,
  ].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

  return {
    actionRequired,
    informational,
    all,
    urgentCount: actionRequired.length,
  };
}

/* ─── Dead end detector ──────────────────────────────────────────────────── */

/**
 * Audit the entire workspace workflow for dead ends.
 *
 * A dead end = a participant in a stage where:
 *   - There is no forward CTA
 *   - The stage is not complete
 *   - No automatic transition is defined
 *
 * In a correctly integrated system this list is always empty.
 * Use this in tests and validation to catch workflow regression.
 */
export function detectWorkflowDeadEnds(
  status: WorkspaceWorkflowIntegrationStatus
): Array<{
  participantId: string;
  participantName: string;
  stage: CommercialWorkflowStage;
  reason: string;
}> {
  return status.deadEnds.map((p) => ({
    participantId: p.participantId,
    participantName: p.participantName,
    stage: p.stage,
    reason: `${p.participantName} is in stage "${p.stage}" with no clear next action. Workflow is broken for this participant.`,
  }));
}

/* ─── Provvy narrative builder ───────────────────────────────────────────── */

/**
 * Build Provvy's summary of outstanding supplier onboarding work.
 * Used in the Provvy Daily Queue on the dashboard.
 *
 * Returns a single sentence. Always specific. Never generic.
 */
export function buildOnboardingProvvyNarrative(
  status: WorkspaceWorkflowIntegrationStatus,
  projectName: string
): string {
  const { actionRequired, informational } = buildWorkflowNotificationFeed(status);
  const counts = status.stageCounts;

  if (status.allComplete) {
    return `All supplier onboarding for ${projectName} is complete. Commercial obligations are fulfilled.`;
  }

  const awaitingReview = counts.awaiting_operator_review ?? 0;
  const awaitingXero = counts.awaiting_xero_export ?? 0;
  const awaitingOnboarding = counts.supplier_onboarding ?? 0;
  const readyToRelease = counts.ready_to_release ?? 0;

  const parts: string[] = [];

  if (readyToRelease > 0) {
    parts.push(`${readyToRelease} supplier${readyToRelease > 1 ? 's are' : ' is'} ready for payment release`);
  }
  if (awaitingReview > 0) {
    parts.push(`${awaitingReview} supplier${awaitingReview > 1 ? 's require' : ' requires'} operator review`);
  }
  if (awaitingXero > 0) {
    parts.push(`${awaitingXero} ${awaitingXero > 1 ? 'invoices are' : 'invoice is'} ready for Xero`);
  }
  if (awaitingOnboarding > 0) {
    parts.push(`${awaitingOnboarding} supplier${awaitingOnboarding > 1 ? 's are' : ' is'} completing onboarding`);
  }

  if (parts.length === 0) return `Supplier onboarding for ${projectName} is in progress.`;

  return `For ${projectName}: ${parts.join(', ')}.`;
}
