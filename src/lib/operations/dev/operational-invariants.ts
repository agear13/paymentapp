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
