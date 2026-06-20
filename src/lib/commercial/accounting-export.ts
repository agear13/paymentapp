/**
 * Accounting Export Engine
 *
 * The single canonical engine that converts Commercial OS state into
 * accounting export records.
 *
 * Design rules:
 *   - `deriveAccountingExport()` is the ONLY permitted accounting export
 *     calculation. No UI, page, hook, or workflow may derive export data
 *     independently.
 *   - Pure functions — deterministic, no network calls, no side effects.
 *   - The Commercial Graph remains the single source of truth.
 *   - Accounting systems are downstream projections — never upstream sources.
 *   - No Xero SDK calls from this module. All provider calls flow through
 *     AccountingConnector.
 *   - Preview → Operator Approval → Export. Nothing exports automatically.
 *
 * Architecture:
 *   Commercial Graph
 *       ↓
 *   deriveAccountingExport()        ← THIS FILE
 *       ↓
 *   AccountingConnector (interface)
 *       ↓
 *   XeroConnector | MYOBConnector | ...
 *
 * Four exported functions:
 *   deriveAccountingExport()       — full export model per participant
 *   deriveAccountingExportPreview()— operator-facing preview (pre-approval)
 *   deriveAccountingSyncStatus()   — workspace-level sync dashboard
 *   buildAccountingNarrative()     — Provvy explanation
 */

import type { AccountingProvider, AccountingSyncStatus } from '@/lib/commercial/accounting-connector';
import { ACCOUNTING_PROVIDER_LABELS, SYNC_STATUS_LABELS } from '@/lib/commercial/accounting-connector';
import { validateAbn } from '@/lib/commercial/settlement-readiness';
import {
  calculateGstFromInclusiveTotal,
  calculateGstFromExclusiveSubtotal,
  toGstInclusiveTotal,
} from '@/lib/commercial/gst-utils';
import { isInvoiceAtOrAfter } from '@/lib/commercial/invoice-lifecycle';
import type { InvoiceLifecycleState } from '@/lib/commercial/invoice-lifecycle';

/* ─── Input types ─────────────────────────────────────────────────────────── */

export type AccountingExportParticipantInput = {
  participant: {
    id: string;
    name: string;
    role: string;
  };

  agreement: {
    approved: boolean;
    agreementGenerated: boolean;
    agreementReference?: string | null;
    projectName?: string | null;
  };

  invoice: {
    state: InvoiceLifecycleState;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    dueDate?: string | null;
    invoiceAmount?: number | null;
    supplierName?: string | null;
    description?: string | null;
  };

  taxDetails: {
    abn?: string | null;
    gstRegistered?: boolean | null;
    businessName?: string | null;
    abnValid?: boolean;
  };

  bankDetails: {
    bsb?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
    complete?: boolean;
  };

  funding: {
    status: 'unfunded' | 'partially_funded' | 'funded' | 'cleared' | 'paid';
  };

  obligation: {
    amount: number;
    currency: string;
    type: 'fixed_fee' | 'revenue_share' | 'conditional' | 'unpaid_internal';
  };

  accounting: {
    /** Current accounting sync status. */
    xeroStatus: 'not_required' | 'pending' | 'exported' | 'failed' | 'needs_review' | 're_export_required';
    /** ISO timestamp when export was approved by operator. */
    exportApprovedAt?: string | null;
    /** ISO timestamp when the export completed. */
    exportedAt?: string | null;
    /** Provider-assigned reference (e.g. Xero bill ID). */
    providerReference?: string | null;
    /** Provider to use for this export. */
    provider?: AccountingProvider;
    /** Tracking category (e.g. event name). */
    trackingCategory?: string | null;
    /** Error message from the last failed export. */
    lastError?: string | null;
  };
};

export type AccountingExportWorkspaceInput = {
  projectId: string;
  projectName?: string | null;
  agreementReference?: string | null;
  /** ISO date string (defaults to today). */
  currentDate?: string;
  /** Default accounting provider for the workspace. */
  defaultProvider?: AccountingProvider;
  participants: AccountingExportParticipantInput[];
};

