/**
 * Invoice Lifecycle
 *
 * The canonical invoice lifecycle for every commercial participant.
 *
 * Design rules:
 *   - State derives automatically from persisted data — never manually advanced.
 *   - One canonical lifecycle. No component defines its own invoice states.
 *   - Operator language only. No accounting jargon.
 *   - Each state has one clear operator-facing label and one next action.
 *
 * Lifecycle order:
 *   not_required → required → requested → received → verified → ready_for_xero → exported → ready_for_settlement
 */

/* ─── Invoice lifecycle state ───────────────────────────────────────────────── */

export const INVOICE_LIFECYCLE_STATES = [
  'not_required',
  'required',
  'requested',
  'received',
  'verified',
  'ready_for_xero',
  'exported',
  'ready_for_settlement',
] as const;

export type InvoiceLifecycleState = (typeof INVOICE_LIFECYCLE_STATES)[number];

/* ─── Operator-facing labels ─────────────────────────────────────────────────── */

export const INVOICE_STATE_LABELS: Record<InvoiceLifecycleState, string> = {
  not_required: 'No invoice required',
  required: 'Invoice required',
  requested: 'Invoice requested',
  received: 'Invoice received',
  verified: 'Invoice verified',
  ready_for_xero: 'Ready for Xero export',
  exported: 'Exported to Xero',
  ready_for_settlement: 'Ready for settlement',
};

export const INVOICE_STATE_SHORT_LABELS: Record<InvoiceLifecycleState, string> = {
  not_required: 'Not required',
  required: 'Required',
  requested: 'Requested',
  received: 'Received',
  verified: 'Verified',
  ready_for_xero: 'Ready for Xero',
  exported: 'Exported',
  ready_for_settlement: 'Ready',
};

/* ─── Commercial impact descriptions ────────────────────────────────────────── */

export const INVOICE_STATE_IMPACT: Record<InvoiceLifecycleState, string> = {
  not_required: 'Payment can proceed without an invoice for this participant type.',
  required: 'An invoice must be received before payment can be released.',
  requested: 'Waiting for the participant to submit their invoice.',
  received: 'Invoice has been received and is awaiting verification.',
  verified: 'Invoice has been verified and is ready for accounting export.',
  ready_for_xero: 'Invoice is ready to be exported to your accounting system.',
  exported: 'Invoice has been recorded in Xero. Payment can now be released.',
  ready_for_settlement: 'All documentation is complete. Payment can be released.',
};

/* ─── Next actions ───────────────────────────────────────────────────────────── */

export const INVOICE_NEXT_ACTIONS: Record<InvoiceLifecycleState, string | null> = {
  not_required: null,
  required: 'Request invoice from participant.',
  requested: 'Wait for the participant to submit their invoice.',
  received: 'Review and verify the received invoice.',
  verified: 'Export the invoice to Xero.',
  ready_for_xero: 'Export the invoice to Xero.',
  exported: 'Release payment to the participant.',
  ready_for_settlement: 'Release payment to the participant.',
};

/* ─── Lifecycle helpers ──────────────────────────────────────────────────────── */

export function invoiceStateIndex(state: InvoiceLifecycleState): number {
  return INVOICE_LIFECYCLE_STATES.indexOf(state);
}

export function isInvoiceAtOrAfter(
  current: InvoiceLifecycleState,
  target: InvoiceLifecycleState
): boolean {
  return invoiceStateIndex(current) >= invoiceStateIndex(target);
}

export function invoiceStateProgress(state: InvoiceLifecycleState): number {
  const idx = invoiceStateIndex(state);
  const total = INVOICE_LIFECYCLE_STATES.length - 1;
  return Math.round((idx / total) * 100);
}

export function nextInvoiceState(
  current: InvoiceLifecycleState
): InvoiceLifecycleState | null {
  const idx = invoiceStateIndex(current);
  if (idx < 0 || idx >= INVOICE_LIFECYCLE_STATES.length - 1) return null;
  return INVOICE_LIFECYCLE_STATES[idx + 1];
}

/* ─── Automatic state derivation ─────────────────────────────────────────────── */

export type InvoiceDeriveInput = {
  /** True when this participant type does not require an invoice (e.g. unpaid internal). */
  invoiceNotRequired?: boolean;
  /** True when an invoice has been requested from the participant. */
  invoiceRequested?: boolean;
  /** ISO timestamp when the invoice was received. */
  invoiceReceivedAt?: string | null;
  /** ISO timestamp when the invoice was manually verified by the operator. */
  invoiceVerifiedAt?: string | null;
  /**
   * True when the invoice has been cleared for Xero export
   * (e.g. all pre-export checks passed, manually marked by operator).
   * When false/absent after verification, state stays at 'verified'.
   */
  invoiceReadyForXero?: boolean;
  /** ISO timestamp when the invoice was exported to Xero. */
  invoiceExportedAt?: string | null;
  /** True when bank details have been confirmed and payment is ready. */
  paymentReady?: boolean;
};

/**
 * Automatically derive the current invoice lifecycle state from persisted data.
 * Never call this from UI — consume the result from `deriveSettlementReadiness()`.
 */
export function deriveInvoiceState(input: InvoiceDeriveInput): InvoiceLifecycleState {
  if (input.invoiceNotRequired) return 'not_required';

  if (input.invoiceExportedAt) {
    return input.paymentReady ? 'ready_for_settlement' : 'exported';
  }

  if (input.invoiceVerifiedAt) {
    return input.invoiceReadyForXero ? 'ready_for_xero' : 'verified';
  }

  if (input.invoiceReceivedAt) return 'received';
  if (input.invoiceRequested) return 'requested';

  return 'required';
}

/* ─── Commercial timeline event type for each invoice state ──────────────────── */

export const INVOICE_STATE_TIMELINE_EVENT: Partial<Record<InvoiceLifecycleState, string>> = {
  requested: 'invoice_requested',
  received: 'invoice_received',
  verified: 'invoice_approved',
  exported: 'invoice_exported',
  ready_for_settlement: 'settlement_ready',
};
