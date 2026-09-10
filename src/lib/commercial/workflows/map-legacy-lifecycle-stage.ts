/**
 * Maps independent workflow states → legacy participant lifecycle stage.
 *
 * Preserves existing organiser UI and API behaviour while commercial,
 * settlement, and accounting remain decoupled at the source.
 *
 * Xero export is an accounting projection. Settlement readiness follows
 * the commercial/settlement engines, not xeroExportedAt / xeroSyncStatus.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ParticipantCommercialLifecycleStage } from '@/lib/commercial/participant-commercial-lifecycle';
import {
  hasParticipantIdentityReady,
  isPaymentRequestSent,
} from '@/lib/commercial/participant-lifecycle-primitives';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import {
  hasApprovedAgreement,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';
import {
  supplierLifecycleForParticipant,
} from '@/lib/commercial/workflows/build-participant-workflow-inputs';
import type { ParticipantWorkflowBundle } from '@/lib/commercial/workflows/types';

function deriveSetupLifecycleFromCommercial(
  participant: DemoParticipant,
  commercialState: ParticipantWorkflowBundle['commercial']['state']
): ParticipantCommercialLifecycleStage {
  const identityReady = hasParticipantIdentityReady(participant);
  const earningsReady =
    isParticipantCompensationExempt(participant) || isParticipantEarningsConfigured(participant);

  if (!identityReady || !earningsReady) {
    return 'DRAFT';
  }

  if (commercialState === 'AGREEMENT_PENDING') {
    return 'AGREEMENT_SENT';
  }

  return 'EARNINGS_CONFIGURED';
}

function mapSupplierToLegacyStage(
  supplier: ReturnType<typeof supplierLifecycleForParticipant>
): ParticipantCommercialLifecycleStage {
  if (supplier === 'APPROVED') return 'SETTLEMENT_READY';
  if (supplier === 'UNDER_REVIEW') return 'OPERATOR_REVIEW';
  if (supplier === 'SUBMITTED') return 'PAYMENT_INFO_SUBMITTED';
  if (
    supplier === 'REJECTED' ||
    supplier === 'IN_PROGRESS' ||
    supplier === 'INVITED'
  ) {
    return 'PAYMENT_INFO_PENDING';
  }
  return 'AGREEMENT_ACCEPTED';
}

function isCommerciallyReadyForSettlement(
  workflows: ParticipantWorkflowBundle,
  supplier: ReturnType<typeof supplierLifecycleForParticipant>
): boolean {
  return (
    workflows.settlement.state === 'READY' ||
    workflows.commercial.state === 'COMMERCIAL_SETTLEMENT_READY' ||
    workflows.commercial.state === 'COMMERCIALLY_COMPLETE' ||
    supplier === 'APPROVED'
  );
}

/**
 * Compose the legacy lifecycle stage from three independent workflow states.
 */
export function mapLegacyParticipantLifecycleStage(
  participant: DemoParticipant,
  workflows: ParticipantWorkflowBundle
): ParticipantCommercialLifecycleStage {
  if (
    workflows.settlement.state === 'COMPLETE' ||
    participant.payoutSettlementStatus === 'Paid' ||
    participant.payoutPaidAt
  ) {
    return 'PAID';
  }

  if (!hasApprovedAgreement(participant)) {
    return deriveSetupLifecycleFromCommercial(participant, workflows.commercial.state);
  }

  const supplier = supplierLifecycleForParticipant(participant);

  if (isCommerciallyReadyForSettlement(workflows, supplier)) {
    return 'SETTLEMENT_READY';
  }

  if (isParticipantCompensationExempt(participant)) {
    return 'AGREEMENT_ACCEPTED';
  }

  if (!isPaymentRequestSent(participant)) {
    return 'AGREEMENT_ACCEPTED';
  }

  return mapSupplierToLegacyStage(supplier);
}
