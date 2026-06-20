/**
 * Supplier Onboarding Engine
 *
 * The canonical engine for the Supplier Onboarding workflow.
 *
 * This workflow is the bridge between agreement approval and settlement:
 *
 *   Agreement Approved
 *       ↓
 *   Invoice Generated   (automatic — from approved agreement)
 *       ↓
 *   Supplier Onboarding (bank details, ABN, GST)
 *       ↓
 *   Operator Review
 *       ↓
 *   Push to Xero
 *       ↓
 *   Settlement
 *
 * Design rules:
 *   - Pure functions — deterministic, no network calls, no side effects.
 *   - No component may calculate onboarding readiness independently.
 *   - Everything derives from deriveSupplierOnboardingStatus().
 *   - ABN validation uses the canonical ATO checksum algorithm.
 *   - Draft invoice is always generated automatically from the approved agreement.
 *   - Operators must explicitly approve before Xero export — never automatic.
 *
 * Exported functions:
 *   generateDraftInvoice()              — auto-generate invoice from agreement
 *   validateABN()                       — ATO checksum + format validation
 *   validateBankDetails()               — BSB/account number validation
 *   deriveSupplierOnboardingStatus()    — full readiness for one participant
 *   deriveWorkspaceOnboardingStatus()   — aggregate across all participants
 *   buildSupplierOnboardingNarrative()  — Provvy integration
 */

import { calculateGstFromExclusiveSubtotal } from '@/lib/commercial/gst-utils';

/* ─── Onboarding stage ──────────────────────────────────────────────────── */

/**
 * The canonical stages of the supplier onboarding lifecycle.
 * Progresses linearly. No stage can be skipped.
 */
export type SupplierOnboardingStage =
  | 'not_started'        // Agreement not yet approved — onboarding cannot begin
  | 'invoice_generated'  // Draft invoice auto-generated from approved agreement
  | 'in_progress'        // Supplier has started but not submitted
  | 'submitted'          // Supplier has submitted — awaiting operator review
  | 'operator_approved'  // Operator has approved — ready for Xero
  | 'xero_exported';     // Exported to Xero — onboarding complete

/* ─── Draft Invoice ─────────────────────────────────────────────────────── */

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  /**
   * 'GST' | 'EXEMPT' | 'PENDING'
   * PENDING = GST status not yet confirmed by supplier.
   */
  taxType: 'GST' | 'EXEMPT' | 'PENDING';
  lineTotal: number;
  currency: string;
};

export type GSTStatus = 'yes' | 'no' | 'not_applicable' | 'pending';

export type DraftInvoice = {
  /** Deterministic ID: `${projectId}:${participantId}:supplier_invoice` */
  invoiceId: string;
  projectId: string;
  participantId: string;

  /** Human-readable agreement reference. e.g. "SUNSET-2024" */
  agreementReference: string | null;
  /** Project/event name. */
  projectName: string;
  /** Supplier / participant name. */
  participantName: string;
  /** Supplier role. e.g. "Venue Manager" */
  participantRole: string;

  /**
   * Description of services provided.
   * Auto-populated from the agreement earnings description.
   */
  description: string;

  lineItems: InvoiceLineItem[];

  /** Subtotal before GST. */
  subtotal: number;
  /**
   * GST component. null while gstStatus is 'pending' or 'no' or 'not_applicable'.
   * 10% of subtotal when gstStatus is 'yes'.
   */
  gstAmount: number | null;
  /** Total including GST (when applicable). */
  total: number;

  currency: string;

  /**
   * Supplier-confirmed GST registration status.
   * Starts as 'pending' — updated when supplier completes onboarding.
   */
  gstStatus: GSTStatus;

  /** ISO due date. Derived from agreement settlement timeline. */
  dueDate: string | null;

  /** Commercial reference for tracking. e.g. "SUNSET-2024:SARAH" */
  commercialReference: string;

  /**
   * ISO timestamp when this invoice was automatically generated.
   * This is NOT when the supplier submitted it — that is submittedAt.
   */
  generatedAt: string;
  /** ISO timestamp when the supplier confirmed the invoice. */
  confirmedAt: string | null;
  /** ISO timestamp when the operator approved the invoice. */
  approvedAt: string | null;
};

/* ─── ABN Validation ────────────────────────────────────────────────────── */

export type ABNValidationResult = {
  /** The raw input, stripped of spaces/hyphens. */
  abn: string;
  /** True when format and checksum are valid. */
  isValid: boolean;
  /**
   * True when the supplier has declared ABN does not apply to their situation
   * (overseas contractor, foreign company, etc.).
   */
  isNotApplicable: boolean;
  /**
   * True when the ABN is not applicable or format-valid but not yet ABR-verified.
   * Requires operator manual review before Xero export.
   */
  requiresManualReview: boolean;
  /** Formatted as "XX XXX XXX XXX". null when invalid. */
  formattedABN: string | null;
  /** Business name from ABR lookup. null until ABR integration is wired. */
  businessName: string | null;
  /** ABN status from ABR. null until ABR integration is wired. */
  abnStatus: 'Active' | 'Cancelled' | null;
  /**
   * Operator-facing error message when isValid is false.
   * null when valid.
   */
  errorMessage: string | null;
};

