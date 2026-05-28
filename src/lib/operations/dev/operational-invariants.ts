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

export type ReleaseInteractionInvariantInput = {
  releaseInteractionEnabled?: boolean;
  graphReady?: boolean;
  graphSnapshotConverged?: boolean;
  canCreateReleaseBatch?: boolean;
  betaSettlementAllowed?: boolean;
  mutationAttempted?: boolean;
  releaseActionEnabled?: boolean;
  forbiddenResponseObserved?: boolean;
  expectedInitializationWindow?: boolean;
};

export function assertReleaseInteractionInvariants(
  input: ReleaseInteractionInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (
    input.releaseInteractionEnabled === true &&
    input.graphSnapshotConverged === false
  ) {
    throw new OperationalInvariantViolation(
      'RELEASE_INTERACTION_ENABLED_BEFORE_GRAPH_CONVERGENCE',
      'Release interaction enabled before coordination snapshot converged'
    );
  }

  if (
    input.releaseInteractionEnabled === true &&
    input.graphReady === false
  ) {
    throw new OperationalInvariantViolation(
      'RELEASE_INTERACTION_ENABLED_BEFORE_GRAPH_CONVERGENCE',
      'Release interaction enabled before operational graph ready'
    );
  }

  if (
    input.expectedInitializationWindow &&
    input.mutationAttempted
  ) {
    throw new OperationalInvariantViolation(
      'FORBIDDEN_RELEASE_MUTATION_DURING_EXPECTED_INITIALIZATION',
      'Release mutation attempted during expected initialization window'
    );
  }

  if (
    !input.releaseInteractionEnabled &&
    input.releaseActionEnabled
  ) {
    throw new OperationalInvariantViolation(
      'RELEASE_ACTION_RENDERED_WHILE_CAPABILITY_DISABLED',
      'Interactive release action rendered while release interaction is disabled'
    );
  }

  if (
    !input.releaseInteractionEnabled &&
    input.mutationAttempted
  ) {
    throw new OperationalInvariantViolation(
      'BETA_DISABLED_RELEASE_TRIGGERED_MUTATION',
      'Release mutation attempted while release interaction is disabled'
    );
  }

  if (
    input.forbiddenResponseObserved &&
    input.expectedInitializationWindow
  ) {
    throw new OperationalInvariantViolation(
      'FORBIDDEN_RELEASE_MUTATION_DURING_EXPECTED_INITIALIZATION',
      'Forbidden release response observed during expected initialization window'
    );
  }

  if (
    input.releaseActionEnabled &&
    input.canCreateReleaseBatch === false &&
    input.betaSettlementAllowed === false
  ) {
    throw new OperationalInvariantViolation(
      'CAPABILITY_STATE_CONTRADICTS_RENDERED_ACTIONS',
      'Release action enabled while beta settlement capability is disabled'
    );
  }
}

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
  catalogSurfaceCurrencyContradictsWorkspace?: boolean;
};

export type AttributionConvergenceInvariantInput = {
  hybridAttributionNotRenderedInAgreement?: boolean;
  attributionEnabledWithoutReferralInfrastructure?: boolean;
  percentageRenderedAsCurrency?: boolean;
  attributionServiceScopeMissing?: boolean;
  catalogSurfaceCurrencyContradictsWorkspace?: boolean;
};

