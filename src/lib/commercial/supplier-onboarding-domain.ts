/**
 * Supplier Onboarding Domain Model
 *
 * Production-grade commercial workflow types for supplier onboarding.
 *
 * Design principles:
 *
 *   IMMUTABLE EVENTS
 *   All commercial actions append to an event log — they never overwrite history.
 *   All commercial state is eventually derivable from events.
 *
 *   EXTENSIBLE VERIFICATION
 *   SupplierVerification replaces the single `payoutVerificationConfirmed` boolean.
 *   Future integrations (Stripe, Wise, Airwallex, KYC) can add fields without redesign.
 *
 *   SEPARATION OF CONCERNS
 *   Approval    = commercial decision (operator reviewed and accepted the submission)
 *   Accounting  = integration concern (Xero export happens downstream of approval)
 *   Settlement  = financial concern   (payment release happens after accounting clears)
 *
 *   DERIVED READINESS
 *   isSupplierApproved(), isSettlementReady(), etc. are pure selectors derived from
 *   commercial state — they never rely on manually-toggled booleans.
 *
 *   BACKWARDS COMPATIBILITY
 *   All new fields are optional. The existing participant_payload.supplierOnboarding
 *   shape (payment, abn, gst, submission, operator) is preserved as-is.
 *   New fields (events, verification, approval, lifecycle) are additive.
 *   No storage migration is required.
 *
 *   SUPPLIER PROFILE
 *   SupplierProfile / SupplierTaxProfile are adapters over the existing payload.
 *   They decouple future development from participant_payload without changing storage.
 */

import type {
  SupplierOnboardingABNInput,
  SupplierOnboardingGSTInput,
  SupplierPaymentDetails,
  SupplierOnboardingInput,
} from '@/lib/commercial/supplier-onboarding';
import { getSupplierGstTaxTreatment } from '@/lib/commercial/supplier-invoice-projection';

/* ─── 1. Lifecycle state machine ─────────────────────────────────────────── */

/**
 * The canonical supplier onboarding lifecycle.
 *
 * State transitions:
 *
 *   NOT_STARTED
 *     ↓  (agreement approved)
 *   INVITED
 *     ↓  (supplier opens form)
 *   IN_PROGRESS
 *     ↓  (supplier submits)
 *   SUBMITTED
 *     ↓  (operator reviews)
 *   APPROVED  ──or──  REJECTED
 *
 * REJECTED allows future resubmission → IN_PROGRESS again.
 * APPROVED unlocks accounting export (separate integration concern).
 */
export type SupplierOnboardingLifecycle =
  | 'NOT_STARTED'   // Agreement not yet approved or onboarding not initiated
  | 'INVITED'       // Operator has initiated onboarding for this participant
  | 'IN_PROGRESS'   // Supplier is completing the form (started but not submitted)
  | 'SUBMITTED'     // Supplier submitted — awaiting operator review
  | 'UNDER_REVIEW'  // Operator has opened review (implicit — same as SUBMITTED for now)
  | 'APPROVED'      // Operator approved — accounting export is now permitted
  | 'REJECTED';     // Operator rejected — supplier can resubmit after corrections

/* ─── 2. Immutable commercial events ─────────────────────────────────────── */

/** Base fields shared by all commercial onboarding events. */
type BaseOnboardingEvent = {
  /** Unique event ID (uuid). */
  id: string;
  /** Who performed this action (user ID or system identifier). */
  performedBy: string;
  /** ISO timestamp when this event occurred. */
  timestamp: string;
};

/**
 * Supplier submitted their onboarding form.
 * Payload captures the full form snapshot at submission time.
 */
export type SupplierOnboardingSubmittedEvent = BaseOnboardingEvent & {
  type: 'SUPPLIER_ONBOARDING_SUBMITTED';
  participantId: string;
  payload: {
    payment: SupplierPaymentDetails;
    abn: SupplierOnboardingABNInput;
    gst: SupplierOnboardingGSTInput;
    declarationAccepted: boolean;
  };
};

/**
 * Operator approved the supplier's submitted onboarding.
 * This is a commercial decision — it does NOT create accounting records.
 * approvalVersion increments with each re-approval (after rejection + resubmission).
 */