/* ─── Bank Details Validation ──────────────────────────────────────────── */

export type BankDetailsValidationResult = {
  accountName: string | null;
  bsb: string | null;
  accountNumber: string | null;
  /** True when BSB format is valid (6 digits, optionally hyphenated as XXX-XXX). */
  bsbValid: boolean;
  /** True when account number is 6–9 digits. */
  accountNumberValid: boolean;
  /** True when account name is non-empty. */
  accountNameValid: boolean;
  /** True when all three fields are valid. */
  isComplete: boolean;
  errors: string[];
};

export type PaymentPreference = 'bank_account' | 'alternative';

export type SupplierPaymentDetails = {
  preference: PaymentPreference;
  /** Filled when preference === 'bank_account'. */
  bankDetails: {
    accountName: string | null;
    bsb: string | null;
    accountNumber: string | null;
  };
  /**
   * Filled when preference === 'alternative'.
   * Free text. Examples: "USDC wallet", "Wise", "PayPal", "Cash", "Cheque".
   */
  alternativePaymentMethod: string | null;
};

/* ─── Onboarding Input ──────────────────────────────────────────────────── */

export type SupplierOnboardingAgreementInput = {
  /** The participant has approved their agreement. */
  approved: boolean;
  /** ISO timestamp of approval. */
  approvedAt: string | null;
  /** Human-readable agreement reference. */
  agreementReference: string | null;
  /** Project / event name. */
  projectName: string;
};

export type SupplierOnboardingObligationInput = {
  /** Obligation amount. */
  amount: number;
  currency: string;
  /** "fixed_fee" | "revenue_share" | "conditional" | "unpaid_internal" */
  type: string;
  /** Description of what this payment is for. */
  description: string | null;
  /** Revenue share percentage if applicable. */
  revenueSharePercent: number | null;
  /** Condition that triggers payment, for conditional obligations. */
  condition: string | null;
  /** Expected due date. */
  dueDate: string | null;
};

export type SupplierOnboardingABNInput = {
  abn: string | null;
  abnNotApplicable: boolean;
  /** True when ABR verification has been completed. */
  abnVerified: boolean;
  businessName: string | null;
};

export type SupplierOnboardingGSTInput = {
  gstStatus: GSTStatus;
};

export type SupplierOnboardingSubmissionInput = {
  /** ISO timestamp when supplier submitted the onboarding form. */
  submittedAt: string | null;
  /** True when the supplier has confirmed the invoice and all details. */
  declarationAccepted: boolean;
};

export type SupplierOnboardingOperatorInput = {
  /** ISO timestamp when operator approved. */
  approvedAt: string | null;
  /** ISO timestamp when exported to Xero. */
  xeroExportedAt: string | null;
  /** Operator notes (optional). */
  notes: string | null;
};

export type SupplierOnboardingInput = {
  projectId: string;
  participant: {
    id: string;
    name: string;
    role: string;
    email?: string | null;
  };
  agreement: SupplierOnboardingAgreementInput;
  obligation: SupplierOnboardingObligationInput;
  payment: SupplierPaymentDetails;
  abn: SupplierOnboardingABNInput;
  gst: SupplierOnboardingGSTInput;
  submission: SupplierOnboardingSubmissionInput;
  operator: SupplierOnboardingOperatorInput;
  currentDate?: string;
};

/* ─── Onboarding Checklist ──────────────────────────────────────────────── */

export type OnboardingChecklistStatus = 'complete' | 'in_progress' | 'not_started' | 'requires_review';

export type OnboardingChecklistItem = {
  id: string;
  label: string;
  status: OnboardingChecklistStatus;
  /** One sentence explaining what's needed. null when complete. */
  explanation: string | null;
  /** The exact action to take. null when complete. */
  action: string | null;
  /** True when this item blocks Xero export. */
  isBlocker: boolean;
};

/* ─── Onboarding Status (Output) ────────────────────────────────────────── */

export type XeroReadiness = {
  /** True when everything is in order for Xero export. */
  readyForExport: boolean;
  /** Each item must pass before export is allowed. */
  checklist: OnboardingChecklistItem[];
  /** The primary reason export is blocked, if applicable. */
  primaryBlocker: string | null;
};