export function assertAttributionConvergenceInvariants(
  input: AttributionConvergenceInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.hybridAttributionNotRenderedInAgreement) {
    throw new OperationalInvariantViolation(
      'HYBRID_ATTRIBUTION_NOT_RENDERED_IN_AGREEMENT',
      'Hybrid attribution enabled but agreement copy does not reflect catalog earnings'
    );
  }

  if (input.attributionEnabledWithoutReferralInfrastructure) {
    throw new OperationalInvariantViolation(
      'ATTRIBUTION_ENABLED_WITHOUT_REFERRAL_INFRASTRUCTURE',
      'Attribution enabled and approved but referral infrastructure is missing'
    );
  }

  if (input.percentageRenderedAsCurrency) {
    throw new OperationalInvariantViolation(
      'PERCENTAGE_RENDERED_AS_CURRENCY',
      'Compensation percentage rendered as currency amount'
    );
  }

  if (input.attributionServiceScopeMissing) {
    throw new OperationalInvariantViolation(
      'ATTRIBUTION_SERVICE_SCOPE_MISSING',
      'Attribution enabled without resolved eligible service scope'
    );
  }

  if (input.catalogSurfaceCurrencyContradictsWorkspace) {
    throw new OperationalInvariantViolation(
      'CATALOG_SURFACE_CURRENCY_CONTRADICTS_WORKSPACE',
      'Service catalog surface currency does not match canonical workspace currency'
    );
  }
}

export type FoundationalSemanticsInvariantInput = {
  foundationalSemanticsLayerImportViolation?: boolean;
};

export type OperationalPresentationInvariantInput = {
  compensationSummaryOverflowingOperationalTable?: boolean;
  attributionScopeMissingFromDraftAgreement?: boolean;
};

export function assertOperationalPresentationInvariants(
  input: OperationalPresentationInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.compensationSummaryOverflowingOperationalTable) {
    throw new OperationalInvariantViolation(
      'COMPENSATION_SUMMARY_OVERFLOWING_OPERATIONAL_TABLE',
      'Operational table earnings summary is too verbose for dense table surfaces'
    );
  }

  if (input.attributionScopeMissingFromDraftAgreement) {
    throw new OperationalInvariantViolation(
      'ATTRIBUTION_SCOPE_MISSING_FROM_DRAFT_AGREEMENT',
      'Draft agreement missing attribution catalog scope while attribution is enabled'
    );
  }
}

export function assertFoundationalSemanticsLayerInvariants(
  input: FoundationalSemanticsInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.foundationalSemanticsLayerImportViolation) {
    throw new OperationalInvariantViolation(
      'FOUNDATIONAL_SEMANTICS_LAYER_IMPORT_VIOLATION',
      'Foundational semantics module imports truth, derivation, orchestration, or selector layers'
    );
  }
}

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

  if (input.catalogSurfaceCurrencyContradictsWorkspace) {
    throw new OperationalInvariantViolation(
      'CATALOG_SURFACE_CURRENCY_CONTRADICTS_WORKSPACE',
      'Service catalog surface currency does not match canonical workspace currency'
    );
  }
}

export type CompensationCurrencyInvariantInput = {
  workspaceCurrency?: string;
  renderedCurrency?: string;
  compensationConfigured?: boolean;
};

export function assertCompensationCurrencyInvariants(
  input: CompensationCurrencyInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (!input.compensationConfigured) return;
  if (!input.workspaceCurrency || !input.renderedCurrency) return;
  if (input.workspaceCurrency === input.renderedCurrency) return;
  throw new OperationalInvariantViolation(
    'COMPENSATION_CURRENCY_CONTRADICTS_WORKSPACE_CURRENCY',
    `Compensation rendered as ${input.renderedCurrency} while workspace currency is ${input.workspaceCurrency}`
  );
}

export type BetaReleaseErrorInvariantInput = {
  expectedBetaLockdown?: boolean;
  fatalReleaseErrorObserved?: boolean;
  releaseInteractionEnabled?: boolean;
};

export function assertBetaReleaseErrorInvariants(input: BetaReleaseErrorInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (
    input.expectedBetaLockdown &&
    input.fatalReleaseErrorObserved &&
    !input.releaseInteractionEnabled
  ) {
    throw new OperationalInvariantViolation(
      'EXPECTED_BETA_LOCKDOWN_TRIGGERED_FATAL_RELEASE_ERROR',
      'Fatal release error surfaced during expected beta lockdown window'
    );
  }
}

