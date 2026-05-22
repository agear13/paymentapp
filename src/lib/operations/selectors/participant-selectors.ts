import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantCapabilityFlags,
  deriveParticipantState,
  normalizeParticipantEntity,
} from '@/lib/operations/guards/hydration-guards';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';

export const selectParticipantEntity = normalizeParticipantEntity;
export const selectParticipantState = deriveParticipantState;
export const selectParticipantFlags = deriveParticipantCapabilityFlags;
export const selectParticipantPayoutReadiness = deriveParticipantPayoutReadiness;
