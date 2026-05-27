export class OperationalInvariantViolation extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'OperationalInvariantViolation';
    this.code = code;
  }
}

export type OperationalInvariantInput = {
  participantId?: string;
  payoutReady?: boolean;
  releaseReady?: boolean;
  obligationCount?: number;
  obligationsFunded?: boolean;
  compensationConfigured?: boolean;
  agreementApproved?: boolean;
  syncCompleted?: boolean;
  releaseEligibleInBatch?: boolean;
  releaseEligibleInSnapshot?: boolean;
  currencyConsistent?: boolean;
};

export type OperationalInvariantInputWithAttribution = OperationalInvariantInput & {
  attributionEnabled?: boolean;
  referralLinkPresent?: boolean;
  attributionEnabledWithoutActiveServices?: boolean;
};

/** Hard assertions for impossible operational states — throws in development. */
export function assertOperationalInvariants(input: OperationalInvariantInputWithAttribution): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (
    input.agreementApproved &&
    input.compensationConfigured &&
    (input.obligationCount ?? 0) === 0
  ) {
    throw new OperationalInvariantViolation(
      'APPROVED_CONFIGURED_WITHOUT_OBLIGATIONS',
      `Participant ${input.participantId ?? 'unknown'} is approved with compensation configured but no operational obligations exist`
    );
  }

  if (input.payoutReady && (input.obligationCount ?? 0) === 0) {
    throw new OperationalInvariantViolation(
      'PAYOUT_READY_WITHOUT_OBLIGATIONS',
      `Participant ${input.participantId ?? 'unknown'} is payout-ready but no obligations exist`
    );
  }

  if (input.obligationsFunded && (input.obligationCount ?? 0) === 0) {
    throw new OperationalInvariantViolation(
      'OBLIGATIONS_FUNDED_WITHOUT_LINES',
      'Obligations marked funded but no obligation lines exist'
    );
  }

  if (input.attributionEnabled && !input.referralLinkPresent && input.agreementApproved) {
    throw new OperationalInvariantViolation(
      'ATTRIBUTION_WITHOUT_LINK',
      `Attribution enabled without referral link (${input.participantId ?? 'unknown'})`
    );
  }

  if (input.referralLinkPresent && !input.attributionEnabled) {
    throw new OperationalInvariantViolation(
      'REFERRAL_LINK_WITHOUT_ATTRIBUTION',
      `Referral link exists while attribution disabled (${input.participantId ?? 'unknown'})`
    );
  }

  if (input.attributionEnabledWithoutActiveServices) {
    throw new OperationalInvariantViolation(
      'ATTRIBUTION_ENABLED_WITHOUT_ACTIVE_SERVICES',
      `Customer attribution with all-active catalog scope enabled without active catalog services (${input.participantId ?? 'unknown'})`
    );
  }

  if (input.agreementApproved && input.syncCompleted === false) {
    throw new OperationalInvariantViolation(
      'APPROVED_WITHOUT_SYNC',
      `Agreement approved but operational synchronization did not complete (${input.participantId ?? 'unknown'})`
    );
  }

  if (
    input.releaseReady &&
    input.releaseEligibleInBatch === false &&
    input.releaseEligibleInSnapshot === true
  ) {
    throw new OperationalInvariantViolation(
      'RELEASE_READY_EXCLUDED_FROM_BATCH',
      `Release-ready participant excluded from release batch (${input.participantId ?? 'unknown'})`
    );
  }

  if (input.releaseReady && input.currencyConsistent === false) {
    throw new OperationalInvariantViolation(
      'CURRENCY_INCONSISTENCY',
      `Release ready despite currency inconsistency (${input.participantId ?? 'unknown'})`
    );
  }

  if (input.releaseReady && input.agreementApproved === false) {
    throw new OperationalInvariantViolation(
      'RELEASE_READY_WITHOUT_AGREEMENT',
      `Participant ${input.participantId ?? 'unknown'} is release-ready without approved agreement`
    );
  }
}

export type BatchInvariantInput = {
  batchCreated?: boolean;
  eligibleParticipantCount?: number;
  includedParticipantCount?: number;
};

