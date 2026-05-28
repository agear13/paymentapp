import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveObligationState, type RawObligationInput } from '@/lib/operations/derivations/derive-obligation-state';
import { classifyParticipantCompensation, compensationGeneratesObligations } from '@/lib/operations/contracts/compensation-classification';
import { deriveAgreementApprovalState } from '@/lib/operations/derivations/derive-approval-state';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';
import type {
  CanonicalObligationRecord,
  CanonicalParticipantRecord,
  CanonicalFundingRecord,
} from '@/lib/operations/reducer/types';

function agreementBlocksObligation(participant: DemoParticipant): boolean {
  const state = deriveAgreementApprovalState(participant);
  return state !== 'participant_approved' && state !== 'fully_approved';
}

function canMaterializeObligation(
  row: CanonicalParticipantRecord,
  funding: CanonicalFundingRecord
): boolean {
  if (!row.compensationConfigured) return false;
  if (row.entity.compensationProfile?.exemptFromPayout) return false;
  if (!row.payoutConfirmed) return false;
  if (agreementBlocksObligation(row.entity)) return false;
  if (!funding.allocated && !funding.reconciled) return false;
  const classification = classifyParticipantCompensation(row.entity);
  return compensationGeneratesObligations(classification);
}

function syntheticObligationInput(
  row: CanonicalParticipantRecord,
  projectId?: string
): RawObligationInput {
  const profile = row.entity.compensationProfile;
  const amount =
    profile?.fixedAmount ??
    profile?.percentage ??
    row.entity.commissionValue ??
    0;

  return {
    id: `materialized-${row.participantId}`,
    participantId: row.participantId,
    amount: Number.isFinite(amount) ? Number(amount) : 0,
    amountFunded: 0,
    allocationStatus: 'APPROVED',
    readiness: 'awaiting_funding',
  };
}

export type DeriveObligationsInput = {
  participants: CanonicalParticipantRecord[];
  persistedObligations: RawObligationInput[];
  funding: CanonicalFundingRecord;
  projectId?: string;
};

/**
 * Deterministic obligation materialization — obligations MUST appear in reducer state
 * when compensation, agreement, payout confirmation, and funding converge.
 */
export function deriveOperationalObligationsFromState(
  input: DeriveObligationsInput
): CanonicalObligationRecord[] {
  const persistedByParticipant = new Map<string, CanonicalObligationRecord>();

  for (const raw of input.persistedObligations) {
    const participantId = raw.participantId ?? undefined;
    if (!participantId) continue;
    const obligation = deriveObligationState(raw);
    persistedByParticipant.set(participantId, {
      obligation,
      participantId,
      materialized: false,
      persisted: true,
    });
  }

  const records: CanonicalObligationRecord[] = [...persistedByParticipant.values()];

  for (const row of input.participants) {
    if (persistedByParticipant.has(row.participantId)) continue;
    if (!canMaterializeObligation(row, input.funding)) continue;

    const hydrated = hydrateOperationalParticipant(row.entity);
    const obligation = deriveObligationState(
      syntheticObligationInput({ ...row, entity: hydrated }, input.projectId)
    );
    records.push({
      obligation,
      participantId: row.participantId,
      materialized: true,
      persisted: false,
    });
  }

  return records;
}
