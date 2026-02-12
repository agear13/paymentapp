/**
 * 2-Tier Referral Allocation Engine
 * Computes allocations for payment_completed conversions:
 * - UPSTREAM: BD Partner (if consultant was referred)
 * - DOWNSTREAM: Client Advocate (if conversion via advocate link)
 * - CONSULTANT: Remainder (gross - sum(others))
 */

export type AllocationRole = 'BD_PARTNER' | 'CONSULTANT' | 'CLIENT_ADVOCATE';

export interface Allocation {
  role: AllocationRole;
  participantId: string;
  amount: number;
  currency: string;
  ruleScope?: 'UPSTREAM' | 'DOWNSTREAM';
  description: string;
}

export interface PaymentRule {
  scope: 'UPSTREAM' | 'DOWNSTREAM';
  payout_type: 'percent' | 'fixed';
  value: number;
  currency: string;
}

export interface ComputeAllocationsInput {
  programId: string;
  consultantParticipantId: string;
  advocateParticipantId?: string | null;
  bdPartnerParticipantId?: string | null; // From referral_referrals.parent_participant_id
  grossAmount: number;
  currency: string;
  upstreamRule?: PaymentRule | null;
  downstreamRule?: PaymentRule | null;
  hasUpstreamReferral: boolean;
  hasDownstreamAgreement: boolean;
}

export interface ComputeAllocationsResult {
  allocations: Allocation[];
  totalAllocated: number;
  consultantRemainder: number;
}

/**
 * Compute allocations for a payment_completed conversion.
 * Missing rules for a scope = 0 allocation for that beneficiary.
 * Consultant always gets remainder; throws if remainder would be negative.
 */
export function computeReferralAllocations(input: ComputeAllocationsInput): ComputeAllocationsResult {
  const {
    consultantParticipantId,
    advocateParticipantId,
    bdPartnerParticipantId,
    grossAmount,
    currency,
    upstreamRule,
    downstreamRule,
    hasUpstreamReferral,
    hasDownstreamAgreement,
  } = input;

  const allocations: Allocation[] = [];
  let totalAllocated = 0;

  // UPSTREAM: BD Partner (if consultant was referred by BD and rule exists)
  if (hasUpstreamReferral && upstreamRule && bdPartnerParticipantId) {
    const amount = computeAmount(upstreamRule, grossAmount);
    if (amount > 0) {
      allocations.push({
        role: 'BD_PARTNER',
        participantId: bdPartnerParticipantId,
        amount,
        currency: upstreamRule.currency || currency,
        ruleScope: 'UPSTREAM',
        description: `BD Partner upstream share (${upstreamRule.payout_type})`,
      });
      totalAllocated += amount;
    }
  }

  // DOWNSTREAM: Client Advocate (if agreement exists and rule exists)
  if (hasDownstreamAgreement && advocateParticipantId && downstreamRule) {
    const amount = computeAmount(downstreamRule, grossAmount);
    if (amount > 0) {
      allocations.push({
        role: 'CLIENT_ADVOCATE',
        participantId: advocateParticipantId,
        amount,
        currency: downstreamRule.currency || currency,
        ruleScope: 'DOWNSTREAM',
        description: `Advocate downstream share (${downstreamRule.payout_type})`,
      });
      totalAllocated += amount;
    }
  }

  // CONSULTANT: Remainder
  const consultantRemainder = Math.max(0, grossAmount - totalAllocated);
  if (consultantRemainder < 0) {
    throw new Error(
      `[ALLOCATION_FAIL] Consultant remainder would be negative: gross=${grossAmount}, allocated=${totalAllocated}`
    );
  }

  allocations.push({
    role: 'CONSULTANT',
    participantId: consultantParticipantId,
    amount: consultantRemainder,
    currency,
    description: `Consultant remainder (gross - upstream - downstream)`,
  });
  totalAllocated += consultantRemainder;

  return {
    allocations,
    totalAllocated,
    consultantRemainder,
  };
}

function computeAmount(rule: PaymentRule, grossAmount: number): number {
  if (rule.payout_type === 'fixed') {
    return rule.value;
  }
  if (rule.payout_type === 'percent') {
    return (grossAmount * rule.value) / 100;
  }
  return 0;
}