export type OperationalProjectionInvariantInput = {
  projectionThrew?: boolean;
  expectedInitializationWindow?: boolean;
};

export function assertOperationalProjectionInvariants(
  input: OperationalProjectionInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (input.projectionThrew && input.expectedInitializationWindow) {
    throw new OperationalInvariantViolation(
      'OPERATIONAL_PROJECTION_THROW_DURING_EXPECTED_INITIALIZATION',
      'Operational projection threw during expected initialization window'
    );
  }
}

export type OnboardingGuidanceInvariantInput = {
  graphReady?: boolean;
  graphSnapshotConverged?: boolean;
  nextActionCount?: number;
  hasStripeConnected?: boolean;
  participantCount?: number;
  guidanceHeadline?: string;
};

export function assertOnboardingGuidanceInvariants(
  input: OnboardingGuidanceInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (input.graphSnapshotConverged === false) return;

  if (
    input.hasStripeConnected &&
    input.graphReady &&
    input.graphSnapshotConverged &&
    (input.participantCount ?? 0) > 0 &&
    (input.nextActionCount ?? 0) === 0
  ) {
    throw new OperationalInvariantViolation(
      'ONBOARDING_GUIDANCE_MISSING_NEXT_ACTION',
      'Stripe-connected workspace has participants but no actionable next step'
    );
  }

  if (
    input.graphReady &&
    input.graphSnapshotConverged &&
    input.guidanceHeadline?.toLowerCase().includes('initializing')
  ) {
    throw new OperationalInvariantViolation(
      'ONBOARDING_GUIDANCE_CONTRADICTS_OPERATIONAL_GRAPH',
      'Guidance reports initializing while operational graph is ready and converged'
    );
  }
}

export type OperationalReadinessInvariantInput = {
  phase?: string;
  graphReadyForProjection?: boolean;
  graphSnapshotConverged?: boolean;
  releaseInteractionEnabled?: boolean;
  uiDerivesReadinessDirectly?: boolean;
  duplicatedReadinessDerivation?: boolean;
};

export function assertOperationalReadinessInvariants(
  input: OperationalReadinessInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (
    input.releaseInteractionEnabled === true &&
    input.graphSnapshotConverged === false
  ) {
    throw new OperationalInvariantViolation(
      'READINESS_STATE_BYPASSES_CANONICAL_SELECTOR',
      'Release interaction enabled before graph snapshot converged'
    );
  }

  if (input.uiDerivesReadinessDirectly) {
    throw new OperationalInvariantViolation(
      'UI_DERIVING_OPERATIONAL_STATE_DIRECTLY',
      'UI component derives operational readiness outside canonical selectors'
    );
  }

  if (input.duplicatedReadinessDerivation) {
    throw new OperationalInvariantViolation(
      'DUPLICATED_OPERATIONAL_READINESS_DERIVATION',
      'Operational readiness derived outside canonical selector chain'
    );
  }
}

export type ProjectableSnapshotInvariantInput = {
  summaryPresent?: boolean;
  fundingPresent?: boolean;
  projectionThrewDuringConvergence?: boolean;
  partialHydrationFatalRender?: boolean;
  unguardedGraphConsumption?: boolean;
};

export function assertProjectableSnapshotInvariants(
  input: ProjectableSnapshotInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (!input.summaryPresent || !input.fundingPresent) {
    throw new OperationalInvariantViolation(
      'UNGUARDED_OPERATIONAL_GRAPH_CONSUMPTION',
      'Operational graph consumed without projectable summary and funding'
    );
  }

  if (input.projectionThrewDuringConvergence) {
    throw new OperationalInvariantViolation(
      'OPERATIONAL_PROJECTION_THROW_DURING_CONVERGENCE',
      'Operational projection threw during convergence window'
    );
  }

  if (input.partialHydrationFatalRender) {
    throw new OperationalInvariantViolation(
      'PARTIAL_HYDRATION_FATAL_RENDER',
      'Partial hydration caused fatal operational render'
    );
  }
}

