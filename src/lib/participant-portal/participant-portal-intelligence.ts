/**
 * Participant Commercial Workspace — commercial intelligence copy.
 *
 * Generates explanations from configured commercial data and live settlement state.
 * Never invents information.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { deriveParticipantCommercialLifecycle } from '@/lib/commercial/participant-commercial-lifecycle';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';
import type {
  ParticipantCommercialPerformance,
  SettlementExplanation,
} from '@/lib/participant-portal/participant-portal-types';

export function deriveParticipantPortalIntelligence(
  participant: DemoParticipant,
  deal: RecentDeal,
  settlement: SettlementExplanation,
  performance: ParticipantCommercialPerformance
): string | null {
  const parts: string[] = [];
  const profile = participant.compensationProfile;
  const code = participant.referralCode?.trim();
  const pct =
    profile?.percentage ??
    participant.referralCommerce?.commerceCommissionPct ??
    (participant.commissionKind === 'pct_deal_value' ? participant.commissionValue : null);

  if (profile?.compensationType === 'COMMISSION' || participant.participationModel === 'customer_attribution') {
    if (pct != null && code) {
      parts.push(
        `You earn ${pct}% commission on purchases attributed to promo code ${code}.`
      );
    } else if (pct != null && participant.customerCommerceUrl?.trim()) {
      parts.push(`You earn ${pct}% commission on purchases via your referral link.`);
    } else if (pct != null) {
      parts.push(`You earn ${pct}% commission on attributed sales.`);
    }
  } else if (profile?.compensationType === 'REVENUE_SHARE' || participant.commissionKind === 'pct_deal_value') {
    if (pct != null) {
      parts.push(`You receive ${pct}% revenue share on agreed revenue sources.`);
    }
  } else if (profile?.compensationType === 'FIXED_FEE' || participant.commissionKind === 'fixed_amount') {
    const amount = profile?.fixedAmount ?? participant.commissionValue;
    if (amount > 0) {
      parts.push('You receive a fixed payment per your commercial agreement.');
    }
  } else if (profile?.compensationType === 'HYBRID') {
    parts.push('Your arrangement combines fixed and variable commercial components.');
  }

  if (settlement.blockingReason) {
    parts.push(settlement.blockingReason);
  } else if (settlement.nextStep && !parts.includes(settlement.nextStep)) {
    parts.push(settlement.nextStep);
  }

  const stage = deriveParticipantCommercialLifecycle(participant);
  if (stage === 'SETTLEMENT_READY' && !settlement.blockingReason) {
    parts.push('Settlement is ready — payment will be released by the organiser.');
  } else if (stage === 'AGREEMENT_SENT' && !hasApprovedAgreement(participant)) {
    parts.push('Agreement acceptance is required before settlement can proceed.');
  } else if (
    !performance.hasRecordedActivity &&
    (profile?.compensationType === 'COMMISSION' || profile?.customerAttributionEnabled)
  ) {
    parts.push('No attributed commercial activity has been recorded yet.');
  }

  if (participant.payoutCondition?.trim() && parts.length === 0) {
    parts.push(participant.payoutCondition.trim());
  }

  if (participant.extractedObligations?.settlementEvents?.length && parts.length <= 1) {
    const trigger = participant.extractedObligations.settlementEvents[0]?.trigger;
    if (trigger?.trim()) {
      parts.push(`Settlement timing: ${trigger.trim()}.`);
    }
  }

  if (parts.length === 0) {
    return deal.dealName
      ? `Your commercial workspace for ${deal.dealName}. Details appear as the organiser finalises terms.`
      : null;
  }

  return parts.join(' ');
}
