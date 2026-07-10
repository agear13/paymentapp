import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { AgreementBriefingSnapshot } from '@/lib/agreements/agreement-briefing.model';
import type { AgreementSettlementBlocker } from '@/lib/agreements/intelligence/agreement-intelligence.types';
import { commercialRolesFromDeal } from '@/lib/projects/commercial-roles/commercial-roles-payload';
import type { GraphSummaryOverride, ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ReleaseConfidenceLevel } from '@/lib/operations/explainability/types';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import {
  type AgreementHealthFactor,
  type AgreementHealthSignals,
  type AgreementHealthSnapshot,
  type AgreementHealthWeights,
  healthCategoryFromScore,
  healthCategoryReason,
  normalizeHealthWeights,
  AGREEMENT_HEALTH_CATEGORY_LABELS,
} from '@/lib/agreements/health/agreement-health.types';
import {
  deriveAgreementHealthTrend,
  recordAgreementHealthSnapshot,
} from '@/lib/agreements/health/agreement-health-trend';

export type DeriveAgreementHealthInput = {
  projectId: string;
  agreementName: string;
  deal: RecentDeal;
  summary: ProjectWorkspaceSummary;
  participants: DemoParticipant[];
  weights?: Partial<AgreementHealthWeights>;
  snapshot?: AgreementBriefingSnapshot;
  treasury?: ProjectTreasurySummary | null;
  kpis?: OperationalKPIs | null;
  graph?: GraphSummaryOverride;
  releaseConfidenceLevel?: ReleaseConfidenceLevel;
  settlementBlockers?: AgreementSettlementBlocker[];
  recordTrend?: boolean;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceToScore(level: ReleaseConfidenceLevel | undefined): number {
  switch (level) {
    case 'HIGH':
      return 92;
    case 'MEDIUM':
      return 74;
    case 'LOW':
      return 56;
    case 'BLOCKED':
      return 28;
    default:
      return 50;
  }
}

export function deriveAgreementHealthSignals(input: DeriveAgreementHealthInput): AgreementHealthSignals {
  const dealParticipants = input.participants.filter(
    (p) => p.dealId === input.deal.id || (p.dealId == null && p.dealName === input.deal.dealName)
  );
  const participantCount = Math.max(
    input.graph?.participantCount ?? input.summary.participantCount,
    dealParticipants.length
  );
  const approvedCount = dealParticipants.filter((p) => p.approvalStatus === 'Approved').length;
  const releaseReadyCount =
    input.graph?.releaseReadyCount ?? input.summary.participantsReady ?? 0;
  const blockerCount =
    input.graph?.blockerCount ??
    input.settlementBlockers?.filter((b) => b.severity === 'blocking').length ??
    0;

  const treasuryFull = input.treasury;
  const treasurySummary = treasuryFull ?? input.summary.treasury;
  const obligationsTotal =
    treasuryFull?.obligationsTotal ??
    (treasurySummary?.obligationsReady != null && treasurySummary?.obligationsAwaitingFunding != null
      ? treasurySummary.obligationsReady + treasurySummary.obligationsAwaitingFunding
      : input.kpis?.obligationCount ?? input.snapshot?.obligationCount ?? 0);
  const obligationsReady =
    treasurySummary?.obligationsReady ?? treasuryFull?.obligationsReady ?? input.kpis?.fundedObligationCount ?? 0;

  const earningsConfigured =
    input.kpis?.earningsConfiguredCount ??
    dealParticipants.filter((p) => p.compensationProfile?.configured).length;

  const roles = commercialRolesFromDeal(input.deal);
  const termsCaptured =
    roles.length > 0 || Boolean(input.deal.payoutTrigger) || input.summary.value > 0;
  const infrastructureConfigured =
    Boolean(treasurySummary?.hasFundingSources) ||
    Boolean(input.deal.paymentLink) ||
    input.deal.paymentStatus === 'Paid';

  const fundingReceived =
    (treasurySummary?.confirmedFunding ?? treasuryFull?.confirmedFunding ?? 0) > 0 ||
    input.deal.paymentStatus === 'Paid' ||
    Boolean(treasurySummary?.hasFundingSources);
  const fundingPending = (treasurySummary?.pendingFunding ?? treasuryFull?.pendingFunding ?? 0) > 0;

  let fundingProgress = 15;
  if (infrastructureConfigured) fundingProgress = 40;
  if (fundingPending) fundingProgress = 55;
  if (fundingReceived) fundingProgress = 80;
  if (
    obligationsTotal > 0 &&
    (treasurySummary?.confirmedFunding ?? treasuryFull?.confirmedFunding ?? 0) + 0.005 >=
      (treasuryFull?.obligationsTotal ?? obligationsTotal)
  ) {
    fundingProgress = 100;
  }

  let obligationCompletion = 30;
  if (obligationsTotal === 0) {
    obligationCompletion = participantCount > 0 ? 45 : 20;
  } else {
    obligationCompletion = clampScore((obligationsReady / obligationsTotal) * 100);
  }

  const participantCompleteness =
    participantCount === 0
      ? 0
      : clampScore((Math.max(earningsConfigured, releaseReadyCount) / participantCount) * 100);

  const approvalProgress =
    participantCount === 0 ? 0 : clampScore((approvedCount / participantCount) * 100);

  const blockingPenalty = Math.min(
    100,
    blockerCount * 22 + (input.settlementBlockers?.length ?? 0) * 8
  );
  const blockerSeverity = clampScore(100 - blockingPenalty);

  const payoutRatio =
    participantCount > 0 ? clampScore((releaseReadyCount / participantCount) * 100) : null;
  const confidenceScore = confidenceToScore(input.releaseConfidenceLevel);
  const settlementReadiness =
    input.snapshot?.settlementReadinessScore ??
    (payoutRatio != null ? clampScore((payoutRatio + confidenceScore) / 2) : confidenceScore);

  return {
    settlementReadiness,
    blockerSeverity,
    approvalProgress,
    fundingProgress: clampScore(fundingProgress),
    participantCompleteness,
    obligationCompletion,
    commercialTermsCompleteness: termsCaptured ? 100 : 25,
    infrastructureReadiness: infrastructureConfigured ? 100 : 20,
  };
}

function buildHealthFactors(
  signals: AgreementHealthSignals,
  input: DeriveAgreementHealthInput
): AgreementHealthFactor[] {
  const blockers = input.settlementBlockers ?? [];
  const pendingApprovals = Math.max(0, input.summary.participantCount - input.summary.participantsReady);

  const factor = (
    id: string,
    label: string,
    dimension: keyof AgreementHealthSignals,
    positiveDetail: string,
    warningDetail: string,
    negativeDetail: string,
    improvesScoreHint: string
  ): AgreementHealthFactor => {
    const dimensionScore = signals[dimension];
    const status =
      dimensionScore >= 85 ? 'positive' : dimensionScore >= 55 ? 'warning' : 'negative';
    const detail =
      status === 'positive' ? positiveDetail : status === 'warning' ? warningDetail : negativeDetail;
    return { id, label, status, detail, dimension, dimensionScore, improvesScoreHint };
  };

  return [
    factor(
      'funding',
      'Funding received',
      'fundingProgress',
      'Funding is connected and progressing toward obligation coverage.',
      fundingPendingLabel(input),
      'Funding sources not yet connected for this project.',
      'Link and confirm funding sources.'
    ),
    factor(
      'obligations',
      'Obligations completed',
      'obligationCompletion',
      'Obligations are funded or ready for settlement coordination.',
      'Some obligations still await funding or approval.',
      'Obligations have not been generated or funded yet.',
      'Review obligations and confirm funding allocation.'
    ),
    factor(
      'participants',
      'Participants configured',
      'participantCompleteness',
      'Participant earnings and settlement paths are configured.',
      'Some participants still need earnings or confirmation.',
      'Add and configure agreement participants.',
      'Configure participant earnings and settlement details.'
    ),
    factor(
      'approvals',
      'Approvals complete',
      'approvalProgress',
      'Participant agreements are captured.',
      pendingApprovals > 0
        ? `${pendingApprovals} approval(s) still pending.`
        : 'Approvals partially complete.',
      'Participation agreements are outstanding.',
      'Request participant approvals.'
    ),
    factor(
      'settlement',
      'Settlement readiness',
      'settlementReadiness',
      'Settlement readiness is strong for this project.',
      'Settlement is approaching readiness with remaining gaps.',
      'Settlement is not yet ready at the agreement level.',
      'Resolve blockers and confirm funding.'
    ),
    factor(
      'blockers',
      'Release blockers',
      'blockerSeverity',
      'No material release blockers detected.',
      blockers.length > 0
        ? `${blockers.length} blocker(s) affecting coordination.`
        : 'Minor coordination friction remains.',
      'Release blockers are preventing settlement.',
      'Clear settlement blockers listed in the briefing.'
    ),
    factor(
      'terms',
      'Commercial terms captured',
      'commercialTermsCompleteness',
      'Commercial terms define how this project settles.',
      'Commercial terms are partially captured.',
      'Commercial terms have not been captured.',
      'Add budgeted roles and settlement schedule.'
    ),
    factor(
      'infrastructure',
      'Collection infrastructure',
      'infrastructureReadiness',
      'Collection or invoice infrastructure is linked.',
      'Infrastructure setup is incomplete.',
      'No collection infrastructure linked yet.',
      'Connect funding sources or invoice collection.'
    ),
  ];
}

function fundingPendingLabel(input: DeriveAgreementHealthInput): string {
  const pending = input.treasury?.pendingFunding ?? input.summary.treasury?.pendingFunding ?? 0;
  if (pending > 0) return 'Funding source added — confirmation pending.';
  return 'Funding setup started — confirmation still needed.';
}

function weightedHealthScore(signals: AgreementHealthSignals, weights: AgreementHealthWeights): number {
  let score = 0;
  for (const key of Object.keys(weights) as (keyof AgreementHealthWeights)[]) {
    score += signals[key] * weights[key];
  }
  return clampScore(score);
}

export function deriveAgreementHealth(input: DeriveAgreementHealthInput): AgreementHealthSnapshot {
  const weights = normalizeHealthWeights(input.weights);
  const signals = deriveAgreementHealthSignals(input);
  const score = weightedHealthScore(signals, weights);
  const category = healthCategoryFromScore(score);
  const factors = buildHealthFactors(signals, input);

  const improvesScore = factors
    .filter((f) => f.status !== 'positive')
    .map((f) => f.improvesScoreHint ?? `Improve ${f.label.toLowerCase()}.`)
    .slice(0, 4);

  const reducesScore = factors
    .filter((f) => f.status === 'negative' || f.status === 'warning')
    .map((f) => f.detail)
    .slice(0, 4);

  const trend = deriveAgreementHealthTrend(input.projectId, score, factors);

  const snapshot: AgreementHealthSnapshot = {
    projectId: input.projectId,
    agreementName: input.agreementName,
    score,
    category,
    categoryLabel: AGREEMENT_HEALTH_CATEGORY_LABELS[category],
    categoryReason: healthCategoryReason(category, score),
    signals,
    weights,
    factors,
    improvesScore,
    reducesScore,
    trend,
    agreementValue: input.summary.value,
    blockerCount:
      input.graph?.blockerCount ??
      input.settlementBlockers?.filter((b) => b.severity === 'blocking').length ??
      0,
    releaseReadyCount: input.graph?.releaseReadyCount ?? input.summary.participantsReady,
    recordedAt: new Date().toISOString(),
  };

  if (input.recordTrend !== false && typeof window !== 'undefined') {
    recordAgreementHealthSnapshot(snapshot);
  }

  return snapshot;
}