export function assertBatchInvariants(input: BatchInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (
    input.batchCreated &&
    (input.eligibleParticipantCount ?? 0) > 0 &&
    (input.includedParticipantCount ?? 0) === 0
  ) {
    throw new OperationalInvariantViolation(
      'RELEASE_BATCH_WITHOUT_ELIGIBLE',
      'Release batch created without eligible participants'
    );
  }
}

export type SyncInvariantInput = {
  syncCompletedAt?: string;
  lastSyncCompletedAt?: string;
};

export function assertSyncFreshness(input: SyncInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (!input.syncCompletedAt || !input.lastSyncCompletedAt) return;
  const staleMs =
    new Date(input.syncCompletedAt).getTime() - new Date(input.lastSyncCompletedAt).getTime();
  if (staleMs > 60_000) {
    throw new OperationalInvariantViolation(
      'STALE_SYNC_COMPLETION',
      'Operational synchronization completion timestamp is stale'
    );
  }
}

export type GraphGuidanceInvariantInput = {
  releaseReadyCount?: number;
  blockerCount?: number;
  fundingBlocker?: string | null;
  fundingReserved?: boolean;
  confirmedFunding?: number;
  guidanceHeadline?: string;
};

export type FundingGraphInvariantInput = {
  confirmedFunding?: number;
  obligationsFunded?: number;
  fundingReserved?: boolean;
  invoicePaid?: boolean;
};

export type AgreementHydrationInvariantInput = {
  renderedServiceLabels?: string[];
};

export type CapabilityInvariantInput = {
  releaseActionVisible?: boolean;
  canCreateReleaseBatch?: boolean;
};

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParticipantSetupGuidanceInvariantInput = {
  showCompensationSetupGuidance?: boolean;
  needsEarningsConfiguration?: boolean;
  payoutReadyCount?: number;
  total?: number;
};

export function assertParticipantSetupGuidanceInvariants(
  input: ParticipantSetupGuidanceInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  const total = input.total ?? 0;
  const payoutReady = input.payoutReadyCount ?? 0;

  if (
    input.showCompensationSetupGuidance &&
    total > 0 &&
    payoutReady === total &&
    input.needsEarningsConfiguration === false
  ) {
    throw new OperationalInvariantViolation(
      'GUIDANCE_SHOWS_CONFIGURATION_BLOCKER_FOR_PAYOUT_READY_PARTICIPANT',
      'Compensation setup guidance is shown while all participants are payout-ready'
    );
  }
}

export type SettlementReleaseInvariantInput = {
  settlementReady?: boolean;
  releaseBlocked?: boolean;
  releaseReadyCount?: number;
  guidanceHeadline?: string;
  fundingBlocker?: string | null;
  approvedParticipantPendingApproval?: boolean;
};

export function assertSettlementReleaseInvariants(input: SettlementReleaseInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (
    input.settlementReady &&
    input.releaseBlocked &&
    !input.fundingBlocker
  ) {
    throw new OperationalInvariantViolation(
      'RELEASE_BLOCKED_WHEN_SETTLEMENT_READY',
      'Settlement is release-ready but top-level guidance still reports release blocked'
    );
  }

  if (
    input.settlementReady &&
    input.guidanceHeadline?.toLowerCase().includes('release blocked')
  ) {
    throw new OperationalInvariantViolation(
      'RELEASE_STATE_CONTRADICTS_CANONICAL_GRAPH',
      'Guidance headline contradicts canonical settlement release readiness'
    );
  }

  if (
    !input.fundingBlocker &&
    (input.releaseReadyCount ?? 0) > 0 &&
    input.releaseBlocked &&
    input.guidanceHeadline?.toLowerCase().includes('release blocked')
  ) {
    throw new OperationalInvariantViolation(
      'FUNDING_READY_BUT_RELEASE_BLOCKED_WITHOUT_REASON',
      'Funding is ready and participants are release-eligible but release remains blocked without reason'
    );
  }

  if (input.approvedParticipantPendingApproval) {
    throw new OperationalInvariantViolation(
      'APPROVED_PARTICIPANT_SHOWING_PENDING_APPROVAL',
      'Approved payout-ready participant still shows pending approval allocation status'
    );
  }
}

export type PayoutExplainabilityInvariantInput = {
  detailedBlockers?: Array<{ reason?: string; remediation?: string; category?: string }>;
  graphReady?: boolean;
  settlementReady?: boolean;
  staleObligationCount?: number;
  payoutReadyCount?: number;
  earningsMarkedNeedsFundingWhenFunded?: boolean;
  genericBlockerWithoutExplanation?: boolean;
  operatorActionRequiredWhenOnlyRefreshNeeded?: boolean;
};