export type SupplierOnboardingApprovedEvent = BaseOnboardingEvent & {
  type: 'SUPPLIER_ONBOARDING_APPROVED';
  participantId: string;
  payload: {
    approvalNotes?: string;
    approvalVersion: number;
  };
};

/**
 * Operator rejected the supplier's submitted onboarding.
 * The supplier should be notified and can resubmit after corrections.
 */
export type SupplierOnboardingRejectedEvent = BaseOnboardingEvent & {
  type: 'SUPPLIER_ONBOARDING_REJECTED';
  participantId: string;
  payload: {
    reason: string;
  };
};

/**
 * Operator requested changes without fully rejecting.
 * The supplier can update and resubmit.
 */
export type SupplierOnboardingChangesRequestedEvent = BaseOnboardingEvent & {
  type: 'SUPPLIER_ONBOARDING_CHANGES_REQUESTED';
  participantId: string;
  payload: {
    requestedChanges: string;
  };
};

/**
 * Draft invoice was generated from the approved agreement.
 */
export type SupplierInvoiceGeneratedEvent = BaseOnboardingEvent & {
  type: 'SUPPLIER_INVOICE_GENERATED';
  participantId: string;
  payload: {
    invoiceAmount: number;
    currency: string;
    gstStatus: 'pending' | 'yes' | 'no' | 'not_applicable';
  };
};

/** Union of all commercial onboarding events. */
export type CommercialOnboardingEvent =
  | SupplierOnboardingSubmittedEvent
  | SupplierOnboardingApprovedEvent
  | SupplierOnboardingRejectedEvent
  | SupplierOnboardingChangesRequestedEvent
  | SupplierInvoiceGeneratedEvent;

/* ─── 3. Extensible verification ─────────────────────────────────────────── */

/**
 * Supplier verification state.
 *
 * Replaces the single `payoutVerificationConfirmed` boolean.
 * Each dimension can be verified independently by different integrations.
 *
 * Future integrations:
 *   bankVerified     → Wise / Airwallex real-time bank account validation
 *   taxVerified      → ABR ABN lookup / international tax registry
 *   identityVerified → KYC provider (Onfido, Stripe Identity, etc.)
 */
export type SupplierVerification = {
  /** Operator has reviewed and approved the supplier's submitted details. */
  supplierApproved: boolean;
  /**
   * Bank account has been verified (e.g. by a payment provider integration).
   * Currently a placeholder — set to false until integration is live.
   */
  bankVerified: boolean;
  /**
   * Tax details (ABN / GST) have been verified against a government registry.
   * Currently set to true when ABN validation passes locally.
   */
  taxVerified: boolean;
  /**
   * Identity has been verified through a KYC provider.
   * Placeholder for future integration.
   */
  identityVerified: boolean;
};

/** Returns a default verification state (all false). */
export function createDefaultVerification(): SupplierVerification {
  return {
    supplierApproved: false,
    bankVerified: false,
    taxVerified: false,
    identityVerified: false,
  };
}

/* ─── 4. Approval metadata ────────────────────────────────────────────────── */

/**
 * Metadata captured when an operator approves a supplier's onboarding.
 *
 * approvalVersion starts at 1 and increments with each subsequent approval
 * (following a rejection and resubmission cycle).
 */
export type ApprovalMetadata = {
  approvedBy: string;
  approvedAt: string;
  approvalNotes: string | null;
  approvalVersion: number;
};

/** Metadata captured when an operator rejects a submission. */
export type RejectionMetadata = {
  rejectedBy: string;
  rejectedAt: string;
  reason: string;
};

/* ─── 5. Supplier profile domain model ───────────────────────────────────── */

/**
 * SupplierProfile
 *
 * The canonical supplier identity for commercial operations.
 * Acts as an adapter over the existing SupplierOnboardingInput — decouples
 * future development from participant_payload internals.
 */
export type SupplierProfile = {
  participantId: string;
  name: string;
  role: string;
  email: string | null;
  taxProfile: SupplierTaxProfile;
  paymentMethod: SupplierPaymentSummary;
};

