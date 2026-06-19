/**
 * Settlement Readiness Engine
 *
 * The single canonical engine that determines whether a participant is actually
 * ready to be settled — everything that must be true before money can safely
 * leave the business.
 *
 * This is NOT settlement execution. It is settlement preparation.
 *
 * Design rules:
 *   - `deriveSettlementReadiness()` is the only readiness calculation. No page or
 *     component may calculate readiness independently.
 *   - Pure function — no network calls, no side effects, deterministic.
 *   - Same inputs → same output, always.
 *   - Operator language only. No accounting or technical jargon.
 *   - One canonical checklist. One canonical blocker list.
 *
 * Architecture:
 *   Commercial Graph
 *       ↓
 *   deriveSettlementReadiness()
 *       ↓
 *   Settlement Checklist
 *   Participant Cards
 *   Dashboard
 *   Provvy
 *   Commercial Timeline
 *   Workflow
 */

import { deriveInvoiceState, isInvoiceAtOrAfter } from '@/lib/commercial/invoice-lifecycle';
import type { InvoiceLifecycleState, InvoiceDeriveInput } from '@/lib/commercial/invoice-lifecycle';

/* ─── Input types ─────────────────────────────────────────────────────────── */

export type ParticipantAgreementDetails = {
  /** True when the participant has approved their commercial agreement. */
  approved: boolean;
  /** ISO timestamp when the participant approved. */
  approvedAt?: string | null;
  /** True when an agreement document has been generated and shared. */
  agreementGenerated?: boolean;
};

export type ParticipantInvoiceDetails = InvoiceDeriveInput & {
  /** Invoice number provided by the participant. */
  invoiceNumber?: string | null;
  /** Supplier / participant name on the invoice. */
  supplierName?: string | null;
  /** ISO date on the invoice. */
  invoiceDate?: string | null;
  /** ISO due date on the invoice. */
  dueDate?: string | null;
  /** Invoice amount as submitted by the participant. */
  invoiceAmount?: number | null;
  /** Currency of the invoice. */
  currency?: string;
};

export type ParticipantTaxDetails = {
  /** Australian Business Number (11 digits without spaces). */
  abn?: string | null;
  /** True when the participant is registered for GST. */
  gstRegistered?: boolean | null;
  /** Registered business name for GST/ABN purposes. */
  businessName?: string | null;
  /** True when ABN has been verified (via ABN Lookup or manual verification). */
  abnVerified?: boolean;
};

export type ParticipantBankDetails = {
  /** Bank-State-Branch (6 digits). */
  bsb?: string | null;
  /** Bank account number (6-9 digits). */
  accountNumber?: string | null;
  /** Name on the bank account. */
  accountName?: string | null;
  /** Bank / financial institution name. */
  bankName?: string | null;
  /** Payment reference to include on the transfer. */
  paymentReference?: string | null;
};

export type ParticipantFundingDetails = {
  /** Funding/obligation status for this participant. */
  status: 'unfunded' | 'partially_funded' | 'funded' | 'cleared' | 'paid';
  /** Funded amount. */
  amount?: number;
  /** Total obligation amount. */
  obligationAmount?: number;
  /** Currency. */
  currency?: string;
};

export type ParticipantAccountingDetails = {
  /** Whether the invoice has been exported to Xero/accounting system. */
  xeroStatus: 'not_required' | 'pending' | 'exported';
  /** ISO timestamp when exported. */
  exportedAt?: string | null;
};

export type ParticipantObligationDetails = {
  /** Obligation amount in the workspace currency. */
  amount: number;
  currency: string;
  /** Obligation type — determines which checklist items apply. */
  type: 'fixed_fee' | 'revenue_share' | 'conditional' | 'unpaid_internal';
};