export function assertPayoutExplainabilityInvariants(
  input: PayoutExplainabilityInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  for (const blocker of input.detailedBlockers ?? []) {
    if (!blocker.reason?.trim() || !blocker.remediation?.trim()) {
      throw new OperationalInvariantViolation(
        'GENERIC_RELEASE_BLOCKER_WITHOUT_EXPLANATION',
        'Release blocker is missing canonical reason or remediation'
      );
    }
  }

  if (input.earningsMarkedNeedsFundingWhenFunded) {
    throw new OperationalInvariantViolation(
      'EARNINGS_MARKED_NEEDS_FUNDING_WHEN_FUNDED',
      'Participant earnings marked needs funding while payout-ready and approved'
    );
  }

  if (
    input.settlementReady &&
    (input.staleObligationCount ?? 0) > 0 &&
    input.detailedBlockers?.some((b) => b.category === 'participant_approval_missing')
  ) {
    throw new OperationalInvariantViolation(
      'RELEASE_BLOCKER_REASON_CONTRADICTS_GRAPH',
      'Settlement-ready graph reports participant approval blockers while obligations are stale'
    );
  }

  if (input.operatorActionRequiredWhenOnlyRefreshNeeded) {
    throw new OperationalInvariantViolation(
      'OPERATOR_ACTION_REQUIRED_WHEN_ONLY_REFRESH_NEEDED',
      'Guidance implies operator action while only orchestration refresh is required'
    );
  }
}

/** Development-only graph consistency checks for guidance, funding, hydration, and capabilities. */
export function assertGraphGuidanceInvariants(input: GraphGuidanceInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  if ((input.releaseReadyCount ?? 0) > 0 && (input.blockerCount ?? 0) > 0) {
    throw new OperationalInvariantViolation(
      'GUIDANCE_CONTRADICTS_BLOCKERS',
      'Release-ready count is positive while operational blockers remain'
    );
  }

  if (
    input.guidanceHeadline?.toLowerCase().includes('ready for payout release') &&
    (input.blockerCount ?? 0) > 0
  ) {
    throw new OperationalInvariantViolation(
      'GUIDANCE_CONTRADICTS_BLOCKERS',
      'Guidance headline claims release readiness while blockers exist'
    );
  }
}

export function assertFundingGraphInvariants(input: FundingGraphInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  if ((input.confirmedFunding ?? 0) > 0 && input.fundingReserved === false) {
    throw new OperationalInvariantViolation(
      'FUNDING_EXISTS_WITHOUT_RESERVATION',
      'Confirmed funding exists but reservation state is false'
    );
  }

  if (input.invoicePaid && (input.confirmedFunding ?? 0) > 0 && (input.obligationsFunded ?? 0) === 0) {
    throw new OperationalInvariantViolation(
      'PAID_INVOICE_NOT_ALLOCATED_TO_FUNDING',
      'Paid invoice funding was not allocated to obligations'
    );
  }
}

export function assertAgreementHydrationInvariants(input: AgreementHydrationInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;
  for (const label of input.renderedServiceLabels ?? []) {
    if (UUID_LIKE.test(label.trim())) {
      throw new OperationalInvariantViolation(
        'RAW_SERVICE_IDS_RENDERED',
        `Raw service UUID reached agreement render layer: ${label}`
      );
    }
  }
}

export function assertCapabilityInvariants(input: CapabilityInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (input.releaseActionVisible && input.canCreateReleaseBatch === false) {
    throw new OperationalInvariantViolation(
      'RELEASE_ACTION_VISIBLE_WITHOUT_CAPABILITY',
      'Release action is visible without operational capability'
    );
  }
}

export function assertReleaseReadyWithBlockers(input: {
  releaseReady?: boolean;
  blockingObligationCount?: number;
}): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (input.releaseReady && (input.blockingObligationCount ?? 0) > 0) {
    throw new OperationalInvariantViolation(
      'RELEASE_READY_WITH_BLOCKING_OBLIGATIONS',
      'Release marked ready while blocking obligations remain'
    );
  }
}

