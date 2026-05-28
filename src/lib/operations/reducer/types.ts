import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalBlockerDetail } from '@/lib/operations/contracts/approval-state';
import type { HydratedObligation } from '@/lib/operations/contracts/obligation-contract';
import type { OperationalEvent, OperationalEventType } from '@/lib/operations/contracts/operational-events';
import type { CatalogItemRef } from '@/lib/operations/derivations/commission-scope';
import type { OperationalReleaseBlockerDetail } from '@/lib/operations/explainability/derive-operational-release-blockers';
import type { ReleaseConfidenceLevel, TimelineEvent } from '@/lib/operations/explainability/types';
import type { ParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import type { PayoutReleaseReadiness } from '@/lib/operations/readiness/derive-payout-release-readiness';
import type { FundingCoordinationInput } from '@/lib/operations/truth/funding-coordination-semantics';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type {
  CanonicalOperationalEvent,
  OnboardingMilestoneProjection,
  OperationalConfidenceScore,
  OperationalTimelineProjection,
} from '@/lib/operations/timeline/types';
import type { RawObligationInput } from '@/lib/operations/derivations/derive-obligation-state';

/** Canonical release coordination phases — single state machine for all surfaces. */
export const CANONICAL_RELEASE_PHASES = [
  'INITIALIZING',
  'CONVERGING',
  'READY',
  'RELEASABLE',
  'RELEASED',
] as const;

export type CanonicalReleasePhase = (typeof CANONICAL_RELEASE_PHASES)[number];

export type CanonicalParticipantRecord = {
  participantId: string;
  entity: DemoParticipant;
  payoutReadiness: ParticipantPayoutReadiness;
  releaseReadiness: PayoutReleaseReadiness;
  compensationConfigured: boolean;
  agreementApproved: boolean;
  payoutConfirmed: boolean;
  attributionActive: boolean;
};

export type CanonicalAgreementRecord = {
  participantId: string;
  approved: boolean;
  shared: boolean;
  approvedAt: string | null;
};

export type CanonicalAttributionRecord = {
  participantId: string;
  scopeDefined: boolean;
  activated: boolean;
  eligibleServiceIds: string[];
  eligibleServices: CatalogItemRef[];
};

export type CanonicalObligationRecord = {
  obligation: HydratedObligation;
  participantId: string;
  /** True when obligation was materialized by reducer (not yet persisted). */
  materialized: boolean;
  persisted: boolean;
};

export type CanonicalFundingRecord = {
  allocated: boolean;
  reconciled: boolean;
  stageLabel: string | null;
  blockerLabel: string | null;
};

export type OperationalKPIs = {
  participantCount: number;
  earningsConfiguredCount: number;
  payoutReadyCount: number;
  approvedAgreementCount: number;
  fundedObligationCount: number;
  releaseEligibleCount: number;
  attributionActiveCount: number;
  obligationCount: number;
  participantsConfigured: boolean;
};

export type CanonicalOperationalBlocker = OperationalReleaseBlockerDetail & {
  fingerprint: string;
  phase: CanonicalReleasePhase;
  source: 'reducer';
};

export type CanonicalReadinessRecord = {
  releasePhase: CanonicalReleasePhase;
  graphReady: boolean;
  graphConverged: boolean;
  settlementReady: boolean;
  coordinationBlocked: boolean;
};

export type CanonicalOperationalState = {
  participants: CanonicalParticipantRecord[];
  agreements: CanonicalAgreementRecord[];
  attribution: CanonicalAttributionRecord[];
  funding: CanonicalFundingRecord;
  obligations: CanonicalObligationRecord[];
  release: {
    phase: CanonicalReleasePhase;
    releaseEligibleCount: number;
    releaseBatchCount: number;
  };
  readiness: CanonicalReadinessRecord;
  blockers: CanonicalOperationalBlocker[];
  kpis: OperationalKPIs;
  timeline: TimelineEvent[];
  milestones: OnboardingMilestoneProjection[];
  coordination: {
    graphReady: boolean;
    graphSnapshotConverged: boolean;
    workspace: WorkspaceOperationalContext | null;
  };
  confidence: OperationalConfidenceScore;
  /** Replay-derived event stream (deterministic). */
  events: CanonicalOperationalEvent[];
  replayFingerprint: string;
};

export type OperationalReducerSeed = {
  participants: DemoParticipant[];
  obligations?: RawObligationInput[];
  funding?: FundingCoordinationInput;
  fundingAllocated?: boolean;
  projectId?: string;
  catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
  projectCurrency?: string;
  serviceCurrencies?: string[];
  graphReady?: boolean;
  graphSnapshotConverged?: boolean;
  workspace?: WorkspaceOperationalContext | null;
  releaseBatchCount?: number;
  catalogItems?: CatalogItemRef[];
};

export type ReduceOperationalStateInput = {
  events?: OperationalEvent[];
  seed: OperationalReducerSeed;
};

/** Alias event types normalized to canonical operational vocabulary during replay. */
export const CANONICAL_EVENT_ALIASES: Record<string, OperationalEventType> = {
  participant_compensation_configured: 'PARTICIPANT_COMPENSATION_UPDATED',
  participant_compensation_updated: 'PARTICIPANT_COMPENSATION_UPDATED',
  participant_agreement_generated: 'AGREEMENT_SHARED',
  participant_agreement_approved: 'AGREEMENT_APPROVED',
  participant_payout_confirmed: 'PAYOUT_STATE_UPDATED',
  funding_source_added: 'FUNDING_SOURCE_UPDATED',
  funding_reconciled: 'FUNDING_ALLOCATION_RESERVED',
  obligation_materialized: 'OBLIGATION_STATE_UPDATED',
  release_eligibility_unlocked: 'OPERATIONAL_GRAPH_INITIALIZED',
  attribution_scope_defined: 'ATTRIBUTION_CONFIGURATION_UPDATED',
  attribution_activated: 'ATTRIBUTION_CONFIGURATION_UPDATED',
};

export type LegacyBlockerBridge = OperationalBlockerDetail | CanonicalOperationalBlocker;