export type SettlementReadinessInput = {
  /** Participant identity. */
  participant: {
    id: string;
    name: string;
    role: string;
    email?: string | null;
  };
  /** Agreement approval status. */
  agreement: ParticipantAgreementDetails;
  /** Invoice details. */
  invoice: ParticipantInvoiceDetails;
  /** Tax / ABN details. */
  taxDetails: ParticipantTaxDetails;
  /** Bank account details. */
  bankDetails: ParticipantBankDetails;
  /** Funding / obligation status. */
  funding: ParticipantFundingDetails;
  /** Accounting export status. */
  accounting: ParticipantAccountingDetails;
  /** The commercial obligation this participant holds. */
  obligation: ParticipantObligationDetails;
  /**
   * The workspace-level currency (ISO code).
   * Used when participant-level currency is not specified.
   */
  currency?: string;
};

/* ─── Output types ───────────────────────────────────────────────────────────── */

export type ChecklistItemStatus = 'complete' | 'in_progress' | 'missing';

export type SettlementChecklistItem = {
  /** Stable ID for this checklist item. */
  id: string;
  /** Operator-facing label. e.g. "Tax Information" */
  label: string;
  /** Current status. */
  status: ChecklistItemStatus;
  /** One-sentence explanation when not complete. */
  explanation: string | null;
  /** The exact action to take to complete this item. */
  action: string | null;
  /** True when this item is blocking settlement. */
  isBlocker: boolean;
};

export type SettlementBlocker = {
  /** What's missing. Operator-language title. */
  title: string;
  /** One sentence explaining what's needed. */
  explanation: string;
  /** Commercial consequence if not resolved. */
  consequence: string;
  /** Exactly what to do. */
  action: string;
  /** Severity. */
  severity: 'critical' | 'high' | 'medium';
};

export type SettlementReadinessResult = {
  /** Unique identifier for this participant. */
  participantId: string;
  /** Display name. */
  participantName: string;

  /** 0–100 readiness score. */
  readinessScore: number;
  /** True when ALL checklist items are complete and settlement can proceed. */
  readyToSettle: boolean;

  /** The canonical settlement checklist for this participant. */
  checklist: SettlementChecklistItem[];

  /** Items actively blocking settlement (subset of checklist). */
  blockers: SettlementBlocker[];

  /** The single most important next action. null when ready. */
  nextAction: string | null;

  /** Short list of what's still missing. */
  missingRequirements: string[];

  /** Current invoice lifecycle state. */
  invoiceState: InvoiceLifecycleState;

  /** Validation results (non-blocking informational flags). */
  validation: SettlementValidation;

  /** True when participant type does not require an invoice. */
  invoiceNotRequired: boolean;
};

export type SettlementValidation = {
  abnValid: boolean;
  abnFormat: string | null;
  gstConsistent: boolean;
  bankDetailsComplete: boolean;
  bsbValid: boolean;
  accountNumberValid: boolean;
  invoiceAmountMatchesObligation: boolean | null;
};

/* ─── Workspace-level summary ─────────────────────────────────────────────── */

export type WorkspaceSettlementReadiness = {
  /** Results for each participant. */
  participants: SettlementReadinessResult[];
  /** Participants where readyToSettle === true. */
  readyCount: number;
  /** Participants where readyToSettle === false. */
  blockedCount: number;
  /** Average readiness score across all participants. */
  averageScore: number;
  /** The most common blocker across all participants. */
  primaryBottleneck: string | null;
  /** Overall readiness percentage (readyCount / total). */
  overallReadiness: number;
  /** Can settlement batch be released? True when ALL participants are ready. */
  canReleaseBatch: boolean;
  /** Provvy-ready narrative for "Who can I pay today?" */
  provvyNarrative: string;
};

/* ─── Core engine ─────────────────────────────────────────────────────────── */

/**
 * The canonical Settlement Readiness Engine.
 *
 * PURE FUNCTION — no side effects, no network calls, deterministic.
 *
 * Feed it everything known about a participant's commercial status.
 * Receive the complete settlement readiness picture.
 *
 * This is the only function permitted to calculate settlement readiness.
 * All UI surfaces must consume this result.
 */