/* ─── Export readiness ────────────────────────────────────────────────────── */

export type ExportBlockerReason =
  | 'agreement_not_approved'
  | 'invoice_not_received'
  | 'invoice_not_verified'
  | 'abn_missing'
  | 'abn_invalid'
  | 'gst_not_confirmed'
  | 'bank_details_incomplete'
  | 'funding_not_confirmed'
  | 'settlement_readiness_incomplete'
  | 'accounting_not_required';

export type ExportBlocker = {
  reason: ExportBlockerReason;
  /** Operator-facing explanation. */
  explanation: string;
  /** Commercial consequence if not resolved. */
  consequence: string;
  /** Exactly one action. */
  action: string;
};

export type ExportReadiness = {
  /** True when all blockers are resolved and export can proceed. */
  ready: boolean;
  blockers: ExportBlocker[];
  /** The most important next action. null when ready. */
  nextAction: string | null;
};

/* ─── Preview (operator sees before approving) ───────────────────────────── */

export type AccountingExportPreview = {
  /** Supplier name as it will appear in the accounting system. */
  supplier: string;
  /** Line item description. */
  description: string;
  /** Payment / reconciliation reference. */
  reference: string;
  /** Invoice number from the participant's invoice. */
  invoiceNumber: string | null;
  /** Total amount in the workspace currency. */
  amount: number;
  /** GST component. 0 if not applicable. */
  gstAmount: number;
  /** True when GST is included. */
  gstIncluded: boolean;
  currency: string;
  /** Optional tracking category. */
  trackingCategory: string | null;
  /** ISO due date. */
  dueDate: string | null;
  /** Which accounting system this will export to. */
  accountingSystem: AccountingProvider;
  /** Human-readable label for the accounting system. */
  accountingSystemLabel: string;
  /** ABN for supplier verification. */
  abn: string | null;
};

/* ─── Full export model (per participant) ─────────────────────────────────── */

export type AccountingExportModel = {
  /** Deterministic ID: `${projectId}:${participantId}:accounting_export` */
  exportId: string;
  participantId: string;
  participantName: string;
  projectId: string;

  /** Current synchronisation status. */
  status: AccountingSyncStatus;
  /** Human-readable status label. */
  statusLabel: string;

  /** Whether this participant is ready for accounting export. */
  exportReadiness: ExportReadiness;

  /** Preview for operator approval. null when not ready. */
  preview: AccountingExportPreview | null;

  /** ISO date export was approved by operator. */
  exportApprovedAt: string | null;
  /** ISO date export completed at provider. */
  exportedAt: string | null;
  /** Provider reference (e.g. Xero bill ID). */
  providerReference: string | null;
  /** Reason for failure in operator language. */
  failureReason: string | null;
  /** Recommended action when failed or needs review. */
  failureAction: string | null;

  /** Whether re-export is required (e.g. invoice amount changed after initial export). */
  reExportRequired: boolean;

  /** Whether the accounting export is not applicable for this participant type. */
  notApplicable: boolean;
};

/* ─── Workspace sync status (dashboard) ─────────────────────────────────── */

export type WorkspaceAccountingSyncStatus = {
  participants: AccountingExportModel[];
  readyToExportCount: number;
  exportedTodayCount: number;
  failedCount: number;
  needsReviewCount: number;
  totalExportable: number;
  overallStatus: 'all_exported' | 'in_progress' | 'blocked' | 'not_started';
  primaryCta: string | null;
  provvyNarrative: string;
};

/* ─── Core engine ─────────────────────────────────────────────────────────── */

/**
 * Derive the full accounting export model for a single participant.
 *
 * PURE FUNCTION — deterministic, no network calls, no side effects.
 *
 * Produces:
 *   - Export readiness (ready / blocked + why)
 *   - Operator-facing preview (for approval)
 *   - Current sync status
 *   - Failure reason and action (when applicable)
 */