export type ReleaseCapabilityInvariantInput = {
  releaseFetchOutsideGate?: boolean;
  forbiddenDuringExpectedLockdown?: boolean;
  releaseMutationBeforeConvergence?: boolean;
  releaseInteractionEnabled?: boolean;
  mutationAttempted?: boolean;
};

export function assertReleaseCapabilityInvariants(
  input: ReleaseCapabilityInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.releaseFetchOutsideGate) {
    throw new OperationalInvariantViolation(
      'RELEASE_FETCH_OUTSIDE_CAPABILITY_GATE',
      'Release data fetched outside releaseInteractionEnabled gate'
    );
  }

  if (input.forbiddenDuringExpectedLockdown) {
    throw new OperationalInvariantViolation(
      'FORBIDDEN_RESPONSE_DURING_EXPECTED_LOCKDOWN',
      'Forbidden response surfaced during expected beta lockdown'
    );
  }

  if (input.releaseMutationBeforeConvergence && !input.releaseInteractionEnabled) {
    throw new OperationalInvariantViolation(
      'RELEASE_MUTATION_BEFORE_CONVERGENCE',
      'Release mutation attempted before operational convergence'
    );
  }

  if (!input.releaseInteractionEnabled && input.mutationAttempted) {
    throw new OperationalInvariantViolation(
      'RELEASE_MUTATION_BEFORE_CONVERGENCE',
      'Release mutation attempted while release interaction disabled'
    );
  }
}

export type OperationalCurrencyInvariantInput = {
  workspaceCurrency?: string;
  renderedCurrency?: string;
  usedFallbackCurrency?: boolean;
  bypassedResolutionChain?: boolean;
  workspaceCurrencyNotPropagated?: boolean;
};

export function assertOperationalCurrencyInvariants(
  input: OperationalCurrencyInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.usedFallbackCurrency && input.workspaceCurrency && input.renderedCurrency) {
    if (input.workspaceCurrency !== input.renderedCurrency) {
      throw new OperationalInvariantViolation(
        'OPERATIONAL_AMOUNT_RENDERED_WITH_FALLBACK_CURRENCY',
        `Amount rendered as ${input.renderedCurrency} while workspace currency is ${input.workspaceCurrency}`
      );
    }
  }

  if (input.bypassedResolutionChain) {
    throw new OperationalInvariantViolation(
      'CURRENCY_RESOLUTION_CHAIN_BYPASSED',
      'Operational amount bypassed resolveOperationalWorkspaceCurrency chain'
    );
  }

  if (input.workspaceCurrencyNotPropagated) {
    throw new OperationalInvariantViolation(
      'WORKSPACE_CURRENCY_NOT_PROPAGATED',
      'Workspace currency not propagated to operational rendering surface'
    );
  }

  if (
    input.workspaceCurrency &&
    input.renderedCurrency &&
    input.workspaceCurrency !== input.renderedCurrency
  ) {
    throw new OperationalInvariantViolation(
      'COMPENSATION_CURRENCY_CONTRADICTS_WORKSPACE_CURRENCY',
      `Rendered currency ${input.renderedCurrency} contradicts workspace ${input.workspaceCurrency}`
    );
  }
}

export type FoundationalOperationalLayerInvariantInput = {
  coordinationImportsUi?: boolean;
  truthImportsImproperDerivation?: boolean;
  orchestrationDependsOnPresentation?: boolean;
  capabilityHookPerformsMutation?: boolean;
  initializationWithoutNextAction?: boolean;
  guidanceWithoutResolutionPath?: boolean;
  onboardingStageContradictsGraph?: boolean;
};

