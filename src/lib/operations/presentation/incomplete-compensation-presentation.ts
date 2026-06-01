import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  hasPersistedCompensationTerms,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';

/** Participant row has a participation model but no persisted earnings terms. */
export function hasIncompleteCompensationStructure(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  if (isParticipantCompensationExempt(participant)) return false;
  if (hasPersistedCompensationTerms(participant)) return false;
  return participant.participationModel != null;
}

export function hasNoCompensationStructure(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return true;
  if (isParticipantCompensationExempt(participant)) return false;
  if (hasPersistedCompensationTerms(participant)) return false;
  if (participant.participationModel != null) return false;
  const profile = participant.compensationProfile;
  if (profile?.compensationType) return false;
  return !Number.isFinite(participant.commissionValue) || participant.commissionValue <= 0;
}

export type IncompleteCompensationPresentation = {
  earningsPrimaryCompact: string;
  earningsSecondary: string;
  earningsTitle: string;
};

export function deriveIncompleteCompensationPresentation(
  participant: DemoParticipant
): IncompleteCompensationPresentation | null {
  if (!hasIncompleteCompensationStructure(participant)) return null;
  return {
    earningsPrimaryCompact: 'Needs review',
    earningsSecondary: 'Compensation amount missing',
    earningsTitle: 'Needs review — compensation amount missing',
  };
}