export type OnboardingGraphInvariantInput = {
  graphResolutionAttempted?: boolean;
  graphProjectionBeforeBootstrap?: boolean;
  settlementRailRenderedBeforeReady?: boolean;
  stripeConnectedWithoutPaymentRail?: boolean;
  projectId?: string | null;
  organizationId?: string | null;
  graphReady?: boolean;
  graphSummaryConsumedBeforeReady?: boolean;
};

export function assertOnboardingGraphInvariants(input: OnboardingGraphInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.graphProjectionBeforeBootstrap) {
    throw new OperationalInvariantViolation(
      'GRAPH_PROJECTION_BEFORE_BOOTSTRAP',
      'Operational graph projection attempted before bootstrap completion'
    );
  }

  if (input.settlementRailRenderedBeforeReady) {
    throw new OperationalInvariantViolation(
      'SETTLEMENT_RAIL_RENDERED_BEFORE_READY',
      'Settlement rail UI rendered before OPERATIONAL_GRAPH_READY'
    );
  }

  if (input.stripeConnectedWithoutPaymentRail) {
    throw new OperationalInvariantViolation(
      'STRIPE_CONNECTED_WITHOUT_PAYMENT_RAIL',
      'Stripe connected while payment rail initialization incomplete'
    );
  }

  if (input.graphResolutionAttempted && !input.projectId) {
    throw new OperationalInvariantViolation(
      'MISSING_PROJECT_DURING_SETTLEMENT_BOOTSTRAP',
      'Operational graph resolution attempted without bootstrapped project'
    );
  }

  if (input.graphResolutionAttempted && input.graphReady === false) {
    throw new OperationalInvariantViolation(
      'OPERATIONAL_GRAPH_RESOLUTION_BEFORE_INITIALIZATION',
      'Graph resolution attempted before initialization barriers passed'
    );
  }

  if (input.graphSummaryConsumedBeforeReady) {
    throw new OperationalInvariantViolation(
      'GRAPH_SUMMARY_CONSUMED_BEFORE_READY',
      'Graph summary projection consumed before OPERATIONAL_GRAPH_READY'
    );
  }
}

export type ConvergenceInvariantInput = {
  initializationCompletedWithoutGraph?: boolean;
  graphReadyWithoutSettlementRails?: boolean;
  settlementReadyWithoutProject?: boolean;
  partialBootstrapWithReadyPhase?: boolean;
  multipleActiveInitializationChains?: boolean;
  graphProjectionBeforeConvergenceValidation?: boolean;
  catalogDefaultCurrencyMismatch?: boolean;
};

export function assertConvergenceInvariants(input: ConvergenceInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.initializationCompletedWithoutGraph) {
    throw new OperationalInvariantViolation(
      'INITIALIZATION_COMPLETED_WITHOUT_GRAPH',
      'Initialization marked complete without operational graph ready'
    );
  }

  if (input.graphReadyWithoutSettlementRails) {
    throw new OperationalInvariantViolation(
      'GRAPH_READY_WITHOUT_SETTLEMENT_RAILS',
      'Graph ready while settlement rails uninitialized'
    );
  }

  if (input.settlementReadyWithoutProject) {
    throw new OperationalInvariantViolation(
      'SETTLEMENT_READY_WITHOUT_PROJECT',
      'Settlement ready without bootstrapped project'
    );
  }

  if (input.partialBootstrapWithReadyPhase) {
    throw new OperationalInvariantViolation(
      'PARTIAL_BOOTSTRAP_WITH_READY_PHASE',
      'Ready phase recorded with incomplete bootstrap prerequisites'
    );
  }

  if (input.multipleActiveInitializationChains) {
    throw new OperationalInvariantViolation(
      'MULTIPLE_ACTIVE_INITIALIZATION_CHAINS',
      'Multiple active operational initialization chains detected'
    );
  }

  if (input.graphProjectionBeforeConvergenceValidation) {
    throw new OperationalInvariantViolation(
      'GRAPH_PROJECTION_BEFORE_CONVERGENCE_VALIDATION',
      'Graph projection attempted before convergence validation'
    );
  }

  if (input.catalogDefaultCurrencyMismatch) {
    throw new OperationalInvariantViolation(
      'CATALOG_DEFAULT_CURRENCY_MISMATCH',
      'Service catalog default currency does not match workspace/org default currency'
    );
  }
}