export function deriveAccountingExport(
  input: AccountingExportParticipantInput,
  context: { projectId: string; agreementReference?: string | null; projectName?: string | null; defaultProvider?: AccountingProvider; currentDate?: string }
): AccountingExportModel {
  const {
    participant,
    agreement,
    invoice,
    taxDetails,
    bankDetails,
    funding,
    obligation,
    accounting,
  } = input;

  const provider = accounting.provider ?? context.defaultProvider ?? 'xero';
  const exportId = `${context.projectId}:${participant.id}:accounting_export`;

  /* ── Not applicable (unpaid internal) ── */
  if (obligation.type === 'unpaid_internal' || accounting.xeroStatus === 'not_required') {
    return makeNotApplicableModel(exportId, participant, context.projectId);
  }

  /* ── Check export readiness ── */
  const exportReadiness = deriveExportReadiness(input);

  /* ── Derive sync status ── */
  const status = deriveSyncStatus(accounting, exportReadiness);
  const statusLabel = SYNC_STATUS_LABELS[status];

  /* ── Build preview (when ready) ── */
  const preview = exportReadiness.ready
    ? buildPreview(input, context, provider)
    : null;

  /* ── Failure details ── */
  const failureReason = status === 'failed' || status === 'needs_review'
    ? (accounting.lastError
        ? toOperatorError(accounting.lastError)
        : 'The last export attempt encountered an error.')
    : null;
  const failureAction = failureReason
    ? 'Review the error below and attempt the export again.'
    : null;

  const reExportRequired = accounting.xeroStatus === 're_export_required';

  return {
    exportId,
    participantId: participant.id,
    participantName: participant.name,
    projectId: context.projectId,
    status,
    statusLabel,
    exportReadiness,
    preview,
    exportApprovedAt: accounting.exportApprovedAt ?? null,
    exportedAt: accounting.exportedAt ?? null,
    providerReference: accounting.providerReference ?? null,
    failureReason,
    failureAction,
    reExportRequired,
    notApplicable: false,
  };
}

/* ─── Export readiness derivation ────────────────────────────────────────── */

/**
 * Determine whether a participant is ready for accounting export.
 * Returns a canonical readiness object with every blocker explained.
 * Never returns a generic error.
 */
export function deriveExportReadiness(
  input: AccountingExportParticipantInput
): ExportReadiness {
  const { agreement, invoice, taxDetails, bankDetails, funding } = input;
  const blockers: ExportBlocker[] = [];

  /* 1. Agreement must be approved */
  if (!agreement.approved) {
    blockers.push({
      reason: 'agreement_not_approved',
      explanation: 'The participant has not approved their commercial agreement.',
      consequence: 'No payment obligation exists without participant approval.',
      action: 'Request the participant to approve their commercial terms.',
    });
  }

  /* 2. Invoice must be received */
  if (!isInvoiceAtOrAfter(invoice.state, 'received')) {
    blockers.push({
      reason: 'invoice_not_received',
      explanation: 'An invoice has not been received from this participant.',
      consequence: 'Accounting systems require a supplier invoice before recording a payable.',
      action: 'Request an invoice from the participant.',
    });
  }

  /* 3. Invoice must be verified */
  if (isInvoiceAtOrAfter(invoice.state, 'received') && !isInvoiceAtOrAfter(invoice.state, 'verified')) {
    blockers.push({
      reason: 'invoice_not_verified',
      explanation: 'The invoice has been received but not yet verified.',
      consequence: 'Only verified invoices can be exported to your accounting system.',
      action: 'Review and verify the invoice before exporting.',
    });
  }

  /* 4. ABN must be provided */
  const abn = taxDetails.abn?.replace(/\s/g, '') ?? '';
  if (!abn) {
    blockers.push({
      reason: 'abn_missing',
      explanation: 'An ABN has not been provided for this participant.',
      consequence: 'Payments to suppliers without an ABN may require tax withholding.',
      action: 'Request an ABN from the participant.',
    });
  } else {
    /* 5. ABN must be valid */
    const abnIsValid = taxDetails.abnValid ?? validateAbn(abn);
    if (!abnIsValid) {
      blockers.push({
        reason: 'abn_invalid',
        explanation: `The ABN provided (${abn}) does not pass the ATO check digit validation.`,
        consequence: 'An invalid ABN cannot be recorded in Xero.',
        action: 'Ask the participant to confirm their correct ABN.',
      });
    }
  }

  /* 6. GST registration status must be confirmed */
  if (taxDetails.gstRegistered === undefined || taxDetails.gstRegistered === null) {
    blockers.push({
      reason: 'gst_not_confirmed',
      explanation: "The participant's GST registration status has not been confirmed.",
      consequence: 'GST treatment cannot be determined for the accounting entry.',
      action: 'Confirm whether the participant is registered for GST.',
    });
  }

  /* 7. Bank details must be complete */
  if (!bankDetails.complete) {
    blockers.push({
      reason: 'bank_details_incomplete',
      explanation: 'Bank account details are incomplete for this participant.',
      consequence: 'Payment cannot be processed without valid bank details.',
      action: 'Collect BSB, account number, and account name from the participant.',
    });
  }

  /* 8. Funding must be confirmed */
  const fundingReady = funding.status === 'funded' || funding.status === 'cleared' || funding.status === 'paid';
  if (!fundingReady) {
    blockers.push({
      reason: 'funding_not_confirmed',
      explanation: 'Funding has not been confirmed for this payment obligation.',
      consequence: 'The accounting entry cannot be created without confirmed funding.',
      action: 'Upload funding evidence to confirm the obligation is funded.',
    });
  }

  const ready = blockers.length === 0;
  const nextAction = ready ? null : blockers[0].action;

  return { ready, blockers, nextAction };
}

