import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

const DEV = process.env.NODE_ENV === 'development';
const PREFIX = '[OperationalDiagnostics]';

function devWarn(prefix: string, message: string, detail?: unknown): void {
  if (!DEV) return;
  if (detail !== undefined) {
    console.warn(prefix, message, detail);
  } else {
    console.warn(prefix, message);
  }
}

export function warnMissingParticipantFields(
  participant: DemoParticipant | null | undefined,
  fields: string[]
): void {
  if (!DEV || !fields.length) return;
  devWarn(
    PREFIX,
    `Missing participant fields (${participant?.id ?? 'unknown'}):`,
    fields.join(', ')
  );
}

export function warnLegacyParticipantShape(participant: DemoParticipant | null | undefined): void {
  if (!DEV || !participant) return;
  const legacySignals: string[] = [];
  if (participant.participantLifecycle === undefined) legacySignals.push('participantLifecycle');
  if (participant.agreementLifecycle === undefined) legacySignals.push('agreementLifecycle');
  if (participant.compensationProfile === undefined) legacySignals.push('compensationProfile');
  if (participant.payoutVerificationConfirmed === undefined) {
    legacySignals.push('payoutVerificationConfirmed');
  }
  if (legacySignals.length > 0) {
    devWarn(
      PREFIX,
      `Legacy participant shape detected (${participant.id ?? 'unknown'})`,
      legacySignals
    );
  }
}

export function warnInvalidLifecycleCombination(
  participantId: string | undefined,
  lifecycle: {
    participant?: string;
    agreement?: string;
    attribution?: string;
  }
): void {
  if (!DEV) return;
  if (lifecycle.participant === 'PAYOUT_READY' && lifecycle.agreement === 'NOT_CREATED') {
    devWarn(
      PREFIX,
      `Unusual lifecycle: payout ready without agreement (${participantId ?? 'unknown'})`,
      lifecycle
    );
  }
}

export function warnHydrationFailure(
  entityType: string,
  entityId: string | undefined,
  error: unknown
): void {
  if (!DEV) return;
  devWarn(PREFIX, `Hydration failure for ${entityType} (${entityId ?? 'unknown'})`, error);
}

export function detectParticipantEntitySource(
  participant: DemoParticipant,
  fromRaw = false
): 'draft' | 'hydrated' | 'legacy' {
  if (
    participant.participantLifecycle === undefined ||
    participant.compensationProfile === undefined ||
    participant.payoutVerificationConfirmed === undefined
  ) {
    return 'legacy';
  }
  if (!fromRaw && participant.participantLifecycle === 'DRAFT' && !participant.compensationProfile?.configured) {
    return 'draft';
  }
  if (fromRaw) {
    return participant.participantLifecycle === 'DRAFT' ? 'draft' : 'hydrated';
  }
  return participant.compensationProfile?.configured ? 'hydrated' : 'draft';
}
