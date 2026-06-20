/**
 * buildSupplierOnboardingInput
 *
 * Canonical adapter: DemoParticipant + deal → SupplierOnboardingInput.
 *
 * This is the single bridge between the deal-network-pilot participant schema
 * and the Commercial OS supplier onboarding engine. All onboarding pages and
 * API routes must call this function rather than constructing the input manually.
 *
 * Also exports lifecycle selectors that derive state from either the new
 * event-sourced domain model or legacy phase fields (backwards compatible).
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { SupplierOnboardingInput } from '@/lib/commercial/supplier-onboarding';
import {
  deriveLifecycle,
  isSupplierApproved,
  buildSupplierVerification,
  buildSupplierProfile,
  generateCommercialReviewSummary,
} from '@/lib/commercial/supplier-onboarding-domain';
import type {
  SupplierOnboardingLifecycle,
  SupplierProfile,
  SupplierVerification,
  CommercialReviewSummary,
  StoredOnboardingState,
} from '@/lib/commercial/supplier-onboarding-domain';

export type SupplierOnboardingDeal = {
  id: string;
  name: string;
};

/* ─── Core adapter ────────────────────────────────────────────────────────── */

/**
 * Build the full SupplierOnboardingInput from a participant and deal.
 * Safe to call before the participant has submitted — all optional fields
 * default to empty/null so the engine can derive the correct stage.
 */
export function buildSupplierOnboardingInput(
  participant: DemoParticipant,
  deal: SupplierOnboardingDeal
): SupplierOnboardingInput {
  const so = participant.supplierOnboarding;
  const commissionKind = participant.commissionKind ?? 'fixed_amount';
  const obligationType =
    commissionKind === 'pct_deal_value' || commissionKind === 'pct_of_participant'
      ? 'revenue_share'
      : 'fixed_fee';

  return {
    projectId: deal.id,
    participant: {
      id: participant.id,
      name: participant.name,
      role: participant.role,
      email: participant.email || null,
    },
    agreement: {
      approved: participant.approvalStatus === 'Approved',
      approvedAt: participant.approvedAt ?? null,
      agreementReference: null,
      projectName: deal.name,
    },
    obligation: {
      amount: participant.commissionValue ?? 0,
      currency: 'AUD',
      type: obligationType,
      description: `${participant.role} services — ${deal.name}`,
      revenueSharePercent:
        commissionKind === 'pct_deal_value' ? (participant.commissionValue ?? null) : null,
      condition: participant.payoutCondition ?? null,
      dueDate: participant.payoutDueDate ?? null,
    },
    payment: so?.payment ?? {
      preference: 'bank_account',
      bankDetails: { accountName: null, bsb: null, accountNumber: null },
      alternativePaymentMethod: null,
    },
    abn: so?.abn ?? {
      abn: null,
      abnNotApplicable: false,
      abnVerified: false,
      businessName: null,
    },
    gst: so?.gst ?? { gstStatus: 'pending' },
    submission: so?.submission ?? { submittedAt: null, declarationAccepted: false },
    operator: so?.operator ?? { approvedAt: null, xeroExportedAt: null, notes: null },
    currentDate: new Date().toISOString(),
  };
}

/* ─── Lifecycle selectors ─────────────────────────────────────────────────── */

/**
 * Helper to extract legacy lifecycle fields from a participant for
 * backwards-compatible derivation.
 */
function legacyFields(participant: DemoParticipant) {
  return {
    payoutVerificationConfirmed: participant.payoutVerificationConfirmed,
    payoutOnboardingPhase: participant.payoutOnboardingPhase,
    onboardingStatus: participant.onboardingStatus,
  };
}

/**
 * Derive the current supplier onboarding lifecycle status.
 *
 * Uses the event log + new domain fields when available, falls back to
 * legacy phase fields for backwards compatibility.
 */
export function deriveLifecycleStatus(participant: DemoParticipant): SupplierOnboardingLifecycle {
  return deriveLifecycle(
    participant.supplierOnboarding as StoredOnboardingState | undefined,
    legacyFields(participant)
  );
}

/**
 * True when the participant has submitted their onboarding form.
 * Covers all post-submission states: SUBMITTED, APPROVED, REJECTED.
 */
export function hasSubmittedOnboarding(participant: DemoParticipant): boolean {
  const lifecycle = deriveLifecycleStatus(participant);
  return lifecycle === 'SUBMITTED' || lifecycle === 'APPROVED' || lifecycle === 'REJECTED';
}

/**
 * True when the operator has approved this supplier's onboarding.
 * Derived from verification state, approval metadata, and event log.
 * Falls back to legacy payoutVerificationConfirmed for backwards compatibility.
 */
export function isOnboardingOperatorApproved(participant: DemoParticipant): boolean {
  return isSupplierApproved(
    participant.supplierOnboarding as StoredOnboardingState | undefined,
    { payoutVerificationConfirmed: participant.payoutVerificationConfirmed }
  );
}

/**
 * True when the supplier's onboarding was rejected by the operator.
 */
export function isOnboardingRejected(participant: DemoParticipant): boolean {
  return deriveLifecycleStatus(participant) === 'REJECTED';
}

/**
 * Get the rejection reason if the onboarding was rejected.
 */
export function getOnboardingRejectionReason(participant: DemoParticipant): string | null {
  return participant.supplierOnboarding?.rejection?.reason ?? null;
}

/* ─── Domain model builders ───────────────────────────────────────────────── */

/**
 * Build a SupplierProfile from participant + deal data.
 */
export function buildParticipantSupplierProfile(
  participant: DemoParticipant,
  deal: SupplierOnboardingDeal
): SupplierProfile {
  const input = buildSupplierOnboardingInput(participant, deal);
  return buildSupplierProfile(input);
}

/**
 * Derive the current SupplierVerification from participant data.
 * Combines new verification state with auto-derived flags (tax, bank).
 */
export function deriveSupplierVerification(participant: DemoParticipant): SupplierVerification {
  return buildSupplierVerification(
    participant.supplierOnboarding as StoredOnboardingState | undefined,
    { supplierApproved: isOnboardingOperatorApproved(participant) }
  );
}

/**
 * Generate a CommercialReviewSummary from participant + deal data.
 * Used on the operator review page before approving or rejecting.
 */
export function buildCommercialReviewSummary(
  participant: DemoParticipant,
  deal: SupplierOnboardingDeal
): CommercialReviewSummary {
  const input = buildSupplierOnboardingInput(participant, deal);
  return generateCommercialReviewSummary(input);
}

/* ─── Re-exports for convenience ─────────────────────────────────────────── */
export type { SupplierOnboardingLifecycle, SupplierProfile, SupplierVerification, CommercialReviewSummary };
