import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalBlockerDetail } from '@/lib/operations/contracts/approval-state';
import {
  deriveAgreementApprovalState,
  deriveOperationalBlocker,
  deriveObligationApprovalState,
} from '@/lib/operations/derivations/derive-approval-state';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import {
  safeOperationalNavigation,
  type OperationalRouteIntent,
} from '@/lib/operations/routing/operational-route-recovery';
import { normalizeParticipantEntity } from '@/lib/operations/guards/hydration-guards';
import { isParticipantPayoutReady } from '@/lib/operations/truth/payout-truth';
import {
  assertPayoutExplainabilityInvariants,
  type PayoutExplainabilityInvariantInput,
} from '@/lib/operations/dev/operational-invariants';
import { deriveWorkspaceParticipantPayoutSummary } from '@/lib/operations/readiness/participant-readiness';

export const OPERATIONAL_RELEASE_BLOCKER_CATEGORIES = [
  'funding_missing',
  'participant_approval_missing',
  'payout_details_missing',
  'compensation_configuration_missing',
  'operational_graph_initializing',
  'obligation_sync_pending',
  'settlement_reconciliation_pending',
  'provider_missing',
] as const;

export type OperationalReleaseBlockerCategory =
  (typeof OPERATIONAL_RELEASE_BLOCKER_CATEGORIES)[number];

export type OperationalReleaseBlockerDetail = {
  id: string;
  category: OperationalReleaseBlockerCategory;
  reason: string;
  remediation: string;
  unlockCondition: string;
  ctaLabel: string;
  ctaHref: string;
  ctaIntent: OperationalRouteIntent;
  /** False when only orchestration refresh/recompute is required. */
  operatorActionRequired: boolean;
  severity: 'blocking' | 'warning';
  participantId?: string;
  participantName?: string;
};

export type OperationalReleaseBlockerInput = {
  snapshot: OperationalCoordinationSnapshot;
  workspace?: WorkspaceOperationalContext;
  graphReady?: boolean;
  initializationRecoveryMessage?: string | null;
};

function semanticBlockerFingerprint(reason: string): string {
  const t = reason.toLowerCase();
  if (/release not ready|not ready for release|safe to release/i.test(t)) return 'release-not-ready';
  if (/earnings|compensation/i.test(t)) return 'compensation';
  if (/payout details|external payout|confirm.*payout/i.test(t)) return 'payout-details';
  if (/agreement|approval|participation/i.test(t)) return 'agreement';
  if (/funding|reserved|settlement|allocation/i.test(t)) return 'funding';
  if (/obligation|orchestration refresh/i.test(t)) return 'obligation-sync';
  if (/provider/i.test(t)) return 'provider';
  return t.slice(0, 48);
}

