import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { AgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import type { AttributionLifecycleState } from '@/lib/operations/lifecycle/attribution-lifecycle';
import type { ParticipantLifecycleState } from '@/lib/operations/lifecycle/participant-lifecycle';

const DEV = process.env.NODE_ENV === 'development';

function devWarn(prefix: string, message: string, detail?: unknown): void {
  if (!DEV) return;
  if (detail !== undefined) {
    console.warn(prefix, message, detail);
  } else {
    console.warn(prefix, message);
  }
}

const PREFIX = '[OperationalDiagnostics]';

export {
  warnMissingParticipantFields,
  warnLegacyParticipantShape,
  warnHydrationFailure,
  detectParticipantEntitySource,
} from '@/lib/operations/hydration/hydration-dev-warnings';

export function warnInvalidLifecycleCombination(
  participantId: string | undefined,
  lifecycle: {
    participant?: ParticipantLifecycleState;
    agreement?: AgreementLifecycleState;
    attribution?: AttributionLifecycleState;
  }
): void {
  if (!DEV) return;
  if (
    lifecycle.participant === 'PAYOUT_READY' &&
    lifecycle.agreement === 'NOT_CREATED'
  ) {
    devWarn(
      PREFIX,
      `Unusual lifecycle: payout ready without agreement (${participantId ?? 'unknown'})`,
      lifecycle
    );
  }
}

export function warnOperationalInconsistency(input: {
  participant: DemoParticipant;
  agreementApproval: string;
  payoutReadiness: { payoutReady: boolean; issues: string[] };
  releaseReadiness: { releaseReady: boolean; blockers: string[]; attributionEligible: boolean };
  catalogItems?: Array<{ id: string; name: string }>;
}): void {
  if (!DEV) return;
  const { participant, agreementApproval, payoutReadiness, releaseReadiness, catalogItems } =
    input;

  if (
    releaseReadiness.attributionEligible &&
    participant.customerCommerceUrl?.trim() &&
    participant.compensationProfile?.customerAttributionEnabled !== true &&
    participant.participationModel !== 'customer_attribution'
  ) {
    devWarn(
      PREFIX,
      `Attribution link present while attribution disabled (${participant.id})`,
      { url: participant.customerCommerceUrl }
    );
  }

  if (payoutReadiness.payoutReady && agreementApproval === 'draft') {
    devWarn(
      PREFIX,
      `Payout ready while agreement unapproved (${participant.id})`,
      { agreementApproval }
    );
  }

  if (
    (agreementApproval === 'participant_approved' || agreementApproval === 'fully_approved') &&
    payoutReadiness.issues.some((i) => i.includes('agreement'))
  ) {
    devWarn(
      PREFIX,
      `Approved agreement but stale agreement blocker (${participant.id})`,
      { issues: payoutReadiness.issues }
    );
  }

  if (releaseReadiness.releaseReady && releaseReadiness.blockers.length > 0) {
    devWarn(
      PREFIX,
      `Release ready with active blockers (${participant.id})`,
      { blockers: releaseReadiness.blockers }
    );
  }

  if (
    participant.compensationProfile?.customerAttributionEnabled &&
    (catalogItems?.length ?? 0) === 0 &&
    Boolean(participant.customerCommerceUrl?.trim())
  ) {
    devWarn(
      PREFIX,
      `Attribution link without eligible catalog items (${participant.id})`,
      null
    );
  }

  const hasCatalogSelection =
    (participant.compensationProfile?.commissionServiceIds?.length ?? 0) > 0;
  if (hasCatalogSelection && participant.compensationProfile?.customerAttributionEnabled !== true) {
    devWarn(
      PREFIX,
      `Eligible services selected without attribution enabled (${participant.id})`,
      { serviceIds: participant.compensationProfile?.commissionServiceIds }
    );
  }

  if (
    participant.compensationProfile?.customerAttributionEnabled &&
    participant.participationModel === 'revenue_share'
  ) {
    devWarn(
      PREFIX,
      `Attribution enabled on revenue share participant (${participant.id})`,
      null
    );
  }
}