export type SupplierOnboardingStatus = {
  participantId: string;
  participantName: string;
  participantRole: string;

  /** Current lifecycle stage. */
  stage: SupplierOnboardingStage;
  /** Human-readable stage label. */
  stageLabel: string;

  /** The auto-generated draft invoice for this participant. */
  draftInvoice: DraftInvoice;

  /** ABN validation result. */
  abnValidation: ABNValidationResult;

  /** Bank details validation. */
  bankValidation: BankDetailsValidationResult;

  /** The onboarding checklist — one item per section. */
  checklist: OnboardingChecklistItem[];

  /** True when ALL checklist items are complete or requires_review (no blockers). */
  onboardingComplete: boolean;

  /** True when operator has explicitly approved and Xero export is safe. */
  readyForXeroExport: boolean;

  /** Xero export readiness detail. */
  xeroReadiness: XeroReadiness;

  /**
   * The single most important action for this participant.
   * For the supplier, this drives the CTA.
   * For the operator, this drives the review queue.
   */
  nextAction: string | null;

  /**
   * True when operator manual review is required before Xero export.
   * (ABN not applicable, alternative payment method, overseas supplier, etc.)
   */
  requiresManualReview: boolean;

  /** Commercial events generated by this onboarding state. */
  timelineEvents: SupplierOnboardingTimelineEvent[];
};

/* ─── Timeline Events ───────────────────────────────────────────────────── */

export type SupplierOnboardingEventType =
  | 'supplier_onboarding_requested'
  | 'supplier_invoice_generated'
  | 'supplier_onboarding_started'
  | 'supplier_onboarding_completed'
  | 'supplier_abn_verified'
  | 'supplier_abn_manual_review'
  | 'supplier_gst_confirmed'
  | 'supplier_alternative_payment_supplied'
  | 'supplier_invoice_approved'
  | 'supplier_invoice_exported_to_xero';

export type SupplierOnboardingTimelineEvent = {
  id: string;
  projectId: string;
  participantId: string;
  type: SupplierOnboardingEventType;
  title: string;
  description: string;
  commercialImpact: string;
  occurredAt: string;
};

/* ─── Workspace-level summary ───────────────────────────────────────────── */

export type WorkspaceOnboardingStatus = {
  participants: SupplierOnboardingStatus[];
  totalCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  requiresReviewCount: number;
  readyForExportCount: number;
  /**
   * Operator-facing summary line.
   * e.g. "2 / 5 suppliers have completed onboarding."
   */
  summary: string;
  /** The primary CTA for the operator. */
  primaryCta: string | null;
  /**
   * Participants still needing attention, with their primary blocker.
   * For the dashboard "remaining" list.
   */
  pendingSuppliers: Array<{
    participantName: string;
    primaryNeed: string;
  }>;
};

/* ══════════════════════════════════════════════════════════════════════════
   CORE FUNCTIONS
   ══════════════════════════════════════════════════════════════════════════ */

/* ─── Draft invoice generation ──────────────────────────────────────────── */

/**
 * Automatically generate a draft invoice from an approved agreement.
 *
 * PURE FUNCTION — no network calls. Always auto-populates from obligation data.
 * The supplier never uploads a blank invoice — this draft is pre-filled.
 *
 * GST is initially 'pending' — confirmed by the supplier during onboarding.
 * When gstStatus changes to 'yes', the invoice total is recalculated automatically.
 */
export function generateDraftInvoice(
  input: SupplierOnboardingInput,
  currentDate?: string
): DraftInvoice {
  const { projectId, participant, agreement, obligation, gst } = input;
  const now = currentDate ?? input.currentDate ?? new Date().toISOString();

  const invoiceId = `${projectId}:${participant.id}:supplier_invoice`;
  const commercialReference = `${agreement.agreementReference ?? projectId}:${participant.id}`;

  const lineItems = buildLineItems(input);
  const subtotal = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
  const gstAmount = calculateGSTAmount(subtotal, gst.gstStatus);
  const total = subtotal + (gstAmount ?? 0);

  return {
    invoiceId,
    projectId,
    participantId: participant.id,
    agreementReference: agreement.agreementReference,
    projectName: agreement.projectName,
    participantName: participant.name,
    participantRole: participant.role,
    description: buildInvoiceDescription(obligation),
    lineItems,
    subtotal,
    gstAmount,
    total,
    currency: obligation.currency,
    gstStatus: gst.gstStatus,
    dueDate: obligation.dueDate,
    commercialReference,
    generatedAt: now,
    confirmedAt: input.submission.submittedAt,
    approvedAt: input.operator.approvedAt,
  };
}