/**
 * SupplierTaxProfile
 *
 * Captures all tax-relevant information for invoicing and accounting.
 * Drives GST calculation, ABN display, and accounting system integration.
 */
export type SupplierTaxProfile = {
  abn: string | null;
  abnValid: boolean;
  abnNotApplicable: boolean;
  businessName: string | null;
  gstRegistered: boolean;
  gstNotApplicable: boolean;
  gstClassification: 'gst_registered' | 'not_registered_for_gst' | 'overseas_supplier' | 'pending';
  requiresManualReview: boolean;
};

/** Summary of the supplier's chosen payment method for operator display. */
export type SupplierPaymentSummary = {
  type: 'bank_account' | 'alternative' | 'not_provided';
  label: string;
  detail: string | null;
  requiresManualProcessing: boolean;
};

/* ─── 6. Commercial review summary ───────────────────────────────────────── */

export type ReviewCheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export type ReviewCheck = {
  id: string;
  label: string;
  status: ReviewCheckStatus;
  detail?: string;
};

/**
 * CommercialReviewSummary
 *
 * A deterministic set of review checks generated from the supplier's submission.
 * Surfaces to the operator before they approve or reject.
 *
 * Design: each check is independent and labelled by ID so AI-assisted review
 * can be layered in later without restructuring the component.
 */
export type CommercialReviewSummary = {
  checks: ReviewCheck[];
  /** True when at least one check has status 'fail'. */
  hasBlockers: boolean;
  /** True when at least one check has status 'warn'. */
  hasWarnings: boolean;
  /** True when all checks pass or are info-only. */
  allClear: boolean;
};

/* ─── 7. Readiness selectors ─────────────────────────────────────────────── */

/** Stored supplier onboarding state (the `participant.supplierOnboarding` shape). */
export type StoredOnboardingState = {
  payment?: SupplierPaymentDetails;
  abn?: SupplierOnboardingABNInput;
  gst?: SupplierOnboardingGSTInput;
  submission?: { submittedAt: string | null; declarationAccepted: boolean };
  operator?: { approvedAt: string | null; xeroExportedAt: string | null; notes: string | null };
  events?: CommercialOnboardingEvent[];
  verification?: SupplierVerification;
  approval?: ApprovalMetadata;
  rejection?: RejectionMetadata;
  lifecycle?: SupplierOnboardingLifecycle;
};

/**
 * Derive the current lifecycle status from stored onboarding state.
 *
 * Priority order (most recent event wins):
 *   1. Check events[] for the latest state transition event.
 *   2. Fall back to legacy fields (operator.approvedAt, submission.submittedAt, etc.)
 *   3. Default to NOT_STARTED.
 */
export function deriveLifecycle(
  stored: StoredOnboardingState | undefined | null,
  /** Legacy fields for backwards compatibility. */
  legacy?: {
    payoutVerificationConfirmed?: boolean | null;
    payoutOnboardingPhase?: string | null;
    onboardingStatus?: string | null;
  }
): SupplierOnboardingLifecycle {
  if (!stored) {
    // Pure legacy fallback
    if (legacy?.payoutVerificationConfirmed === true) return 'APPROVED';
    if (legacy?.payoutOnboardingPhase === 'COMPLETED' || legacy?.onboardingStatus === 'COMPLETE') return 'SUBMITTED';
    if (legacy?.payoutOnboardingPhase === 'IN_PROGRESS' || legacy?.onboardingStatus === 'INCOMPLETE') return 'IN_PROGRESS';
    if (legacy?.payoutOnboardingPhase === 'INVITED') return 'INVITED';
    return 'NOT_STARTED';
  }

  // If we have a cached lifecycle from the latest event, trust it
  if (stored.lifecycle) return stored.lifecycle;

  // Derive from events (most recent wins)
  if (stored.events && stored.events.length > 0) {
    const sorted = [...stored.events].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latest = sorted[0];
    switch (latest.type) {
      case 'SUPPLIER_ONBOARDING_APPROVED': return 'APPROVED';
      case 'SUPPLIER_ONBOARDING_REJECTED': return 'REJECTED';
      case 'SUPPLIER_ONBOARDING_CHANGES_REQUESTED': return 'IN_PROGRESS';
      case 'SUPPLIER_ONBOARDING_SUBMITTED': return 'SUBMITTED';
      case 'SUPPLIER_INVOICE_GENERATED': return 'INVITED';
    }
  }

  // Fall back to field-based inference
  if (stored.approval?.approvedAt || stored.verification?.supplierApproved) return 'APPROVED';
  if (stored.rejection?.rejectedAt) return 'REJECTED';
  if (stored.submission?.submittedAt) return 'SUBMITTED';
  if (stored.payment?.preference || stored.abn?.abn !== undefined) return 'IN_PROGRESS';

  // Legacy fallback
  if (legacy?.payoutVerificationConfirmed === true) return 'APPROVED';
  if (legacy?.payoutOnboardingPhase === 'COMPLETED' || legacy?.onboardingStatus === 'COMPLETE') return 'SUBMITTED';
  if (legacy?.payoutOnboardingPhase === 'IN_PROGRESS' || legacy?.onboardingStatus === 'INCOMPLETE') return 'IN_PROGRESS';
  if (legacy?.payoutOnboardingPhase === 'INVITED') return 'INVITED';

  return 'NOT_STARTED';
}

