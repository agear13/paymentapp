import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  composeAgreementBriefingSnapshot,
  type AgreementBriefingSnapshot,
  type BriefingObligationRowInput,
} from '@/lib/agreements/agreement-briefing.model';
import type {
  AgreementFundingFunnelStep,
  AgreementIntelligenceOutput,
  AgreementParticipantAction,
  AgreementPrimaryRecommendation,
  AgreementSettlementBlocker,
} from '@/lib/agreements/intelligence/agreement-intelligence.types';
import { deriveCanonicalAgreementState } from '@/lib/operations/contracts/canonical-agreement-lifecycle';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability/types';
import type { OperationalReleaseBlockerDetail } from '@/lib/operations/explainability/derive-operational-release-blockers';
import { compressOperationalBlockers } from '@/lib/operations/explainability/deduplicate-operational-actions';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import { safeOperationalNavigation } from '@/lib/operations/routing/operational-route-recovery';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import type { ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import { projectParticipantsPath } from '@/lib/projects/project-routes';

const BLOCKER_CATEGORY_LABELS: Record<OperationalReleaseBlockerDetail['category'], string> = {
  funding_missing: 'Funding incomplete',
  participant_approval_missing: 'Approval pending',
  payout_details_missing: 'Settlement account missing',
  compensation_configuration_missing: 'Commercial terms incomplete',
  operational_graph_initializing: 'Coordination syncing',
  obligation_sync_pending: 'Obligation sync pending',
  settlement_reconciliation_pending: 'Funding allocation pending',
  provider_missing: 'Infrastructure not configured',
};

export type AgreementIntelligenceInput = {
  projectId: string;
  deal: RecentDeal;
  summary: ProjectWorkspaceSummary;
  participants: DemoParticipant[];
  obligationRows: BriefingObligationRowInput[];
  treasury: ProjectTreasurySummary | null;
  kpis: OperationalKPIs | null | undefined;
  graph: OperationalCoordinationSnapshot;
  guidance: OperationalGuidanceBundle;
  releaseBlockers?: OperationalReleaseBlockerDetail[];
  workspaceContext: WorkspaceOperationalContext;
};

type AgreementIntelligenceEnrichedInput = AgreementIntelligenceInput & {
  snapshot: AgreementBriefingSnapshot;
};

function resolveHref(href: string | undefined, projectId: string, intent?: OperationalReleaseBlockerDetail['ctaIntent']): string {
  if (href?.trim()) return href;
  if (intent) return safeOperationalNavigation(intent, projectId);
  return safeOperationalNavigation('open_project', projectId);
}

function derivePrimaryRecommendation(input: AgreementIntelligenceInput): AgreementPrimaryRecommendation | null {
  const { guidance, projectId, releaseBlockers, graph, kpis, treasury } = input;
  const blockers = releaseBlockers ?? guidance.releaseBlockers ?? [];

  const rankedAction = guidance.actions[0];
  if (rankedAction) {
    return {
      action: rankedAction.action,
      reason: rankedAction.reason,
      impact: rankedAction.impact,
      ctaLabel: rankedAction.ctaLabel ?? 'Take action',
      ctaHref: resolveHref(rankedAction.destination, projectId),
      urgency: rankedAction.urgency,
    };
  }

  const primaryBlocker = blockers[0];
  if (primaryBlocker) {
    return {
      action: primaryBlocker.remediation,
      reason: primaryBlocker.reason,
      impact: primaryBlocker.unlockCondition,
      ctaLabel: primaryBlocker.ctaLabel,
      ctaHref: resolveHref(primaryBlocker.ctaHref, projectId, primaryBlocker.ctaIntent),
      urgency: primaryBlocker.severity === 'blocking' ? 'critical' : 'high',
    };
  }

  const releaseReadyCount = graph.summary.releaseReadyCount;
  const participantCount = Math.max(kpis?.participantCount ?? 0, input.participants.length);
  const fundingReady =
    (treasury?.confirmedFunding ?? 0) > 0 ||
    input.deal.paymentStatus === 'Paid' ||
    Boolean(treasury?.hasFundingSources);

  if (
    guidance.releaseConfidence.level === 'HIGH' &&
    releaseReadyCount > 0 &&
    fundingReady
  ) {
    return {
      action: 'Agreement ready for settlement',
      reason: guidance.releaseConfidence.explainability.headline,
      impact: `${releaseReadyCount} participant${releaseReadyCount === 1 ? '' : 's'} ready for release under this agreement.`,
      ctaLabel: 'Review settlement',
      ctaHref: safeOperationalNavigation('review_release', projectId),
      urgency: 'medium',
    };
  }

  if (fundingReady && (kpis?.obligationCount ?? 0) > 0 && releaseReadyCount === 0) {
    return {
      action: 'Revenue allocation ready for review',
      reason: 'Funding is on file but participant obligations still need coordination.',
      impact: 'Review allocations to move this agreement toward settlement readiness.',
      ctaLabel: 'Review obligations',
      ctaHref: safeOperationalNavigation('review_obligations', projectId),
      urgency: 'high',
    };
  }

  if (participantCount === 0) {
    return {
      action: 'Add agreement participants',
      reason: 'No participants are identified for this agreement yet.',
      impact: 'Participants define who earns, approves, and receives settlement.',
      ctaLabel: 'Manage participants',
      ctaHref: projectParticipantsPath(projectId),
      urgency: 'critical',
    };
  }

  return {
    action: 'Continue agreement coordination',
    reason: guidance.explanation.explainability.headline || input.summary.operationalStageLabel,
    impact: guidance.explanation.explainability.bullets[0] ?? 'Complete setup steps to unlock settlement.',
    ctaLabel: 'Open agreement',
    ctaHref: safeOperationalNavigation('open_project', projectId),
    urgency: 'medium',
  };
}

function mapSettlementBlocker(
  blocker: OperationalReleaseBlockerDetail,
  projectId: string
): AgreementSettlementBlocker {
  return {
    id: blocker.id,
    label: BLOCKER_CATEGORY_LABELS[blocker.category] ?? blocker.reason,
    severity: blocker.severity,
    owner: blocker.participantName ?? (blocker.operatorActionRequired ? 'Operator' : 'System'),
    resolution: blocker.remediation,
    ctaLabel: blocker.ctaLabel,
    ctaHref: resolveHref(blocker.ctaHref, projectId, blocker.ctaIntent),
  };
}

function deriveSettlementBlockers(input: AgreementIntelligenceEnrichedInput): AgreementSettlementBlocker[] {
  const blockers = input.releaseBlockers ?? input.guidance.releaseBlockers ?? [];
  if (blockers.length > 0) {
    return blockers.slice(0, 6).map((b) => mapSettlementBlocker(b, input.projectId));
  }

  return input.snapshot.blockingIssues.slice(0, 6).map((issue, index) => ({
    id: `snapshot-blocker-${index}`,
    label: issue.label,
    severity: 'blocking' as const,
    owner: 'Operator',
    resolution: `Resolve: ${issue.label}`,
    ctaHref: safeOperationalNavigation('resolve_issue', input.projectId),
    ctaLabel: 'Review',
  }));
}

function deriveFundingFunnel(input: AgreementIntelligenceEnrichedInput): AgreementFundingFunnelStep[] {
  const { deal, treasury, kpis, guidance, participants, workspaceContext, graph } = input;
  const obligationsTotal = treasury?.obligationsTotal ?? kpis?.obligationCount ?? 0;
  const obligationsReady = treasury?.obligationsReady ?? kpis?.fundedObligationCount ?? 0;
  const confirmedFunding = treasury?.confirmedFunding ?? 0;
  const pendingFunding = treasury?.pendingFunding ?? 0;
  const hasFundingSource = Boolean(treasury?.hasFundingSources) || Boolean(deal.paymentLink);
  const fundingReceived =
    confirmedFunding > 0 || deal.paymentStatus === 'Paid' || (hasFundingSource && pendingFunding > 0);

  const obligationsSatisfied =
    obligationsTotal > 0 && obligationsReady + 0.005 >= obligationsTotal;
  const obligationsPartial =
    obligationsTotal > 0 && obligationsReady > 0 && obligationsReady < obligationsTotal;

  const pendingApprovals = participants.filter((p) => p.approvalStatus !== 'Approved').length;
  const approvalsComplete = participants.length > 0 && pendingApprovals === 0;

  const releaseReadyCount = graph.summary.releaseReadyCount;
  const settlementReady =
    guidance.releaseConfidence.level === 'HIGH' ||
    (releaseReadyCount > 0 && releaseReadyCount >= graph.summary.participantCount);
  const settlementPartial =
    !settlementReady &&
    (releaseReadyCount > 0 || guidance.releaseConfidence.level === 'MEDIUM');

  const settlementReleased = workspaceContext.releaseBatchCount > 0;

  return [
    {
      id: 'agreement-created',
      label: 'Agreement Created',
      status: 'complete',
      detail: input.snapshot.createdLabel,
    },
    {
      id: 'funding-received',
      label: 'Funding Received',
      status: fundingReceived
        ? confirmedFunding > 0 || deal.paymentStatus === 'Paid'
          ? 'complete'
          : 'attention'
        : hasFundingSource
          ? 'attention'
          : 'pending',
      detail: treasury?.fundingLabel ?? input.summary.fundingLabel,
    },
    {
      id: 'obligations-satisfied',
      label: 'Obligations Satisfied',
      status: obligationsSatisfied
        ? 'complete'
        : obligationsPartial
          ? 'attention'
          : obligationsTotal > 0
            ? 'attention'
            : 'pending',
      detail:
        obligationsTotal > 0
          ? `${obligationsReady} of ${obligationsTotal} obligation(s) ready`
          : 'Obligations not yet generated',
    },
    {
      id: 'approvals-complete',
      label: 'Approvals Complete',
      status: approvalsComplete
        ? 'complete'
        : pendingApprovals > 0
          ? 'attention'
          : 'pending',
      detail:
        pendingApprovals > 0
          ? `${pendingApprovals} approval(s) pending`
          : participants.length > 0
            ? 'All participant agreements captured'
            : 'Add participants to begin approvals',
    },
    {
      id: 'settlement-ready',
      label: 'Settlement Ready',
      status: settlementReady
        ? 'complete'
        : settlementPartial
          ? 'attention'
          : 'pending',
      detail: settlementReady
        ? `${releaseReadyCount} participant(s) ready for release`
        : guidance.releaseConfidence.explainability.headline,
    },
    {
      id: 'settlement-released',
      label: 'Settlement Released',
      status: settlementReleased ? 'complete' : settlementReady ? 'attention' : 'pending',
      detail: settlementReleased
        ? 'Settlement release recorded for this workspace'
        : settlementReady
          ? 'Ready to coordinate settlement release'
          : 'Awaiting settlement readiness',
    },
  ];
}

function participantActionFromParticipant(
  participant: DemoParticipant,
  projectId: string,
  fundingAllocated: boolean,
  obligationCount: number,
  graphRow?: OperationalCoordinationSnapshot['participants'][number]
): AgreementParticipantAction {
  const participantsHref = projectParticipantsPath(projectId);

  if (graphRow?.releaseReadiness.releaseReady) {
    return {
      participantId: participant.id,
      participantName: participant.name,
      role: participant.role,
      requiredAction: 'Review allocation',
      status: 'Ready',
      priority: 'medium',
      ctaLabel: 'View participant',
      ctaHref: participantsHref,
      isBlocking: false,
    };
  }

  const primaryBlocker =
    graphRow?.releaseReadiness.primaryBlocker ?? graphRow?.releaseReadiness.operationalBlockers[0];
  if (primaryBlocker) {
    const blocking = primaryBlocker.severity === 'blocking';
    return {
      participantId: participant.id,
      participantName: participant.name,
      role: participant.role,
      requiredAction: primaryBlocker.requiredAction,
      status: blocking ? 'Blocking settlement' : 'Needs attention',
      priority: blocking ? 'high' : 'medium',
      ctaLabel: primaryBlocker.ctaLabel ?? 'Resolve',
      ctaHref: resolveHref(primaryBlocker.resolutionRoute, projectId),
      isBlocking: blocking,
    };
  }

  const lifecycle = deriveCanonicalAgreementState(participant, {
    fundingAllocated,
    obligationCount,
  });

  if (lifecycle === 'DRAFT' || lifecycle === 'SHARED_FOR_APPROVAL' || lifecycle === 'VIEWED_BY_PARTICIPANT') {
    return {
      participantId: participant.id,
      participantName: participant.name,
      role: participant.role,
      requiredAction: 'Complete participation agreement',
      status: 'Blocking settlement',
      priority: 'high',
      ctaLabel: 'Manage participant',
      ctaHref: participantsHref,
      isBlocking: true,
    };
  }

  if (
    participant.approvalStatus === 'Approved' &&
    !participant.payoutVerificationConfirmed &&
    participant.compensationProfile?.exemptFromPayout !== true
  ) {
    return {
      participantId: participant.id,
      participantName: participant.name,
      role: participant.role,
      requiredAction: 'Submit settlement details',
      status: 'Blocking settlement',
      priority: 'high',
      ctaLabel: 'Confirm details',
      ctaHref: participantsHref,
      isBlocking: true,
    };
  }

  if (!hasPersistedCompensationTerms(participant) && participant.compensationProfile?.exemptFromPayout !== true) {
    return {
      participantId: participant.id,
      participantName: participant.name,
      role: participant.role,
      requiredAction: 'Configure participant earnings',
      status: 'Blocking settlement',
      priority: 'high',
      ctaLabel: 'Configure earnings',
      ctaHref: safeOperationalNavigation('configure_earnings', projectId),
      isBlocking: true,
    };
  }

  return {
    participantId: participant.id,
    participantName: participant.name,
    role: participant.role,
    requiredAction: 'Review coordination status',
    status: 'Coordinating',
    priority: 'low',
    ctaLabel: 'View participant',
    ctaHref: participantsHref,
    isBlocking: false,
  };
}

function participantActionFromGraphRow(
  row: OperationalCoordinationSnapshot['participants'][number],
  projectId: string,
  fundingAllocated: boolean,
  obligationCount: number
): AgreementParticipantAction {
  return participantActionFromParticipant(
    row.participant,
    projectId,
    fundingAllocated,
    obligationCount,
    row
  );
}

function deriveParticipantActions(input: AgreementIntelligenceInput): AgreementParticipantAction[] {
  const fundingAllocated = input.treasury?.hasFundingSources ?? input.graph.funding.allocated;
  const obligationCount = input.kpis?.obligationCount ?? input.graph.obligations.length;

  const actions =
    input.graph.participants.length > 0
      ? input.graph.participants.map((row) =>
          participantActionFromGraphRow(row, input.projectId, fundingAllocated, obligationCount)
        )
      : input.participants.map((participant) =>
          participantActionFromParticipant(
            participant,
            input.projectId,
            fundingAllocated,
            obligationCount
          )
        );

  return actions.sort((a, b) => {
      const priorityRank = { high: 0, medium: 1, low: 2 };
      if (a.isBlocking !== b.isBlocking) return a.isBlocking ? -1 : 1;
      return priorityRank[a.priority] - priorityRank[b.priority];
    });
}

/** Single source of truth for agreement operational intelligence. */
export function deriveAgreementIntelligence(input: AgreementIntelligenceInput): AgreementIntelligenceOutput {
  const blockerLabels = compressOperationalBlockers(
    input.guidance.explanation.blockers,
    input.guidance.actions[0]?.action
  ).map((b) => b.replace(/\.$/, ''));

  const snapshot = composeAgreementBriefingSnapshot({
    deal: input.deal,
    summary: input.summary,
    participants: input.participants,
    obligationRows: input.obligationRows,
    treasury: input.treasury,
    kpis: input.kpis,
    graphParticipants: input.graph.participants,
    releaseConfidenceLevel: input.guidance.releaseConfidence.level,
    blockerLabels,
  });

  const enrichedInput: AgreementIntelligenceEnrichedInput = { ...input, snapshot };

  return {
    snapshot,
    primaryRecommendation: derivePrimaryRecommendation(enrichedInput),
    settlementBlockers: deriveSettlementBlockers(enrichedInput),
    fundingFunnel: deriveFundingFunnel(enrichedInput),
    participantActions: deriveParticipantActions(input),
  };
}