export function deriveSettlementReadiness(
  input: SettlementReadinessInput
): SettlementReadinessResult {
  const { participant, agreement, invoice, taxDetails, bankDetails, funding, accounting, obligation } = input;

  /* ── Derive invoice state ── */
  const invoiceState = deriveInvoiceState(invoice);
  const invoiceNotRequired = obligation.type === 'unpaid_internal' || invoice.invoiceNotRequired === true;

  /* ── Validation ── */
  const validation = runValidation(taxDetails, bankDetails, invoice, obligation);

  /* ── Build checklist ── */
  const checklist = buildChecklist({
    agreement,
    invoiceState,
    invoiceNotRequired,
    taxDetails,
    bankDetails,
    funding,
    accounting,
    validation,
  });

  /* ── Derive blockers ── */
  const blockers = deriveBlockers(checklist, funding, invoiceState, invoiceNotRequired);

  /* ── Calculate readiness score ── */
  const readinessScore = calculateReadinessScore(checklist);

  /* ── Determine if ready ── */
  const readyToSettle =
    checklist.every((item) => item.status === 'complete') &&
    readinessScore === 100;

  /* ── Missing requirements ── */
  const missingRequirements = checklist
    .filter((item) => item.status !== 'complete' && item.explanation)
    .map((item) => item.explanation as string);

  /* ── Next action ── */
  const nextAction = readyToSettle
    ? null
    : blockers[0]?.action ??
      checklist.find((item) => item.status !== 'complete')?.action ??
      null;

  return {
    participantId: participant.id,
    participantName: participant.name,
    readinessScore,
    readyToSettle,
    checklist,
    blockers,
    nextAction,
    missingRequirements,
    invoiceState,
    validation,
    invoiceNotRequired,
  };
}

/* ─── Checklist builder ──────────────────────────────────────────────────── */

type ChecklistInput = {
  agreement: ParticipantAgreementDetails;
  invoiceState: InvoiceLifecycleState;
  invoiceNotRequired: boolean;
  taxDetails: ParticipantTaxDetails;
  bankDetails: ParticipantBankDetails;
  funding: ParticipantFundingDetails;
  accounting: ParticipantAccountingDetails;
  validation: SettlementValidation;
};