/* ─── Preview builder ─────────────────────────────────────────────────────── */

/**
 * Build the operator-facing accounting preview.
 * Called ONLY after export readiness is confirmed.
 */
export function deriveAccountingExportPreview(
  input: AccountingExportParticipantInput,
  context: { projectId: string; agreementReference?: string | null; projectName?: string | null; defaultProvider?: AccountingProvider }
): AccountingExportPreview | null {
  const readiness = deriveExportReadiness(input);
  if (!readiness.ready) return null;

  const provider = input.accounting.provider ?? context.defaultProvider ?? 'xero';
  return buildPreview(input, context, provider);
}

function buildPreview(
  input: AccountingExportParticipantInput,
  context: { projectId: string; agreementReference?: string | null; projectName?: string | null },
  provider: AccountingProvider
): AccountingExportPreview {
  const { participant, invoice, taxDetails, obligation, accounting } = input;

  const supplier =
    taxDetails.businessName?.trim() ||
    invoice.supplierName?.trim() ||
    participant.name;

  const agreementRef =
    input.agreement.agreementReference ||
    context.agreementReference ||
    context.projectId;

  const projectLabel = input.agreement.projectName || context.projectName || 'Commercial Agreement';

  const description =
    invoice.description?.trim() ||
    `${participant.role} services — ${projectLabel}`;

  const reference = `${agreementRef} / ${participant.name}`;

  /* GST calculation
   *
   * invoice.invoiceAmount is a GST-INCLUSIVE total (generated by supplier onboarding
   * as subtotal + 10% GST). Use the inclusive formula (÷11) to extract the GST component.
   *
   * When invoiceAmount is absent, obligation.amount is GST-EXCLUSIVE (the raw commitment
   * amount). Convert to inclusive first so the GST component is consistent with what
   * supplier onboarding would have generated.
   */
  const gstIncluded = taxDetails.gstRegistered === true;
  const totalAmount =
    invoice.invoiceAmount != null
      ? invoice.invoiceAmount
      : toGstInclusiveTotal(obligation.amount, gstIncluded);
  const gstAmount = invoice.invoiceAmount != null
    ? calculateGstFromInclusiveTotal(totalAmount, gstIncluded)
    : (calculateGstFromExclusiveSubtotal(obligation.amount, gstIncluded) ?? 0);

  return {
    supplier,
    description,
    reference,
    invoiceNumber: invoice.invoiceNumber ?? null,
    amount: totalAmount,
    gstAmount,
    gstIncluded,
    currency: obligation.currency,
    trackingCategory: accounting.trackingCategory ?? null,
    dueDate: invoice.dueDate ?? null,
    accountingSystem: provider,
    accountingSystemLabel: ACCOUNTING_PROVIDER_LABELS[provider],
    abn: taxDetails.abn?.replace(/\s/g, '') ?? null,
  };
}