export function assertFoundationalOperationalLayerInvariants(
  input: FoundationalOperationalLayerInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.coordinationImportsUi) {
    throw new OperationalInvariantViolation(
      'FOUNDATIONAL_OPERATIONAL_LAYER_VIOLATION',
      'Foundational coordination layer imports UI modules'
    );
  }

  if (input.initializationWithoutNextAction) {
    throw new OperationalInvariantViolation(
      'INITIALIZATION_STATE_WITHOUT_NEXT_ACTION',
      'Initialization state rendered without actionable next step'
    );
  }

  if (input.guidanceWithoutResolutionPath) {
    throw new OperationalInvariantViolation(
      'OPERATIONAL_GUIDANCE_WITHOUT_RESOLUTION_PATH',
      'Operational guidance rendered without resolution path'
    );
  }

  if (input.onboardingStageContradictsGraph) {
    throw new OperationalInvariantViolation(
      'ONBOARDING_STAGE_CONTRADICTS_GRAPH_STATE',
      'Onboarding stage contradicts operational graph state'
    );
  }
}

export type EventReplayInvariantInput = {
  inputCount?: number;
  outputCount?: number;
  sequencesMonotonic?: boolean;
  duplicateSequenceDetected?: boolean;
};

export function assertEventReplayInvariants(input: EventReplayInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.sequencesMonotonic === false) {
    throw new OperationalInvariantViolation(
      'EVENT_REPLAY_NON_MONOTONIC_SEQUENCE',
      'Operational event replay produced non-monotonic sequence numbers'
    );
  }

  if (input.duplicateSequenceDetected) {
    throw new OperationalInvariantViolation(
      'EVENT_REPLAY_DUPLICATE_SEQUENCE',
      'Operational event replay assigned duplicate sequence numbers'
    );
  }
}

export type EventProjectionInvariantInput = {
  timelineDerivedOutsideEventLayer?: boolean;
  replayFingerprintEmpty?: boolean;
  nonDeterministicReplay?: boolean;
  projectionThrewDuringConvergence?: boolean;
};

export function assertEventProjectionInvariants(input: EventProjectionInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.timelineDerivedOutsideEventLayer) {
    throw new OperationalInvariantViolation(
      'TIMELINE_DERIVED_OUTSIDE_EVENT_LAYER',
      'Operational timeline derived outside canonical event projection layer'
    );
  }

  if (input.replayFingerprintEmpty) {
    throw new OperationalInvariantViolation(
      'EVENT_PROJECTION_EMPTY_FINGERPRINT',
      'Event projection produced events but empty replay fingerprint'
    );
  }

  if (input.nonDeterministicReplay) {
    throw new OperationalInvariantViolation(
      'EVENT_PROJECTION_NON_DETERMINISTIC',
      'Operational event replay is non-deterministic for identical input streams'
    );
  }

  if (input.projectionThrewDuringConvergence) {
    throw new OperationalInvariantViolation(
      'EVENT_PROJECTION_THROW_DURING_CONVERGENCE',
      'Event projection threw during expected convergence window'
    );
  }
}

export type EventLayerInvariantInput = {
  eventLayerImportsUi?: boolean;
  uiDerivesTimelineDirectly?: boolean;
  blockerExplainabilityBypassesEvents?: boolean;
  confidenceScoredOutsideEventLayer?: boolean;
};

export function assertEventLayerInvariants(input: EventLayerInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.eventLayerImportsUi) {
    throw new OperationalInvariantViolation(
      'EVENT_LAYER_ARCHITECTURE_VIOLATION',
      'Event timeline layer imports UI modules'
    );
  }

  if (input.uiDerivesTimelineDirectly) {
    throw new OperationalInvariantViolation(
      'UI_DERIVING_TIMELINE_OUTSIDE_EVENT_PROJECTION',
      'UI derives operational timeline outside event projection layer'
    );
  }

  if (input.blockerExplainabilityBypassesEvents) {
    throw new OperationalInvariantViolation(
      'BLOCKER_EXPLAINABILITY_BYPASSES_EVENTS',
      'Blocker explainability bypassed canonical event derivation'
    );
  }

  if (input.confidenceScoredOutsideEventLayer) {
    throw new OperationalInvariantViolation(
      'CONFIDENCE_SCORED_OUTSIDE_EVENT_LAYER',
      'Operational confidence scored outside event projection layer'
    );
  }
}