function buildChecklist(input: ChecklistInput): SettlementChecklistItem[] {
  const { agreement, invoiceState, invoiceNotRequired, taxDetails, bankDetails, funding, accounting, validation } = input;

  return [
    /* 1. Commercial Agreement */
    buildItem({
      id: 'commercial_agreement',
      label: 'Commercial Agreement',
      complete: agreement.agreementGenerated === true,
      inProgress: false,
      explanation: agreement.agreementGenerated
        ? null
        : 'An agreement document has not been generated for this participant.',
      action: agreement.agreementGenerated ? null : 'Generate the commercial agreement document.',
      isBlocker: !agreement.agreementGenerated,
    }),

    /* 2. Participant Approval */
    buildItem({
      id: 'participant_approval',
      label: 'Participant Approval',
      complete: agreement.approved,
      inProgress: agreement.agreementGenerated && !agreement.approved,
      explanation: agreement.approved
        ? null
        : agreement.agreementGenerated
          ? 'Waiting for the participant to approve their commercial terms.'
          : 'Agreement must be generated before approval can be requested.',
      action: agreement.approved
        ? null
        : agreement.agreementGenerated
          ? 'Send a reminder to the participant to approve their agreement.'
          : 'Generate the agreement to proceed.',
      isBlocker: !agreement.approved,
    }),

    /* 3. Payment Details */
    buildItem({
      id: 'payment_details',
      label: 'Payment Details',
      complete: validation.bankDetailsComplete && validation.bsbValid && validation.accountNumberValid,
      inProgress: Boolean(bankDetails.bsb || bankDetails.accountNumber) && !validation.bankDetailsComplete,
      explanation: validation.bankDetailsComplete
        ? null
        : !bankDetails.bsb && !bankDetails.accountNumber
          ? 'Bank account details have not been provided.'
          : !validation.bsbValid
            ? `BSB ${bankDetails.bsb ?? ''} is not valid. BSB must be 6 digits.`
            : !validation.accountNumberValid
              ? 'Account number must be between 6 and 9 digits.'
              : 'Bank account details are incomplete.',
      action: validation.bankDetailsComplete
        ? null
        : 'Request bank account details from the participant.',
      isBlocker: !validation.bankDetailsComplete,
    }),

    /* 4. Tax Information */
    buildItem({
      id: 'tax_information',
      label: 'Tax Information',
      complete: validation.abnValid && taxDetails.gstRegistered !== undefined,
      inProgress: Boolean(taxDetails.abn) && (!validation.abnValid || taxDetails.gstRegistered === undefined),
      explanation: validation.abnValid && taxDetails.gstRegistered !== undefined
        ? null
        : !taxDetails.abn
          ? 'ABN has not been provided.'
          : !validation.abnValid
            ? `ABN ${taxDetails.abn} is not valid. Check the number and try again.`
            : 'GST registration status has not been confirmed.',
      action: validation.abnValid && taxDetails.gstRegistered !== undefined
        ? null
        : !taxDetails.abn
          ? 'Request ABN from the participant.'
          : !validation.abnValid
            ? 'Correct the ABN and re-submit.'
            : 'Confirm whether the participant is registered for GST.',
      isBlocker: !validation.abnValid || taxDetails.gstRegistered === undefined,
    }),

    /* 5. Invoice */
    buildItem({
      id: 'invoice',
      label: 'Invoice',
      complete: invoiceNotRequired || isInvoiceAtOrAfter(invoiceState, 'verified'),
      inProgress: !invoiceNotRequired &&
        (invoiceState === 'requested' || invoiceState === 'received'),
      explanation: invoiceNotRequired
        ? null
        : isInvoiceAtOrAfter(invoiceState, 'verified')
          ? null
          : invoiceState === 'required'
            ? 'An invoice is required but has not been requested yet.'
            : invoiceState === 'requested'
              ? 'Invoice has been requested. Waiting for the participant to submit.'
              : invoiceState === 'received'
                ? 'Invoice has been received and is awaiting verification.'
                : null,
      action: invoiceNotRequired || isInvoiceAtOrAfter(invoiceState, 'verified')
        ? null
        : invoiceState === 'required'
          ? 'Request an invoice from the participant.'
          : invoiceState === 'requested'
            ? 'Follow up with the participant to submit their invoice.'
            : invoiceState === 'received'
              ? 'Verify the received invoice.'
              : null,
      // An unverified invoice blocks settlement; an in-progress request does not block (yet)
      isBlocker: !invoiceNotRequired && invoiceState === 'required',
    }),

    /* 6. Funding Confirmed */
    buildItem({
      id: 'funding_confirmed',
      label: 'Funding Confirmed',
      complete: funding.status === 'funded' || funding.status === 'cleared' || funding.status === 'paid',
      inProgress: funding.status === 'partially_funded',
      explanation: funding.status === 'funded' || funding.status === 'cleared' || funding.status === 'paid'
        ? null
        : funding.status === 'partially_funded'
          ? 'Funding is partially confirmed. Full funding is required before payment can be released.'
          : 'Funding has not been confirmed for this participant.',
      action: funding.status === 'funded' || funding.status === 'cleared' || funding.status === 'paid'
        ? null
        : funding.status === 'partially_funded'
          ? 'Upload additional payment evidence to confirm full funding.'
          : 'Upload funding evidence to confirm this obligation is funded.',
      isBlocker: funding.status !== 'funded' && funding.status !== 'cleared' && funding.status !== 'paid',
    }),

    /* 7. Accounting Export */
    buildItem({
      id: 'accounting_export',
      label: 'Accounting Export',
      complete: accounting.xeroStatus === 'exported' || accounting.xeroStatus === 'not_required',
      inProgress: accounting.xeroStatus === 'pending',
      explanation: accounting.xeroStatus === 'exported' || accounting.xeroStatus === 'not_required'
        ? null
        : 'Invoice has not been exported to your accounting system.',
      action: accounting.xeroStatus === 'exported' || accounting.xeroStatus === 'not_required'
        ? null
        : 'Export the invoice to Xero.',
      isBlocker: accounting.xeroStatus !== 'exported' && accounting.xeroStatus !== 'not_required',
    }),

    /* 8. Ready for Settlement */
    buildItem({
      id: 'ready_for_settlement',
      label: 'Ready for Settlement',
      complete: false, // derived last — recalculated below
      inProgress: false,
      explanation: 'Complete all items above to enable payment release.',
      action: 'Resolve all outstanding items.',
      isBlocker: false,
    }),
  ].map((item, _idx, arr) => {
    // Recalculate "Ready for Settlement" from all prior items
    if (item.id === 'ready_for_settlement') {
      const allPriorComplete = arr
        .filter((i) => i.id !== 'ready_for_settlement')
        .every((i) => i.status === 'complete');
      return {
        ...item,
        status: allPriorComplete ? 'complete' as ChecklistItemStatus : 'missing' as ChecklistItemStatus,
        explanation: allPriorComplete ? null : 'Complete all items above to enable payment release.',
        action: allPriorComplete ? null : null,
        isBlocker: false,
      };
    }
    return item;
  });
}