function buildLineItems(input: SupplierOnboardingInput): InvoiceLineItem[] {
  const { projectId, participant, agreement, obligation, gst } = input;
  const taxType =
    gst.gstStatus === 'yes' ? 'GST'
    : gst.gstStatus === 'no' ? 'EXEMPT'
    : 'PENDING';

  const items: InvoiceLineItem[] = [];

  if (obligation.type === 'fixed_fee' || obligation.type === 'unpaid_internal') {
    items.push({
      id: `${projectId}:${participant.id}:fixed`,
      description: obligation.description ?? `Services — ${participant.role}`,
      quantity: 1,
      unitAmount: obligation.amount,
      taxType,
      lineTotal: obligation.amount,
      currency: obligation.currency,
    });
  } else if (obligation.type === 'revenue_share' && obligation.revenueSharePercent !== null) {
    items.push({
      id: `${projectId}:${participant.id}:revenue_share`,
      description:
        obligation.description ??
        `${obligation.revenueSharePercent}% revenue share — ${participant.role}`,
      quantity: 1,
      unitAmount: obligation.amount,
      taxType,
      lineTotal: obligation.amount,
      currency: obligation.currency,
    });
  } else if (obligation.type === 'conditional') {
    items.push({
      id: `${projectId}:${participant.id}:conditional`,
      description:
        obligation.description ??
        `Conditional payment — ${obligation.condition ?? participant.role}`,
      quantity: 1,
      unitAmount: obligation.amount,
      taxType,
      lineTotal: obligation.amount,
      currency: obligation.currency,
    });
  }

  return items;
}

function buildInvoiceDescription(obligation: SupplierOnboardingObligationInput): string {
  if (obligation.description) return obligation.description;
  switch (obligation.type) {
    case 'fixed_fee': return 'Professional services — fixed fee engagement';
    case 'revenue_share': return 'Revenue share distribution';
    case 'conditional': return 'Conditional payment';
    default: return 'Services rendered';
  }
}

function calculateGSTAmount(subtotal: number, gstStatus: GSTStatus): number | null {
  // Delegates to the canonical GST utility — GST-exclusive convention (subtotal known).
  return calculateGstFromExclusiveSubtotal(subtotal, gstStatus === 'yes');
}

/* ─── ABN Validation ────────────────────────────────────────────────────── */

/**
 * Validate an Australian Business Number.
 *
 * Uses the canonical ATO checksum algorithm:
 *   1. Subtract 1 from the first digit
 *   2. Multiply each digit by weights: 10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19
 *   3. Sum the products
 *   4. If divisible by 89, the ABN is valid
 *
 * PURE FUNCTION — no ABR network calls.
 * Architecture is prepared for future ABR integration via the businessName / abnStatus fields.
 */