export function deduplicateReleaseBlockers(
  blockers: OperationalReleaseBlockerDetail[]
): OperationalReleaseBlockerDetail[] {
  const seen = new Set<string>();
  const unique: OperationalReleaseBlockerDetail[] = [];
  for (const d of blockers) {
    const key = d.participantId
      ? `${d.category}:${d.participantId}`
      : `${d.category}:${semanticBlockerFingerprint(d.reason)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(d);
  }
  return unique;
}

function detailFromOperationalBlocker(
  blocker: OperationalBlockerDetail,
  projectId?: string | null
): OperationalReleaseBlockerDetail {
  const explanation = blocker.explanation.toLowerCase();
  let category: OperationalReleaseBlockerCategory = 'participant_approval_missing';
  let ctaIntent: OperationalRouteIntent = 'configure_earnings';
  let ctaLabel = blocker.ctaLabel ?? 'Review participant';
  const operatorActionRequired = true;

  if (/earnings|compensation/i.test(explanation)) {
    category = 'compensation_configuration_missing';
    ctaIntent = 'configure_earnings';
    ctaLabel = 'Configure earnings';
  } else if (/payout details|external payout|confirm.*payout/i.test(explanation)) {
    category = 'payout_details_missing';
    ctaIntent = 'configure_earnings';
    ctaLabel = 'Prepare for payment';
  } else if (/agreement|approval|participation/i.test(explanation)) {
    category = 'participant_approval_missing';
    ctaIntent = 'configure_earnings';
    ctaLabel = 'Review agreement';
  } else if (/funding|reserved|settlement|allocation/i.test(explanation)) {
    category = 'funding_missing';
    ctaIntent = 'review_obligations';
    ctaLabel = 'Review funding';
  }

  return {
    id: blocker.id,
    category,
    reason: blocker.explanation,
    remediation: blocker.requiredAction,
    unlockCondition: blocker.unlocks,
    ctaLabel,
    ctaHref: blocker.resolutionRoute || safeOperationalNavigation(ctaIntent, projectId),
    ctaIntent,
    operatorActionRequired,
    severity: blocker.severity === 'blocking' ? 'blocking' : 'warning',
    participantId: blocker.participantId,
    participantName: blocker.participantName,
  };
}

function countStaleObligationRows(snapshot: OperationalCoordinationSnapshot): number {
  let stale = 0;
  for (const row of snapshot.obligations) {
    if (!row.participantId || !row.allocationStatus) continue;
    const participant = snapshot.participants.find(
      (p) => p.participant?.id === row.participantId
    )?.participant;
    if (!participant) continue;
    const approval = deriveObligationApprovalState({
      obligationStatus: row.allocationStatus,
      participant,
    });
    if (
      approval === 'ready' &&
      (row.allocationStatus === 'PENDING_APPROVAL' || row.allocationStatus === 'UNFUNDED')
    ) {
      stale += 1;
    }
  }
  return stale;
}

function fundingBlockerDetail(
  snapshot: OperationalCoordinationSnapshot,
  projectId?: string | null
): OperationalReleaseBlockerDetail | null {
  const label = snapshot.funding?.stage?.blockerLabel;
  if (!label) return null;

  const isReconciliation = /allocation|reserved|settled/i.test(label);
  return {
    id: 'funding-coordination',
    category: isReconciliation ? 'settlement_reconciliation_pending' : 'funding_missing',
    reason: label,
    remediation: isReconciliation
      ? 'Reserve or allocate confirmed funding against participant obligations.'
      : 'Connect a funding source and confirm customer payments for this project.',
    unlockCondition: isReconciliation
      ? 'Obligation funding totals match confirmed project funding.'
      : 'Confirmed funding covers outstanding participant obligations.',
    ctaLabel: isReconciliation ? 'Review funding allocation' : 'Review funding',
    ctaHref: safeOperationalNavigation('review_obligations', projectId),
    ctaIntent: 'review_obligations',
    operatorActionRequired: true,
    severity: 'blocking',
  };
}

/** Canonical payout release blockers — all payouts surfaces must consume this output. */
export function deriveOperationalReleaseBlockers(
  input: OperationalReleaseBlockerInput
): OperationalReleaseBlockerDetail[] {
  const { snapshot, workspace, graphReady = true, initializationRecoveryMessage } = input;
  const projectId = workspace?.primaryProjectId ?? null;
  const details: OperationalReleaseBlockerDetail[] = [];

  if (!graphReady) {
    details.push({
      id: 'graph-initializing',
      category: 'operational_graph_initializing',
      reason:
        initializationRecoveryMessage ??
        'Settlement graph initialization is incomplete. Funding and participant approvals may already be satisfied.',
      remediation:
        'Resume operational initialization or refresh coordination once rails are connected.',
      unlockCondition:
        'Operational graph reaches OPERATIONAL_GRAPH_READY and coordination snapshot projects release readiness.',
      ctaLabel: 'Resume coordination',
      ctaHref: '/api/operations/initialization/resume',
      ctaIntent: 'continue_setup',
      operatorActionRequired: false,
      severity: 'warning',
    });
  }

  const funding = fundingBlockerDetail(snapshot, projectId);
  if (funding) details.push(funding);

  const staleObligations = countStaleObligationRows(snapshot);
  const payoutReadyButNotRelease =
    snapshot.summary.payoutReadyCount > 0 &&
    snapshot.summary.releaseReadyCount < snapshot.summary.payoutReadyCount;

  if (
    staleObligations > 0 ||
    (payoutReadyButNotRelease && !funding && snapshot.obligations.length > 0)
  ) {
    const count = staleObligations || snapshot.summary.payoutReadyCount - snapshot.summary.releaseReadyCount;
    details.push({
      id: 'obligation-sync-pending',
      category: 'obligation_sync_pending',
      reason: `${count} participant obligation${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} awaiting orchestration refresh after approval confirmation.`,
      remediation:
        'Refresh obligation projections so approved agreements and verified payout details converge in the earnings and release queues.',
      unlockCondition:
        'Obligation allocation statuses match canonical agreement and funding state.',
      ctaLabel: 'Refresh obligations',
      ctaHref: '/api/deal-network-pilot/obligations/refresh',
      ctaIntent: 'review_obligations',
      operatorActionRequired: false,
      severity: 'blocking',
    });
  }

  if (workspace && !workspace.stripeConfigured && !workspace.wiseConfigured && !workspace.hederaConfigured) {
    details.push({
      id: 'provider-missing',
      category: 'provider_missing',
      reason: 'No payment provider is connected to collect project revenue.',
      remediation: 'Connect Stripe, Wise, or your settlement rail in merchant settings.',
      unlockCondition: 'At least one payout collection provider is connected.',
      ctaLabel: 'Connect provider',
      ctaHref: safeOperationalNavigation('connect_provider', projectId),
      ctaIntent: 'connect_provider',
      operatorActionRequired: true,
      severity: 'blocking',
    });
  }

  const graphPayoutSummary = deriveWorkspaceParticipantPayoutSummary(
    snapshot.participants.map((row) => row.participant)
  );
  const participantsNeedSetup = Math.max(
    0,
    graphPayoutSummary.participantCount - graphPayoutSummary.earningsConfiguredCount
  );
  if (participantsNeedSetup > 0 && graphPayoutSummary.participantCount > 0) {
    details.push({
      id: 'compensation-missing',
      category: 'compensation_configuration_missing',
      reason: `${participantsNeedSetup} participant${participantsNeedSetup === 1 ? '' : 's'} still need earnings configuration.`,
      remediation: 'Save compensation structure for each participant on the project.',
      unlockCondition: 'All active participants have configured earnings profiles.',
      ctaLabel: 'Configure earnings',
      ctaHref: safeOperationalNavigation('configure_earnings', projectId),
      ctaIntent: 'configure_earnings',
      operatorActionRequired: true,
      severity: 'blocking',
    });
  }

  for (const p of snapshot.participants) {
    const participant = normalizeParticipantEntity(p.participant);
    if (p.readinessHierarchy?.releaseReady) continue;

    for (const blocker of deriveOperationalBlocker(participant, projectId ?? undefined)) {
      details.push(detailFromOperationalBlocker(blocker, projectId));
    }

    const agreement = deriveAgreementApprovalState(participant);
    if (
      agreement === 'participant_approved' &&
      !participant.compensationProfile?.exemptFromPayout &&
      participant.payoutVerificationConfirmed !== true
    ) {
      details.push({
        id: `payout-details-${participant.id}`,
        category: 'payout_details_missing',
        reason: `Payment setup is required for ${participant.name} before settlement can proceed.`,
        remediation: 'Send the supplier their payment setup link so they can submit bank details, ABN, and GST status.',
        unlockCondition: 'Supplier completes payment setup and operator approves.',
        ctaLabel: 'Prepare for payment',
        ctaHref: safeOperationalNavigation('configure_earnings', projectId),
        ctaIntent: 'configure_earnings',
        operatorActionRequired: true,
        severity: 'blocking',
        participantId: participant.id,
        participantName: participant.name,
      });
    }

    if (
      !isParticipantPayoutReady(participant) &&
      (agreement === 'draft' || agreement === 'shared' || agreement === 'operator_confirmed')
    ) {
      details.push({
        id: `approval-${participant.id}`,
        category: 'participant_approval_missing',
        reason: `Waiting for ${participant.name} to approve the participation agreement.`,
        remediation: 'Share the agreement link and wait for participant approval.',
        unlockCondition: 'Participant agreement status is Approved.',
        ctaLabel: 'Review agreement',
        ctaHref: safeOperationalNavigation('configure_earnings', projectId),
        ctaIntent: 'configure_earnings',
        operatorActionRequired: true,
        severity: 'blocking',
        participantId: participant.id,
        participantName: participant.name,
      });
    }
  }

  const unique = deduplicateReleaseBlockers(details);

  if (typeof window === 'undefined') {
    const invariantInput: PayoutExplainabilityInvariantInput = {
      detailedBlockers: unique,
      graphReady,
      settlementReady:
        !snapshot.funding.stage?.blockerLabel &&
        snapshot.summary.participantCount > 0 &&
        snapshot.summary.releaseReadyCount === snapshot.summary.participantCount,
      staleObligationCount: staleObligations,
      payoutReadyCount: snapshot.summary.payoutReadyCount,
    };
    assertPayoutExplainabilityInvariants(invariantInput);
  }

  return unique;
}

export function releaseBlockerSummaryLines(
  blockers: OperationalReleaseBlockerDetail[]
): string[] {
  return blockers.map((b) => `${b.reason} ${b.remediation}`);
}