function buildItem(opts: {
  id: string;
  label: string;
  complete: boolean;
  inProgress: boolean;
  explanation: string | null;
  action: string | null;
  isBlocker: boolean;
}): SettlementChecklistItem {
  const status: ChecklistItemStatus = opts.complete
    ? 'complete'
    : opts.inProgress
      ? 'in_progress'
      : 'missing';

  return {
    id: opts.id,
    label: opts.label,
    status,
    explanation: opts.complete ? null : opts.explanation,
    action: opts.complete ? null : opts.action,
    isBlocker: !opts.complete && opts.isBlocker,
  };
}

/* ─── Blocker derivation ─────────────────────────────────────────────────── */

function deriveBlockers(
  checklist: SettlementChecklistItem[],
  funding: ParticipantFundingDetails,
  invoiceState: InvoiceLifecycleState,
  invoiceNotRequired: boolean
): SettlementBlocker[] {
  const blockers: SettlementBlocker[] = [];

  for (const item of checklist) {
    if (!item.isBlocker || item.status === 'complete') continue;

    const blocker = checklistItemToBlocker(item, funding, invoiceState, invoiceNotRequired);
    if (blocker) blockers.push(blocker);
  }

  return blockers;
}

function checklistItemToBlocker(
  item: SettlementChecklistItem,
  funding: ParticipantFundingDetails,
  invoiceState: InvoiceLifecycleState,
  invoiceNotRequired: boolean
): SettlementBlocker | null {
  switch (item.id) {
    case 'commercial_agreement':
      return {
        title: 'Agreement not generated',
        explanation: 'A commercial agreement document has not been generated for this participant.',
        consequence: 'Participant cannot approve their terms and settlement cannot proceed.',
        action: 'Generate the commercial agreement document.',
        severity: 'critical',
      };

    case 'participant_approval':
      return {
        title: 'Participant has not approved',
        explanation: 'The participant has not approved their commercial terms.',
        consequence: 'Payment cannot be released without participant approval.',
        action: 'Send a reminder to the participant to approve their agreement.',
        severity: 'critical',
      };

    case 'payment_details':
      return {
        title: 'Bank account details missing',
        explanation: item.explanation ?? 'Bank account details are required to process payment.',
        consequence: 'Payment cannot be transferred without valid bank details.',
        action: 'Request bank account details from the participant.',
        severity: 'critical',
      };

    case 'tax_information':
      return {
        title: 'Tax details incomplete',
        explanation: item.explanation ?? 'ABN or GST registration details are missing.',
        consequence: 'Payment may need to withhold tax without a valid ABN.',
        action: item.action ?? 'Request tax details from the participant.',
        severity: 'high',
      };

    case 'invoice':
      return invoiceState === 'received'
        ? {
            title: 'Invoice awaiting verification',
            explanation: 'An invoice has been received but has not been verified.',
            consequence: 'Payment cannot be released until the invoice is verified.',
            action: 'Review and verify the received invoice.',
            severity: 'high',
          }
        : invoiceState === 'requested'
          ? {
              title: 'Invoice not yet submitted',
              explanation: 'The invoice has been requested but not yet received.',
              consequence: 'Payment is blocked until the invoice is received.',
              action: 'Follow up with the participant to submit their invoice.',
              severity: 'high',
            }
          : {
              title: 'Invoice not requested',
              explanation: 'An invoice is required but has not been requested from the participant.',
              consequence: 'Settlement cannot proceed without an invoice.',
              action: 'Request an invoice from the participant.',
              severity: 'critical',
            };

    case 'funding_confirmed':
      return {
        title: funding.status === 'partially_funded'
          ? 'Funding partially confirmed'
          : 'Funding not confirmed',
        explanation: funding.status === 'partially_funded'
          ? 'Funding is only partially confirmed for this participant.'
          : 'The payment obligation has not been funded by confirmed revenue.',
        consequence: 'Payment cannot be released without confirmed funding.',
        action: 'Upload payment evidence to confirm funding.',
        severity: 'critical',
      };

    case 'accounting_export':
      return {
        title: 'Invoice not exported to Xero',
        explanation: 'The invoice must be exported to your accounting system before payment can be released.',
        consequence: 'Payment release may be blocked by accounting workflow requirements.',
        action: 'Export the invoice to Xero.',
        severity: 'high',
      };

    default:
      return null;
  }
}