export function validateABN(raw: string | null, notApplicable = false): ABNValidationResult {
  if (notApplicable) {
    return {
      abn: '',
      isValid: false,
      isNotApplicable: true,
      requiresManualReview: true,
      formattedABN: null,
      businessName: null,
      abnStatus: null,
      errorMessage: null,
    };
  }

  if (!raw || raw.trim() === '') {
    return {
      abn: '',
      isValid: false,
      isNotApplicable: false,
      requiresManualReview: false,
      formattedABN: null,
      businessName: null,
      abnStatus: null,
      errorMessage: 'ABN is required.',
    };
  }

  // Strip spaces, hyphens, dots
  const digits = raw.replace(/[\s\-\.]/g, '');

  if (!/^\d{11}$/.test(digits)) {
    return {
      abn: digits,
      isValid: false,
      isNotApplicable: false,
      requiresManualReview: false,
      formattedABN: null,
      businessName: null,
      abnStatus: null,
      errorMessage: 'ABN must be exactly 11 digits.',
    };
  }

  // ATO checksum
  const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const d = digits.split('').map(Number);
  d[0] -= 1; // subtract 1 from first digit
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * d[i], 0);
  const isValid = sum % 89 === 0;

  if (!isValid) {
    return {
      abn: digits,
      isValid: false,
      isNotApplicable: false,
      requiresManualReview: false,
      formattedABN: null,
      businessName: null,
      abnStatus: null,
      errorMessage: 'ABN could not be verified. Please check the number and try again.',
    };
  }

  const formattedABN = `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;

  return {
    abn: digits,
    isValid: true,
    isNotApplicable: false,
    requiresManualReview: false,
    formattedABN,
    businessName: null, // Populated by future ABR integration
    abnStatus: 'Active',  // Assumed active when checksum passes; ABR confirms
    errorMessage: null,
  };
}

/* ─── Bank Details Validation ───────────────────────────────────────────── */

/**
 * Validate Australian bank details: BSB, account number, account name.
 * BSB: 6 digits, optionally formatted as XXX-XXX.
 * Account number: 6–9 digits.
 * Account name: non-empty string.
 */
export function validateBankDetails(
  accountName: string | null,
  bsb: string | null,
  accountNumber: string | null
): BankDetailsValidationResult {
  const errors: string[] = [];

  const rawBSB = bsb?.replace(/[\s\-]/g, '') ?? '';
  const rawAccount = accountNumber?.replace(/[\s]/g, '') ?? '';
  const rawName = accountName?.trim() ?? '';

  const bsbValid = /^\d{6}$/.test(rawBSB);
  const accountNumberValid = /^\d{6,9}$/.test(rawAccount);
  const accountNameValid = rawName.length > 0;

  if (!accountNameValid) errors.push('Account name is required.');
  if (!bsbValid && rawBSB !== '') errors.push('BSB must be 6 digits.');
  if (!bsbValid && rawBSB === '') errors.push('BSB is required.');
  if (!accountNumberValid && rawAccount !== '') errors.push('Account number must be 6–9 digits.');
  if (!accountNumberValid && rawAccount === '') errors.push('Account number is required.');

  return {
    accountName: rawName || null,
    bsb: rawBSB || null,
    accountNumber: rawAccount || null,
    bsbValid,
    accountNumberValid,
    accountNameValid,
    isComplete: bsbValid && accountNumberValid && accountNameValid,
    errors,
  };
}

/* ─── Stage derivation ──────────────────────────────────────────────────── */

function deriveStage(input: SupplierOnboardingInput): SupplierOnboardingStage {
  if (!input.agreement.approved) return 'not_started';

  if (input.operator.xeroExportedAt) return 'xero_exported';
  if (input.operator.approvedAt) return 'operator_approved';
  if (input.submission.submittedAt && input.submission.declarationAccepted) return 'submitted';

  // Supplier has started if any section has data
  const hasStarted =
    (input.payment.preference === 'bank_account' &&
      (input.payment.bankDetails.bsb || input.payment.bankDetails.accountNumber)) ||
    (input.payment.preference === 'alternative' && input.payment.alternativePaymentMethod) ||
    input.abn.abn ||
    input.abn.abnNotApplicable ||
    input.gst.gstStatus !== 'pending';

  if (hasStarted) return 'in_progress';
  return 'invoice_generated';
}

const STAGE_LABELS: Record<SupplierOnboardingStage, string> = {
  not_started: 'Awaiting agreement approval',
  invoice_generated: 'Supplier setup required',
  in_progress: 'Supplier setup in progress',
  submitted: 'Awaiting operator review',
  operator_approved: 'Approved — ready for Xero',
  xero_exported: 'Complete',
};

/* ─── Checklist derivation ──────────────────────────────────────────────── */

function deriveChecklist(input: SupplierOnboardingInput): OnboardingChecklistItem[] {
  const { agreement, payment, abn, gst, submission, operator } = input;
  const items: OnboardingChecklistItem[] = [];

  /* 1. Invoice reviewed */
  const invoiceConfirmed = Boolean(submission.submittedAt) || Boolean(operator.approvedAt);
  items.push({
    id: 'invoice_reviewed',
    label: 'Invoice reviewed',
    status: invoiceConfirmed ? 'complete' : agreement.approved ? 'not_started' : 'not_started',
    explanation: invoiceConfirmed ? null : 'Supplier must review and confirm the generated invoice.',
    action: invoiceConfirmed ? null : 'Ask supplier to review and confirm the draft invoice.',
    isBlocker: !invoiceConfirmed,
  });

  /* 2. Payment details */
  let paymentStatus: OnboardingChecklistStatus = 'not_started';
  let paymentExplanation: string | null = null;
  let paymentAction: string | null = null;
  let paymentIsBlocker = true;

  if (payment.preference === 'bank_account') {
    const bankVal = validateBankDetails(
      payment.bankDetails.accountName,
      payment.bankDetails.bsb,
      payment.bankDetails.accountNumber
    );
    if (bankVal.isComplete) {
      paymentStatus = 'complete';
      paymentIsBlocker = false;
    } else if (bankVal.bsb || bankVal.accountNumber || bankVal.accountName) {
      paymentStatus = 'in_progress';
      paymentExplanation = bankVal.errors[0] ?? 'Bank details are incomplete.';
      paymentAction = 'Complete BSB, account number, and account name.';
    } else {
      paymentExplanation = 'Bank account details are required.';
      paymentAction = 'Provide BSB, account number, and account name.';
    }
  } else if (payment.preference === 'alternative' && payment.alternativePaymentMethod) {
    paymentStatus = 'requires_review';
    paymentExplanation = 'Alternative payment method supplied — operator review required.';
    paymentAction = 'Review and confirm the payment method before export.';
    paymentIsBlocker = false;
  } else {
    paymentExplanation = 'Payment details are required.';
    paymentAction = 'Supplier must provide bank account or alternative payment details.';
  }

  items.push({
    id: 'payment_details',
    label: 'Payment details',
    status: paymentStatus,
    explanation: paymentExplanation,
    action: paymentAction,
    isBlocker: paymentIsBlocker,
  });

  /* 3. ABN */
  const abnVal = validateABN(abn.abn, abn.abnNotApplicable);
  let abnStatus: OnboardingChecklistStatus = 'not_started';
  let abnExplanation: string | null = null;
  let abnAction: string | null = null;
  let abnIsBlocker = true;

  if (abn.abnNotApplicable) {
    abnStatus = 'requires_review';
    abnExplanation = 'Supplier has declared ABN is not applicable — manual review required.';
    abnAction = 'Verify the supplier is genuinely exempt before exporting to Xero.';
    abnIsBlocker = false;
  } else if (abnVal.isValid) {
    abnStatus = 'complete';
    abnIsBlocker = false;
  } else if (abn.abn) {
    abnStatus = 'in_progress';
    abnExplanation = abnVal.errorMessage ?? 'ABN is invalid.';
    abnAction = 'Supplier must correct their ABN.';
  } else {
    abnExplanation = 'ABN is required for invoicing.';
    abnAction = 'Supplier must provide their ABN.';
  }

  items.push({
    id: 'abn',
    label: 'ABN',
    status: abnStatus,
    explanation: abnExplanation,
    action: abnAction,
    isBlocker: abnIsBlocker,
  });

  /* 4. GST */
  let gstStatus: OnboardingChecklistStatus = 'not_started';
  let gstExplanation: string | null = null;
  let gstAction: string | null = null;
  let gstIsBlocker = true;

  if (gst.gstStatus === 'yes' || gst.gstStatus === 'no') {
    gstStatus = 'complete';
    gstIsBlocker = false;
  } else if (gst.gstStatus === 'not_applicable') {
    gstStatus = 'requires_review';
    gstExplanation = 'GST declared as not applicable — operator review required.';
    gstAction = 'Verify GST status before exporting to Xero.';
    gstIsBlocker = false;
  } else {
    gstExplanation = 'Supplier must confirm their GST registration status.';
    gstAction = 'Supplier must indicate whether they are registered for GST.';
  }

  items.push({
    id: 'gst_status',
    label: 'GST status',
    status: gstStatus,
    explanation: gstExplanation,
    action: gstAction,
    isBlocker: gstIsBlocker,
  });

  /* 5. Supplier submission */
  const submitted = Boolean(submission.submittedAt && submission.declarationAccepted);
  items.push({
    id: 'declaration',
    label: 'Declaration submitted',
    status: submitted ? 'complete' : 'not_started',
    explanation: submitted ? null : 'Supplier must accept the declaration and submit.',
    action: submitted ? null : 'Supplier must confirm their details are accurate and submit.',
    isBlocker: !submitted,
  });

  /* 6. Operator approval */
  const approved = Boolean(operator.approvedAt);
  items.push({
    id: 'operator_approval',
    label: 'Operator approved',
    status: approved ? 'complete' : submitted ? 'in_progress' : 'not_started',
    explanation: approved ? null : submitted ? 'Review supplier details and approve for Xero export.' : 'Waiting for supplier to complete onboarding.',
    action: approved ? null : submitted ? 'Review and approve supplier details.' : null,
    isBlocker: !approved,
  });

  return items;
}

/* ─── Timeline events ───────────────────────────────────────────────────── */

function deriveTimelineEvents(
  input: SupplierOnboardingInput,
  stage: SupplierOnboardingStage
): SupplierOnboardingTimelineEvent[] {
  const { projectId, participant, agreement } = input;
  const events: SupplierOnboardingTimelineEvent[] = [];

  if (agreement.approved) {
    events.push({
      id: `${projectId}:${participant.id}:invoice_generated`,
      projectId,
      participantId: participant.id,
      type: 'supplier_invoice_generated',
      title: 'Supplier invoice generated',
      description: `Draft invoice generated for ${participant.name} from the approved agreement.`,
      commercialImpact: 'Invoice ready for supplier review. Settlement preparation is underway.',
      occurredAt: agreement.approvedAt ?? new Date().toISOString(),
    });
  }

  if (input.abn.abnNotApplicable) {
    events.push({
      id: `${projectId}:${participant.id}:abn_manual_review`,
      projectId,
      participantId: participant.id,
      type: 'supplier_abn_manual_review',
      title: 'ABN manual review required',
      description: `${participant.name} has declared ABN is not applicable to their situation.`,
      commercialImpact: 'Operator must review ABN exemption before exporting to Xero.',
      occurredAt: input.submission.submittedAt ?? new Date().toISOString(),
    });
  } else if (validateABN(input.abn.abn).isValid) {
    events.push({
      id: `${projectId}:${participant.id}:abn_verified`,
      projectId,
      participantId: participant.id,
      type: 'supplier_abn_verified',
      title: 'ABN verified',
      description: `${participant.name}'s ABN has been validated.`,
      commercialImpact: 'ABN confirmed — invoice is eligible for Xero export.',
      occurredAt: input.submission.submittedAt ?? new Date().toISOString(),
    });
  }

  if (input.gst.gstStatus !== 'pending') {
    events.push({
      id: `${projectId}:${participant.id}:gst_confirmed`,
      projectId,
      participantId: participant.id,
      type: 'supplier_gst_confirmed',
      title: 'GST status confirmed',
      description:
        input.gst.gstStatus === 'yes'
          ? `${participant.name} is registered for GST — invoice updated to include GST.`
          : input.gst.gstStatus === 'no'
          ? `${participant.name} is not registered for GST — invoice is ex-GST.`
          : `${participant.name} has indicated GST is not applicable.`,
      commercialImpact: 'Invoice GST calculation is finalised.',
      occurredAt: input.submission.submittedAt ?? new Date().toISOString(),
    });
  }

  if (
    input.payment.preference === 'alternative' &&
    input.payment.alternativePaymentMethod
  ) {
    events.push({
      id: `${projectId}:${participant.id}:alt_payment`,
      projectId,
      participantId: participant.id,
      type: 'supplier_alternative_payment_supplied',
      title: 'Alternative payment method supplied',
      description: `${participant.name} has requested payment via ${input.payment.alternativePaymentMethod}.`,
      commercialImpact: 'Operator must arrange payment manually outside of the normal bank transfer process.',
      occurredAt: input.submission.submittedAt ?? new Date().toISOString(),
    });
  }

  if (stage === 'submitted' || stage === 'operator_approved' || stage === 'xero_exported') {
    events.push({
      id: `${projectId}:${participant.id}:onboarding_completed`,
      projectId,
      participantId: participant.id,
      type: 'supplier_onboarding_completed',
      title: 'Supplier onboarding complete',
      description: `${participant.name} has completed supplier onboarding.`,
      commercialImpact: 'All supplier details confirmed. Operator can now review and approve for Xero.',
      occurredAt: input.submission.submittedAt ?? new Date().toISOString(),
    });
  }

  if (input.operator.approvedAt) {
    events.push({
      id: `${projectId}:${participant.id}:invoice_approved`,
      projectId,
      participantId: participant.id,
      type: 'supplier_invoice_approved',
      title: 'Invoice approved by operator',
      description: `Invoice for ${participant.name} has been reviewed and approved.`,
      commercialImpact: 'Invoice is cleared for Xero export.',
      occurredAt: input.operator.approvedAt,
    });
  }

  if (input.operator.xeroExportedAt) {
    events.push({
      id: `${projectId}:${participant.id}:xero_exported`,
      projectId,
      participantId: participant.id,
      type: 'supplier_invoice_exported_to_xero',
      title: 'Invoice exported to Xero',
      description: `${participant.name}'s invoice has been pushed to Xero.`,
      commercialImpact: 'Bill recorded in the accounting system. Payment can now be processed.',
      occurredAt: input.operator.xeroExportedAt,
    });
  }

  return events;
}