/**
 * True when the operator has explicitly approved this supplier's onboarding.
 * The authoritative check — derived from verification state, approval metadata,
 * and the event log (with legacy fallback).
 */
export function isSupplierApproved(
  stored: StoredOnboardingState | undefined | null,
  legacy?: { payoutVerificationConfirmed?: boolean | null }
): boolean {
  if (stored?.verification?.supplierApproved === true) return true;
  if (stored?.approval?.approvedAt) return true;
  if (stored?.events?.some((e) => e.type === 'SUPPLIER_ONBOARDING_APPROVED')) return true;
  return legacy?.payoutVerificationConfirmed === true;
}

/**
 * True when the supplier's tax details are considered verified.
 * Currently: ABN is valid, or ABN is not applicable (overseas supplier).
 * Future: could integrate ABR API or ATO registry lookup.
 */
export function isSupplierTaxVerified(
  stored: StoredOnboardingState | undefined | null
): boolean {
  if (stored?.verification?.taxVerified === true) return true;
  const abn = stored?.abn;
  if (!abn) return false;
  return abn.abnVerified === true || abn.abnNotApplicable === true;
}

/**
 * True when the supplier's bank or payment details have been verified.
 * Currently: bank details are complete (BSB + account number present and valid format).
 * Future: Wise / Airwallex / NPP real-time verification.
 */
export function isSupplierBankVerified(
  stored: StoredOnboardingState | undefined | null
): boolean {
  if (stored?.verification?.bankVerified === true) return true;
  const payment = stored?.payment;
  if (!payment) return false;
  if (payment.preference === 'alternative') return true; // operator will process manually
  const bank = payment.bankDetails;
  if (!bank) return false;
  return Boolean(bank.accountName && bank.bsb && bank.accountNumber);
}

/**
 * True when all supplier details are verified (tax + bank or alternative payment).
 */
export function isSupplierFullyVerified(
  stored: StoredOnboardingState | undefined | null,
  legacy?: { payoutVerificationConfirmed?: boolean | null }
): boolean {
  return (
    isSupplierApproved(stored, legacy) &&
    isSupplierTaxVerified(stored) &&
    isSupplierBankVerified(stored)
  );
}

/**
 * True when the supplier's onboarding is at a state that permits accounting export.
 * Requires operator approval — accounting is downstream of the commercial decision.
 */
export function isAccountingReady(
  stored: StoredOnboardingState | undefined | null,
  legacy?: { payoutVerificationConfirmed?: boolean | null }
): boolean {
  return isSupplierApproved(stored, legacy);
}

/**
 * True when all conditions for payment release are met.
 * Requires: approval + accounting export complete + revenue received.
 * The `revenueReceived` flag comes from the settlement layer — passed in here.
 */
export function isPaymentReady(
  stored: StoredOnboardingState | undefined | null,
  revenueReceived: boolean,
  legacy?: { payoutVerificationConfirmed?: boolean | null }
): boolean {
  if (!isSupplierApproved(stored, legacy)) return false;
  if (!stored?.operator?.xeroExportedAt) return false;
  return revenueReceived;
}