/* ─── Sync status derivation ──────────────────────────────────────────────── */

function deriveSyncStatus(
  accounting: AccountingExportParticipantInput['accounting'],
  readiness: ExportReadiness
): AccountingSyncStatus {
  if (accounting.xeroStatus === 'exported') return 'exported';
  if (accounting.xeroStatus === 'failed') return 'failed';
  if (accounting.xeroStatus === 'needs_review') return 'needs_review';
  if (accounting.xeroStatus === 're_export_required') return 're_export_required';
  if (!readiness.ready) return 'ready'; // show as "ready" but with blockers
  return 'ready';
}

/* ─── Workspace sync status (dashboard) ──────────────────────────────────── */

/**
 * Aggregate accounting export status across all participants.
 * Used by the dashboard widget.
 *
 * Consumes `deriveAccountingExport()` per participant — no independent logic.
 */
export function deriveAccountingSyncStatus(
  input: AccountingExportWorkspaceInput
): WorkspaceAccountingSyncStatus {
  const today = input.currentDate ?? new Date().toISOString().slice(0, 10);

  const context = {
    projectId: input.projectId,
    agreementReference: input.agreementReference,
    projectName: input.projectName,
    defaultProvider: input.defaultProvider,
  };

  const models = input.participants
    .map((p) => deriveAccountingExport(p, context))
    .filter((m) => !m.notApplicable);

  const readyToExportCount = models.filter(
    (m) => m.exportReadiness.ready && m.status === 'ready' && !m.exportedAt
  ).length;

  const exportedTodayCount = models.filter(
    (m) => m.exportedAt?.slice(0, 10) === today
  ).length;

  const failedCount = models.filter(
    (m) => m.status === 'failed'
  ).length;

  const needsReviewCount = models.filter(
    (m) => m.status === 'needs_review' || m.status === 're_export_required'
  ).length;

  const totalExportable = models.length;
  const exportedCount = models.filter((m) => m.status === 'exported').length;

  let overallStatus: WorkspaceAccountingSyncStatus['overallStatus'];
  if (totalExportable === 0) {
    overallStatus = 'not_started';
  } else if (exportedCount === totalExportable) {
    overallStatus = 'all_exported';
  } else if (failedCount > 0 || needsReviewCount > 0) {
    overallStatus = 'blocked';
  } else if (exportedCount > 0 || readyToExportCount > 0) {
    overallStatus = 'in_progress';
  } else {
    overallStatus = 'not_started';
  }

  const primaryCta = derivePrimaryCta(models);
  const provvyNarrative = buildAccountingNarrative(models, { failedCount, readyToExportCount, needsReviewCount });

  return {
    participants: models,
    readyToExportCount,
    exportedTodayCount,
    failedCount,
    needsReviewCount,
    totalExportable,
    overallStatus,
    primaryCta,
    provvyNarrative,
  };
}

function derivePrimaryCta(models: AccountingExportModel[]): string | null {
  if (models.some((m) => m.status === 'failed')) return 'Resolve export errors';
  if (models.some((m) => m.status === 'needs_review')) return 'Review accounting entries';
  if (models.some((m) => m.exportReadiness.ready && m.status === 'ready' && !m.exportedAt))
    return 'Review and export to accounting';
  if (models.every((m) => m.status === 'exported')) return null;
  return 'Prepare accounting exports';
}

/* ─── Provvy narrative ────────────────────────────────────────────────────── */

/**
 * Build a Provvy-ready narrative for accounting export status.
 * Answers: "What is the accounting status?" and "What should I do next?"
 */