export type ObligationProjectionInvariantInput = {
  projectionThrewDuringConvergence?: boolean;
  fatalDuringExpectedDegradedState?: boolean;
};

export function assertObligationProjectionInvariants(
  input: ObligationProjectionInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.projectionThrewDuringConvergence) {
    throw new OperationalInvariantViolation(
      'OBLIGATION_PROJECTION_THROW_DURING_CONVERGENCE',
      'Obligation projection threw during convergence window'
    );
  }

  if (input.fatalDuringExpectedDegradedState) {
    throw new OperationalInvariantViolation(
      'OPERATIONAL_PAGE_FATAL_DURING_EXPECTED_DEGRADED_STATE',
      'Operational page fatally failed during expected degraded state'
    );
  }
}

export type PayoutSurfaceInvariantInput = {
  releaseQueryDuringBetaLockdown?: boolean;
  forbiddenToastDuringExpectedDisabled?: boolean;
  releaseEffectBeforeConvergence?: boolean;
  participantEarningsBypassedReleaseGate?: boolean;
  eventProjectionFatalOnPage?: boolean;
  capabilityProjectionThrewDuringInit?: boolean;
};

export function assertPayoutSurfaceInvariants(input: PayoutSurfaceInvariantInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.releaseQueryDuringBetaLockdown) {
    throw new OperationalInvariantViolation(
      'RELEASE_QUERY_EXECUTED_DURING_BETA_LOCKDOWN',
      'Release-scoped query executed during beta lockdown'
    );
  }

  if (input.forbiddenToastDuringExpectedDisabled) {
    throw new OperationalInvariantViolation(
      'FORBIDDEN_TOAST_TRIGGERED_DURING_EXPECTED_DISABLED_STATE',
      'Forbidden toast surfaced during expected disabled capability state'
    );
  }

  if (input.releaseEffectBeforeConvergence) {
    throw new OperationalInvariantViolation(
      'RELEASE_EFFECT_EXECUTED_BEFORE_CAPABILITY_CONVERGENCE',
      'Release effect executed before capability convergence'
    );
  }

  if (input.participantEarningsBypassedReleaseGate) {
    throw new OperationalInvariantViolation(
      'PARTICIPANT_EARNINGS_BYPASSED_RELEASE_GATE',
      'Participant earnings page bypassed release capability gate'
    );
  }

  if (input.eventProjectionFatalOnPage) {
    throw new OperationalInvariantViolation(
      'EVENT_PROJECTION_FATAL_ON_OPERATIONAL_PAGE',
      'Event projection caused fatal operational page failure'
    );
  }

  if (input.capabilityProjectionThrewDuringInit) {
    throw new OperationalInvariantViolation(
      'CAPABILITY_PROJECTION_THROW_DURING_INITIALIZATION',
      'Capability projection threw during initialization'
    );
  }
}

export type ParticipantKpiConvergenceInvariantInput = {
  participantRowsWithCompensation?: number;
  workspaceEarningsConfiguredCount?: number;
  graphEarningsConfiguredCount?: number;
  payoutReadyCount?: number;
  graphPayoutReadyCount?: number;
};