/**
 * True when supplier onboarding is at a state that permits settlement calculation.
 * Requires: operator approval at minimum (accounting export is preferred but not required).
 */
export function isSettlementReady(
  stored: StoredOnboardingState | undefined | null,
  legacy?: { payoutVerificationConfirmed?: boolean | null }
): boolean {
  return isSupplierApproved(stored, legacy);
}

/* ─── 8. Adapter: SupplierProfile builder ────────────────────────────────── */

/**
 * Build a SupplierProfile from a SupplierOnboardingInput.
 * Pure adapter — no storage reads. Safe to call at any lifecycle stage.
 */
export function buildSupplierProfile(input: SupplierOnboardingInput): SupplierProfile {
  const { abn, gst, payment } = input;

  const taxProfile: SupplierTaxProfile = {
    abn: abn.abn,
    abnValid: abn.abnVerified,
    abnNotApplicable: abn.abnNotApplicable,
    businessName: abn.businessName ?? null,
    gstRegistered: gst.gstStatus === 'yes',
    gstNotApplicable: gst.gstStatus === 'not_applicable',
    gstClassification:
      gst.gstStatus === 'yes'
        ? 'gst_registered'
        : gst.gstStatus === 'no'
          ? 'not_registered_for_gst'
          : gst.gstStatus === 'not_applicable'
            ? 'overseas_supplier'
            : 'pending',
    requiresManualReview: !abn.abnVerified && !abn.abnNotApplicable,
  };

  let paymentSummary: SupplierPaymentSummary;
  if (!payment.preference || payment.preference === 'bank_account') {
    const bank = payment.bankDetails;
    const hasBankDetails = Boolean(bank?.bsb && bank?.accountNumber);
    paymentSummary = {
      type: hasBankDetails ? 'bank_account' : 'not_provided',
      label: hasBankDetails ? 'Bank transfer' : 'Not provided',
      detail: hasBankDetails
        ? `BSB ${bank!.bsb} · ${bank!.accountNumber}`
        : null,
      requiresManualProcessing: false,
    };
  } else {
    paymentSummary = {
      type: 'alternative',
      label: 'Alternative payment method',
      detail: payment.alternativePaymentMethod ?? null,
      requiresManualProcessing: true,
    };
  }

  return {
    participantId: input.participant.id,
    name: input.participant.name,
    role: input.participant.role,
    email: input.participant.email ?? null,
    taxProfile,
    paymentMethod: paymentSummary,
  };
}

/* ─── 9. Commercial review summary generator ─────────────────────────────── */

/**
 * Generate a CommercialReviewSummary from a SupplierOnboardingInput.
 *
 * Each check is deterministic and labelled by ID for future AI layer integration.
 * The operator sees this before deciding to approve or reject.
 */