export function buildAccountingNarrative(
  models: AccountingExportModel[],
  counts?: { failedCount?: number; readyToExportCount?: number; needsReviewCount?: number }
): string {
  if (models.length === 0) {
    return 'No participants require accounting export. No action needed.';
  }

  const exported = models.filter((m) => m.status === 'exported');
  const failed = models.filter((m) => m.status === 'failed');
  const needsReview = models.filter((m) => m.status === 'needs_review' || m.status === 're_export_required');
  const ready = models.filter((m) => m.exportReadiness.ready && m.status === 'ready' && !m.exportedAt);
  const blocked = models.filter((m) => !m.exportReadiness.ready && m.status !== 'exported');

  const lines: string[] = [];

  if (exported.length > 0) {
    lines.push(
      `${exported.length} participant${exported.length > 1 ? 's have' : ' has'} been exported to the accounting system.`
    );
  }

  if (failed.length > 0) {
    lines.push(
      `${failed.length} export${failed.length > 1 ? 's have' : ' has'} failed. These require immediate attention.`
    );
    const firstFailed = failed[0];
    if (firstFailed.failureReason) {
      lines.push(`  ${firstFailed.participantName}: ${firstFailed.failureReason}`);
    }
  }

  if (needsReview.length > 0) {
    lines.push(`${needsReview.length} export${needsReview.length > 1 ? 's need' : ' needs'} review.`);
  }

  if (ready.length > 0) {
    lines.push(`${ready.length} participant${ready.length > 1 ? 's are' : ' is'} ready for accounting export.`);
  }

  if (blocked.length > 0) {
    lines.push(`${blocked.length} participant${blocked.length > 1 ? 's are' : ' is'} blocked from export.`);
    const firstBlocker = blocked[0]?.exportReadiness.blockers[0];
    if (firstBlocker) {
      lines.push(`  Primary blocker: ${firstBlocker.explanation}`);
    }
  }

  // Single recommended action
  if (failed.length > 0) {
    lines.push('');
    lines.push('Recommended next action: Resolve export errors and retry.');
  } else if (needsReview.length > 0) {
    lines.push('');
    lines.push('Recommended next action: Review the accounting entries that need attention.');
  } else if (ready.length > 0) {
    lines.push('');
    lines.push('Recommended next action: Review the export preview and approve the accounting export.');
  } else if (blocked.length > 0) {
    const firstAction = blocked[0]?.exportReadiness.nextAction;
    if (firstAction) {
      lines.push('');
      lines.push(`Recommended next action: ${firstAction}`);
    }
  }

  if (lines.length === 0) {
    return 'All accounting exports are complete.';
  }

  return lines.join('\n');
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function makeNotApplicableModel(
  exportId: string,
  participant: { id: string; name: string },
  projectId: string
): AccountingExportModel {
  return {
    exportId,
    participantId: participant.id,
    participantName: participant.name,
    projectId,
    status: 'exported', // treat as "done" — no action needed
    statusLabel: 'Not required',
    exportReadiness: { ready: true, blockers: [], nextAction: null },
    preview: null,
    exportApprovedAt: null,
    exportedAt: null,
    providerReference: null,
    failureReason: null,
    failureAction: null,
    reExportRequired: false,
    notApplicable: true,
  };
}

function toOperatorError(technicalError: string): string {
  // Map known technical errors to operator-friendly messages
  if (technicalError.toLowerCase().includes('duplicate')) {
    return 'A bill already exists in your accounting system for this invoice number. Check for duplicates before re-exporting.';
  }
  if (technicalError.toLowerCase().includes('auth') || technicalError.toLowerCase().includes('token')) {
    return 'The accounting system connection has expired. Reconnect your accounting system to continue.';
  }
  if (technicalError.toLowerCase().includes('network') || technicalError.toLowerCase().includes('timeout')) {
    return 'The export could not reach your accounting system. Check your connection and try again.';
  }
  return 'An error occurred during export. Review the details and try again.';
}

/**
 * Format a currency amount for operator display.
 */
export function formatExportAmount(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