/* ─── Main engine ───────────────────────────────────────────────────────── */

/**
 * Derive the complete onboarding status for one supplier.
 *
 * PURE FUNCTION — deterministic, no network calls.
 * This is the only function that calculates supplier onboarding readiness.
 * No component, hook, or page may replicate this logic.
 */
export function deriveSupplierOnboardingStatus(
  input: SupplierOnboardingInput
): SupplierOnboardingStatus {
  const stage = deriveStage(input);
  const stageLabel = STAGE_LABELS[stage];
  const draftInvoice = generateDraftInvoice(input, input.currentDate);
  const abnValidation = validateABN(input.abn.abn, input.abn.abnNotApplicable);
  const bankValidation =
    input.payment.preference === 'bank_account'
      ? validateBankDetails(
          input.payment.bankDetails.accountName,
          input.payment.bankDetails.bsb,
          input.payment.bankDetails.accountNumber
        )
      : { accountName: null, bsb: null, accountNumber: null, bsbValid: false, accountNumberValid: false, accountNameValid: false, isComplete: false, errors: [] };

  const checklist = deriveChecklist(input);
  const blockers = checklist.filter((i) => i.isBlocker);
  const onboardingComplete = !checklist.some((i) => i.isBlocker);
  const readyForXeroExport = Boolean(input.operator.approvedAt) && onboardingComplete;

  const requiresManualReview =
    checklist.some((i) => i.status === 'requires_review') ||
    input.abn.abnNotApplicable ||
    input.payment.preference === 'alternative';

  const xeroReadiness: XeroReadiness = {
    readyForExport: readyForXeroExport,
    checklist,
    primaryBlocker: blockers[0]?.explanation ?? null,
  };

  const nextAction = deriveNextAction(stage, checklist, input);
  const timelineEvents = deriveTimelineEvents(input, stage);

  return {
    participantId: input.participant.id,
    participantName: input.participant.name,
    participantRole: input.participant.role,
    stage,
    stageLabel,
    draftInvoice,
    abnValidation,
    bankValidation,
    checklist,
    onboardingComplete,
    readyForXeroExport,
    xeroReadiness,
    nextAction,
    requiresManualReview,
    timelineEvents,
  };
}