export function assertParticipantKpiConvergenceInvariants(
  input: ParticipantKpiConvergenceInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  const rows = input.participantRowsWithCompensation ?? 0;
  const workspaceCount = input.workspaceEarningsConfiguredCount ?? 0;
  const graphCount = input.graphEarningsConfiguredCount ?? workspaceCount;

  if (rows > 0 && workspaceCount === 0) {
    throw new OperationalInvariantViolation(
      'KPI_COUNTS_CONTRADICT_PARTICIPANT_ROWS',
      `${rows} participant row(s) show configured compensation but workspace KPI reports 0 earnings configured`
    );
  }

  if (graphCount > 0 && workspaceCount !== graphCount) {
    throw new OperationalInvariantViolation(
      'PARTICIPANT_COMPENSATION_PERSISTED_BUT_NOT_READY',
      `Graph reports ${graphCount} earnings configured but workspace context reports ${workspaceCount}`
    );
  }

  const payoutReady = input.payoutReadyCount ?? 0;
  const graphPayoutReady = input.graphPayoutReadyCount ?? payoutReady;
  if (graphPayoutReady > 0 && payoutReady !== graphPayoutReady) {
    throw new OperationalInvariantViolation(
      'PAYOUT_READY_COUNT_CONTRADICTS_GRAPH',
      `Graph reports ${graphPayoutReady} payout-ready participants but workspace context reports ${payoutReady}`
    );
  }
}

export type CanonicalConvergenceInvariantInput = {
  state: import('@/lib/operations/reducer/types').CanonicalOperationalState;
  pageDerivedKpisIndependently?: boolean;
  pageDerivedBlockersIndependently?: boolean;
  pageDerivedReadinessOutsideCanonical?: boolean;
  staleActivationDataRendered?: boolean;
};

export function assertCanonicalConvergenceInvariants(
  input: CanonicalConvergenceInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  const { state } = input;
  const kpis = state.kpis;

  if (input.pageDerivedKpisIndependently) {
    throw new OperationalInvariantViolation(
      'KPI_COUNTS_DERIVED_OUTSIDE_CANONICAL_STATE',
      'A page derived KPI counts outside deriveOperationalKPIs()'
    );
  }

  if (input.pageDerivedBlockersIndependently) {
    throw new OperationalInvariantViolation(
      'RELEASE_BLOCKER_DERIVED_OUTSIDE_BLOCKER_ENGINE',
      'A page derived release blockers outside deriveCanonicalOperationalBlockers()'
    );
  }

  if (input.pageDerivedReadinessOutsideCanonical) {
    throw new OperationalInvariantViolation(
      'PAGE_DERIVING_READINESS_OUTSIDE_CANONICAL_STATE',
      'A page derived readiness outside reduceOperationalState()'
    );
  }

  if (input.staleActivationDataRendered) {
    throw new OperationalInvariantViolation(
      'PAGE_RENDERING_STALE_ACTIVATION_DATA',
      'UI rendered stale activation counters instead of canonical reducer KPIs'
    );
  }

  const payoutReadyIds = new Set(
    state.participants.filter((p) => p.payoutReadiness.payoutReady).map((p) => p.participantId)
  );
  for (const id of payoutReadyIds) {
    if (!state.obligations.some((o) => o.participantId === id) && state.funding.allocated) {
      throw new OperationalInvariantViolation(
        'OBLIGATIONS_NOT_MATERIALIZED_AFTER_APPROVAL',
        `Participant ${id} is payout-ready with funding but no obligation materialized in canonical state`
      );
    }
  }

  if (
    kpis.payoutReadyCount > 0 &&
    kpis.obligationCount === 0 &&
    state.funding.allocated
  ) {
    throw new OperationalInvariantViolation(
      'OBLIGATIONS_NOT_MATERIALIZED_AFTER_APPROVAL',
      'Payout-ready participants exist with funding but canonical obligations are empty'
    );
  }

  if (state.participants.some((p) => p.attributionActive) && state.attribution.length === 0) {
    throw new OperationalInvariantViolation(
      'ATTRIBUTION_SCOPE_NOT_REPLAY_DERIVED',
      'Attribution active on participants but attribution scope missing from canonical state'
    );
  }

  const phases = ['INITIALIZING', 'CONVERGING', 'READY', 'RELEASABLE', 'RELEASED'];
  if (!phases.includes(state.release.phase)) {
    throw new OperationalInvariantViolation(
      'RELEASE_STATE_MACHINE_SKIPPED_PHASE',
      `Invalid release phase ${state.release.phase}`
    );
  }
}