export function generateCommercialReviewSummary(
  input: SupplierOnboardingInput
): CommercialReviewSummary {
  const checks: ReviewCheck[] = [];
  const { payment, abn, gst, submission, agreement, obligation } = input;

  // --- Invoice ---
  checks.push({
    id: 'invoice_generated',
    label: 'Draft invoice generated',
    status: 'pass',
    detail: `${input.obligation.currency} ${obligation.amount.toLocaleString()} — ${obligation.description ?? obligation.type}`,
  });

  // --- Declaration ---
  checks.push({
    id: 'declaration_accepted',
    label: 'Declaration accepted',
    status: submission.declarationAccepted ? 'pass' : 'fail',
    detail: submission.declarationAccepted ? 'Supplier confirmed details are correct' : 'Declaration was not accepted',
  });

  // --- Payment details ---
  if (payment.preference === 'bank_account') {
    const bank = payment.bankDetails;
    const bsbOk = Boolean(bank?.bsb && /^\d{3}-?\d{3}$/.test(bank.bsb));
    const accOk = Boolean(bank?.accountNumber && /^\d{6,9}$/.test(bank.accountNumber.replace(/\s/g, '')));
    const nameOk = Boolean(bank?.accountName);
    checks.push({
      id: 'payment_bank',
      label: 'Bank account supplied',
      status: bsbOk && accOk && nameOk ? 'pass' : 'warn',
      detail: bsbOk && accOk && nameOk
        ? `BSB ${bank!.bsb} · Account ${bank!.accountNumber}`
        : 'Bank details incomplete or invalid format — verify manually',
    });
  } else {
    checks.push({
      id: 'payment_alternative',
      label: 'Alternative payment method',
      status: payment.alternativePaymentMethod ? 'warn' : 'fail',
      detail: payment.alternativePaymentMethod
        ? `${payment.alternativePaymentMethod} — manual processing required`
        : 'No payment method provided',
    });
  }

  // --- ABN ---
  if (abn.abnNotApplicable) {
    checks.push({
      id: 'abn',
      label: 'ABN — overseas supplier',
      status: 'warn',
      detail: 'Supplier has non-Australian tax residency — manual review required before export',
    });
  } else if (abn.abnVerified && abn.abn) {
    checks.push({
      id: 'abn',
      label: 'ABN verified',
      status: 'pass',
      detail: abn.businessName ? `${abn.abn} · ${abn.businessName}` : abn.abn,
    });
  } else if (abn.abn) {
    checks.push({
      id: 'abn',
      label: 'ABN provided — not verified',
      status: 'warn',
      detail: `${abn.abn} — could not be automatically verified`,
    });
  } else {
    checks.push({
      id: 'abn',
      label: 'ABN not provided',
      status: 'warn',
      detail: 'Supplier did not provide an ABN — manual review required',
    });
  }

  // --- GST ---
  if (gst.gstStatus === 'pending') {
    checks.push({
      id: 'gst',
      label: 'GST status not confirmed',
      status: 'fail',
      detail: 'Supplier did not confirm their GST registration status',
    });
  } else {
    const gstTreatment = getSupplierGstTaxTreatment(gst.gstStatus);
    const gstLabel =
      gst.gstStatus === 'yes' ? 'GST registered — invoice includes GST' :
      gst.gstStatus === 'no' ? 'Not GST registered — invoice is ex-GST' :
      'Overseas supplier — Australian GST not applicable';
    checks.push({
      id: 'gst',
      label: gstTreatment.displayStatus,
      status: 'pass',
      detail: gstLabel,
    });
  }

  // --- Agreement match check ---
  const agreementApproved = agreement.approved && agreement.approvedAt;
  checks.push({
    id: 'agreement_approved',
    label: 'Agreement approved',
    status: agreementApproved ? 'pass' : 'warn',
    detail: agreementApproved
      ? `Approved at ${new Date(agreement.approvedAt!).toLocaleDateString('en-AU')}`
      : 'Agreement approval not confirmed — verify before approving',
  });

  const hasBlockers = checks.some((c) => c.status === 'fail');
  const hasWarnings = checks.some((c) => c.status === 'warn');

  return {
    checks,
    hasBlockers,
    hasWarnings,
    allClear: !hasBlockers && !hasWarnings,
  };
}

/* ─── 10. Event helpers ───────────────────────────────────────────────────── */

/**
 * Append a new event to an existing event log.
 * Returns a new array — never mutates the original.
 */
export function appendOnboardingEvent(
  existing: CommercialOnboardingEvent[],
  event: CommercialOnboardingEvent
): CommercialOnboardingEvent[] {
  return [...existing, event];
}

/**
 * Derive the approval version for the next approval event.
 * Counts previous APPROVED events + 1.
 */
export function nextApprovalVersion(events: CommercialOnboardingEvent[]): number {
  return events.filter((e) => e.type === 'SUPPLIER_ONBOARDING_APPROVED').length + 1;
}

/**
 * Build a SupplierVerification from stored state and an ABN validation result.
 * Conservative: only marks verified when evidence is unambiguous.
 */
export function buildSupplierVerification(
  stored: StoredOnboardingState | undefined | null,
  override?: Partial<SupplierVerification>
): SupplierVerification {
  const base = stored?.verification ?? createDefaultVerification();
  return {
    ...base,
    taxVerified: base.taxVerified || isSupplierTaxVerified(stored),
    bankVerified: base.bankVerified || isSupplierBankVerified(stored),
    ...override,
  };
}
