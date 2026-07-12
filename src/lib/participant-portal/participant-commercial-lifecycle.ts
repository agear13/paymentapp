/**
 * Participant-facing commercial lifecycle display.
 *
 * Reuses canonical lifecycle derivation — no duplicate stage logic.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantCommercialLifecycle,
  isLifecycleStageAtOrPast,
  type ParticipantCommercialLifecycleStage,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import type { CommercialLifecycleStep, CommercialStepStatus } from '@/lib/participant-portal/participant-portal-types';
import type { PortalAgreementSection } from '@/lib/participant-portal/participant-portal-types';

type LifecycleStepDef = {
  id: string;
  label: string;
  completeAt: ParticipantCommercialLifecycleStage;
  activeWhen?: (stage: ParticipantCommercialLifecycleStage, participant: DemoParticipant) => boolean;
};

const PARTICIPANT_LIFECYCLE_STEPS: LifecycleStepDef[] = [
  { id: 'agreement_sent', label: 'Agreement Sent', completeAt: 'AGREEMENT_SENT' },
  { id: 'agreement_accepted', label: 'Agreement Accepted', completeAt: 'AGREEMENT_ACCEPTED' },
  { id: 'terms_confirmed', label: 'Commercial Terms Confirmed', completeAt: 'AGREEMENT_ACCEPTED' },
  { id: 'deliverables', label: 'Deliverables Complete', completeAt: 'SETTLEMENT_READY' },
  { id: 'settlement_ready', label: 'Settlement Ready', completeAt: 'SETTLEMENT_READY' },
  { id: 'payment_released', label: 'Payment Released', completeAt: 'PAID' },
];

export function deriveParticipantCommercialLifecycleSteps(
  participant: DemoParticipant,
  agreement: PortalAgreementSection
): CommercialLifecycleStep[] {
  const stage = deriveParticipantCommercialLifecycle(participant);
  const termsConfigured =
    isParticipantEarningsConfigured(participant) || agreement.commercialObligations.length > 0;
  const hasDeliverables = agreement.deliverables.length > 0;

  return PARTICIPANT_LIFECYCLE_STEPS.map((def) => {
    let status: CommercialStepStatus;

    if (def.id === 'terms_confirmed') {
      status =
        hasApprovedAgreement(participant) && termsConfigured
          ? 'complete'
          : hasApprovedAgreement(participant)
            ? 'active'
            : isLifecycleStageAtOrPast(stage, 'AGREEMENT_SENT')
              ? 'waiting'
              : 'pending';
    } else if (def.id === 'deliverables') {
      if (stage === 'PAID' || isLifecycleStageAtOrPast(stage, 'SETTLEMENT_READY')) {
        status = 'complete';
      } else if (!hasDeliverables) {
        status = hasApprovedAgreement(participant) ? 'waiting' : 'pending';
      } else if (hasApprovedAgreement(participant)) {
        status = 'waiting';
      } else {
        status = 'pending';
      }
    } else if (def.id === 'payment_released') {
      status = stage === 'PAID' ? 'complete' : isLifecycleStageAtOrPast(stage, 'SETTLEMENT_READY') ? 'active' : 'pending';
    } else if (def.id === 'settlement_ready') {
      status = isLifecycleStageAtOrPast(stage, 'SETTLEMENT_READY')
        ? 'complete'
        : hasApprovedAgreement(participant) && stage !== 'PAID'
          ? 'waiting'
          : 'pending';
    } else {
      status = isLifecycleStageAtOrPast(stage, def.completeAt)
        ? 'complete'
        : def.completeAt === 'AGREEMENT_SENT' && termsConfigured && stage === 'EARNINGS_CONFIGURED'
          ? 'active'
          : isLifecycleStageAtOrPast(stage, 'DRAFT') && def.completeAt === 'AGREEMENT_SENT'
            ? 'pending'
            : isLifecycleStageAtOrPast(stage, 'EARNINGS_CONFIGURED') && def.completeAt === 'AGREEMENT_SENT'
              ? 'active'
              : 'pending';
    }

    return { id: def.id, label: def.label, status };
  });
}