export type MultipleTruthSourcesInvariantInput = {
  canonicalKpis?: number;
  parallelKpiDerivation?: number;
};

export function assertMultipleOperationalTruthSources(
  input: MultipleTruthSourcesInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (
    input.canonicalKpis != null &&
    input.parallelKpiDerivation != null &&
    input.canonicalKpis !== input.parallelKpiDerivation
  ) {
    throw new OperationalInvariantViolation(
      'MULTIPLE_OPERATIONAL_TRUTH_SOURCES_DETECTED',
      `Canonical KPIs (${input.canonicalKpis}) contradict parallel derivation (${input.parallelKpiDerivation})`
    );
  }
}

export type SurfaceConvergenceInvariantInput = {
  surface?: string;
  usesNonCanonicalSelector?: boolean;
  replayEventType?: string;
  replayEventPresent?: boolean;
  compensationPersistedCount?: number;
  earningsConfiguredCount?: number;
  approvedWithoutObligation?: boolean;
  obligationsExist?: boolean;
  pageRenderBlocked?: boolean;
  duplicateBlockerCount?: number;
  fundingPresent?: boolean;
  releasePhaseInitializing?: boolean;
};

/** Dev-only convergence guards for mixed truth sources and incomplete replay. */
export function assertSurfaceConvergenceInvariants(
  input: SurfaceConvergenceInvariantInput
): void {
  if (process.env.NODE_ENV !== 'development') return;

  if (input.usesNonCanonicalSelector) {
    throw new OperationalInvariantViolation(
      'UI_SURFACE_USING_NONCANONICAL_OPERATIONAL_SELECTOR',
      `Surface ${input.surface ?? 'unknown'} derived operational truth outside useCanonicalOperationalState()`
    );
  }

  if (input.replayEventType && input.replayEventPresent === false) {
    throw new OperationalInvariantViolation(
      'REPLAY_EVENT_MISSING_FROM_CANONICAL_STATE',
      `Persisted event ${input.replayEventType} did not replay into canonical operational state`
    );
  }

  if (
    (input.compensationPersistedCount ?? 0) > (input.earningsConfiguredCount ?? 0)
  ) {
    throw new OperationalInvariantViolation(
      'PARTICIPANT_COMPENSATION_PRESENT_BUT_NOT_COUNTED',
      `${input.compensationPersistedCount} participant row(s) show compensation but canonical KPI reports ${input.earningsConfiguredCount ?? 0} configured`
    );
  }

  if (input.approvedWithoutObligation) {
    throw new OperationalInvariantViolation(
      'APPROVED_AGREEMENT_WITHOUT_OBLIGATION',
      'Approved agreement exists in persistence but no obligation materialized in canonical state'
    );
  }

  if (input.obligationsExist && input.pageRenderBlocked) {
    throw new OperationalInvariantViolation(
      'OBLIGATIONS_EXIST_BUT_PAGE_RENDER_BLOCKED',
      'Operational obligations exist but page rendered initialization shell instead of data'
    );
  }

  if ((input.duplicateBlockerCount ?? 0) > 1) {
    throw new OperationalInvariantViolation(
      'DUPLICATE_OPERATIONAL_BLOCKERS_RENDERED',
      `${input.duplicateBlockerCount} duplicate operational blockers rendered from parallel derivation paths`
    );
  }

  if (input.fundingPresent && input.releasePhaseInitializing) {
    throw new OperationalInvariantViolation(
      'FUNDING_PRESENT_BUT_RELEASE_STATE_INITIALIZING',
      'Funding is allocated but canonical release phase remains INITIALIZING'
    );
  }
}