function deriveNextAction(
  stage: SupplierOnboardingStage,
  checklist: OnboardingChecklistItem[],
  input: SupplierOnboardingInput
): string | null {
  switch (stage) {
    case 'not_started':
      return 'Waiting for participant to approve the agreement.';
    case 'invoice_generated':
      return `Send ${input.participant.name} the supplier onboarding link.`;
    case 'in_progress': {
      const blocker = checklist.find((i) => i.isBlocker && i.status !== 'complete');
      return blocker?.action ?? `Ask ${input.participant.name} to complete their supplier details.`;
    }
    case 'submitted':
      return `Review ${input.participant.name}'s supplier details and approve for Xero.`;
    case 'operator_approved':
      return `Export ${input.participant.name}'s invoice to Xero.`;
    case 'xero_exported':
      return null;
  }
}

/* ─── Workspace-level summary ───────────────────────────────────────────── */

/**
 * Aggregate onboarding status across all participants in a workspace.
 *
 * PURE FUNCTION — calls deriveSupplierOnboardingStatus() internally.
 * Provides the dashboard summary and operator queue.
 */
export function deriveWorkspaceOnboardingStatus(
  inputs: SupplierOnboardingInput[]
): WorkspaceOnboardingStatus {
  const participants = inputs.map(deriveSupplierOnboardingStatus);

  const completedCount = participants.filter(
    (p) => p.stage === 'xero_exported' || p.stage === 'operator_approved'
  ).length;
  const inProgressCount = participants.filter(
    (p) => p.stage === 'in_progress' || p.stage === 'submitted'
  ).length;
  const notStartedCount = participants.filter(
    (p) => p.stage === 'not_started' || p.stage === 'invoice_generated'
  ).length;
  const requiresReviewCount = participants.filter((p) => p.requiresManualReview).length;
  const readyForExportCount = participants.filter((p) => p.readyForXeroExport).length;

  const total = participants.length;
  const summary =
    completedCount === total
      ? `All ${total} supplier${total !== 1 ? 's have' : ' has'} completed onboarding.`
      : `${completedCount} / ${total} supplier${total !== 1 ? 's have' : ' has'} completed onboarding.`;

  const primaryCta = derivePrimaryCta(participants, completedCount, total);

  const pendingSuppliers = participants
    .filter((p) => p.stage !== 'xero_exported')
    .map((p) => ({
      participantName: p.participantName,
      primaryNeed: derivePrimaryNeed(p),
    }));

  return {
    participants,
    totalCount: total,
    completedCount,
    inProgressCount,
    notStartedCount,
    requiresReviewCount,
    readyForExportCount,
    summary,
    primaryCta,
    pendingSuppliers,
  };
}