/* ─── Readiness score calculation ─────────────────────────────────────────── */

const CHECKLIST_WEIGHTS: Record<string, number> = {
  commercial_agreement: 0.10,
  participant_approval: 0.20,
  payment_details: 0.15,
  tax_information: 0.10,
  invoice: 0.20,
  funding_confirmed: 0.20,
  accounting_export: 0.05,
  ready_for_settlement: 0.00, // Derived — not independently weighted
};

function calculateReadinessScore(checklist: SettlementChecklistItem[]): number {
  let totalWeight = 0;
  let completedWeight = 0;

  for (const item of checklist) {
    const weight = CHECKLIST_WEIGHTS[item.id] ?? 0;
    totalWeight += weight;
    if (item.status === 'complete') {
      completedWeight += weight;
    } else if (item.status === 'in_progress') {
      completedWeight += weight * 0.4; // Partial credit for in-progress items
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((completedWeight / totalWeight) * 100);
}

/* ─── Validation ───────────────────────────────────────────────────────────── */

function runValidation(
  taxDetails: ParticipantTaxDetails,
  bankDetails: ParticipantBankDetails,
  invoice: ParticipantInvoiceDetails,
  obligation: ParticipantObligationDetails
): SettlementValidation {
  const abn = taxDetails.abn?.replace(/\s/g, '') ?? '';
  const abnValid = abn.length > 0 && validateAbn(abn);
  const abnFormat = abn.length > 0 ? formatAbn(abn) : null;

  const bsb = bankDetails.bsb?.replace(/\D/g, '') ?? '';
  const accountNumber = bankDetails.accountNumber?.replace(/\D/g, '') ?? '';

  const bsbValid = /^\d{6}$/.test(bsb);
  const accountNumberValid = /^\d{6,9}$/.test(accountNumber);

  const bankDetailsComplete =
    bsbValid &&
    accountNumberValid &&
    Boolean(bankDetails.accountName?.trim());

  const gstConsistent =
    !taxDetails.gstRegistered || abnValid;

  // Check invoice amount matches obligation (within 1% tolerance for rounding)
  let invoiceAmountMatchesObligation: boolean | null = null;
  if (invoice.invoiceAmount != null && obligation.amount > 0) {
    const ratio = Math.abs(invoice.invoiceAmount - obligation.amount) / obligation.amount;
    invoiceAmountMatchesObligation = ratio <= 0.01;
  }

  return {
    abnValid,
    abnFormat,
    gstConsistent,
    bankDetailsComplete,
    bsbValid,
    accountNumberValid,
    invoiceAmountMatchesObligation,
  };
}

/* ─── ABN validation ──────────────────────────────────────────────────────── */

/**
 * Validates an Australian Business Number using the ATO check digit algorithm.
 * Input must be 11 digits with no spaces.
 */
export function validateAbn(abn: string): boolean {
  const cleaned = abn.replace(/\s/g, '');
  if (!/^\d{11}$/.test(cleaned)) return false;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleaned.split('').map(Number);

  // Subtract 1 from the first digit
  digits[0] -= 1;

  // Calculate weighted sum
  const sum = digits.reduce((acc, digit, idx) => acc + digit * weights[idx], 0);

  return sum % 89 === 0;
}

/**
 * Formats an ABN as "XX XXX XXX XXX".
 */
export function formatAbn(abn: string): string {
  const cleaned = abn.replace(/\D/g, '');
  if (cleaned.length !== 11) return abn;
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 11)}`;
}

/* ─── Workspace-level aggregation ─────────────────────────────────────────── */

/**
 * Aggregate settlement readiness across all participants in a workspace.
 * Produces the workspace-level summary used by the dashboard widget.
 *
 * No independent calculations — consumes `deriveSettlementReadiness()` per participant.
 */
export function deriveWorkspaceSettlementReadiness(
  inputs: SettlementReadinessInput[]
): WorkspaceSettlementReadiness {
  if (inputs.length === 0) {
    return {
      participants: [],
      readyCount: 0,
      blockedCount: 0,
      averageScore: 0,
      primaryBottleneck: null,
      overallReadiness: 0,
      canReleaseBatch: false,
      provvyNarrative: 'No participants have been added yet.',
    };
  }

  const results = inputs.map(deriveSettlementReadiness);
  const readyCount = results.filter((r) => r.readyToSettle).length;
  const blockedCount = results.filter((r) => !r.readyToSettle).length;
  const averageScore =
    Math.round(results.reduce((s, r) => s + r.readinessScore, 0) / results.length);
  const overallReadiness = Math.round((readyCount / results.length) * 100);
  const canReleaseBatch = readyCount === results.length;

  // Find the most common blocker across all participants
  const blockerTitles = results.flatMap((r) => r.blockers.map((b) => b.title));
  const blockerCounts = new Map<string, number>();
  for (const title of blockerTitles) {
    blockerCounts.set(title, (blockerCounts.get(title) ?? 0) + 1);
  }
  const primaryBottleneck =
    blockerCounts.size > 0
      ? [...blockerCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

  const provvyNarrative = buildSettlementReadinessNarrative(results);

  return {
    participants: results,
    readyCount,
    blockedCount,
    averageScore,
    primaryBottleneck,
    overallReadiness,
    canReleaseBatch,
    provvyNarrative,
  };
}

/* ─── Provvy narrative ─────────────────────────────────────────────────────── */

/**
 * Build a Provvy-ready narrative for settlement readiness.
 * Answers: "Who can I pay today?" and "What is preventing settlement?"
 */
export function buildSettlementReadinessNarrative(
  results: SettlementReadinessResult[]
): string {
  if (results.length === 0) {
    return 'No participants have been added yet. Add participants to begin settlement preparation.';
  }

  const ready = results.filter((r) => r.readyToSettle);
  const blocked = results.filter((r) => !r.readyToSettle);
  const lines: string[] = [];

  if (ready.length > 0) {
    const names = ready.map((r) => r.participantName).join(', ');
    lines.push(`${ready.length === 1 ? `${names} is` : `${names} are`} ready for payment.`);
  }

  if (blocked.length > 0) {
    lines.push('');
    lines.push(
      `${blocked.length} participant${blocked.length > 1 ? 's are' : ' is'} not yet ready:`
    );
    for (const p of blocked) {
      const topBlocker = p.blockers[0];
      if (topBlocker) {
        lines.push(`  ${p.participantName}: ${topBlocker.title.toLowerCase()}.`);
      }
    }
  }

  // Find the most impactful next action
  const criticalBlocker = results
    .flatMap((r) => r.blockers)
    .find((b) => b.severity === 'critical');

  if (criticalBlocker) {
    lines.push('');
    lines.push(`Recommended next action: ${criticalBlocker.action}`);
  } else if (blocked.length > 0) {
    const nextAction = blocked[0]?.nextAction;
    if (nextAction) {
      lines.push('');
      lines.push(`Recommended next action: ${nextAction}`);
    }
  }

  return lines.join('\n');
}