function derivePrimaryNeed(status: SupplierOnboardingStatus): string {
  if (status.stage === 'submitted') return 'Awaiting operator review';
  if (status.stage === 'operator_approved') return 'Ready for Xero export';
  const firstBlocker = status.checklist.find(
    (i) => i.isBlocker && i.status !== 'complete'
  );
  return firstBlocker?.explanation ?? 'Setup incomplete';
}

function derivePrimaryCta(
  participants: SupplierOnboardingStatus[],
  completedCount: number,
  total: number
): string | null {
  if (completedCount === total) return null;
  const awaiting = participants.filter((p) => p.stage === 'submitted');
  if (awaiting.length > 0) return `Review ${awaiting.length} supplier${awaiting.length > 1 ? 's' : ''} awaiting approval`;
  const ready = participants.filter((p) => p.stage === 'operator_approved');
  if (ready.length > 0) return `Export ${ready.length} approved invoice${ready.length > 1 ? 's' : ''} to Xero`;
  return 'Continue supplier onboarding';
}

/* ─── Provvy narrative ──────────────────────────────────────────────────── */

/**
 * Build a Provvy-ready supplier onboarding narrative.
 *
 * Derives entirely from deriveWorkspaceOnboardingStatus() — no duplicated reasoning.
 * Ends with exactly one recommended action.
 */
export function buildSupplierOnboardingNarrative(workspace: WorkspaceOnboardingStatus): string {
  const lines: string[] = [];

  lines.push(workspace.summary);

  if (workspace.requiresReviewCount > 0) {
    lines.push('');
    lines.push(`${workspace.requiresReviewCount} supplier${workspace.requiresReviewCount > 1 ? 's require' : ' requires'} manual review before Xero export.`);
  }

  if (workspace.pendingSuppliers.length > 0) {
    lines.push('');
    workspace.pendingSuppliers.slice(0, 3).forEach((s) => {
      lines.push(`${s.participantName}: ${s.primaryNeed}`);
    });
  }

  if (workspace.primaryCta) {
    lines.push('');
    lines.push(`Recommended next action: ${workspace.primaryCta}`);
  }

  return lines.join('\n');
}
