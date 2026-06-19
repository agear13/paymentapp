/**
 * Commercial Commitment Lifecycle
 *
 * The single canonical lifecycle model for every commercial agreement in Provvypay.
 *
 * An agreement is not an extracted document — it is a commercial commitment that
 * progresses from negotiation through settlement. This file defines the authoritative
 * stage sequence, labels, and metadata used everywhere in the product.
 *
 * Do NOT define a competing lifecycle elsewhere.
 * Do NOT derive stage order independently from STAGE_ORDER.
 * Do NOT add new stages without updating every record below.
 */

/* ─── Stage enum ────────────────────────────────────────────────────────────── */

/**
 * Every stage of a commercial commitment, in chronological order.
 *
 * Negotiated → Agreement Generated → Agreement Approved → Commercial Obligations
 * Created → Invoice Requested → Invoice Received → Exported to Xero →
 * Payment Released → Settlement Complete
 */
export type CommercialCommitmentStage =
  | 'negotiated'           // Commercial terms agreed — agreement created in system
  | 'agreement_generated'  // Formal agreement document generated and ready to send
  | 'agreement_approved'   // All participants have accepted commercial terms
  | 'obligations_created'  // Payment obligations calculated from commercial terms
  | 'invoice_requested'    // Invoice requested from participant
  | 'invoice_received'     // Invoice received and ready for accounting
  | 'exported_to_xero'     // Exported to Xero — accounting record confirmed
  | 'payment_released'     // Payout released to participant
  | 'settlement_complete'; // All financial obligations settled — relationship operational

/* ─── Ordered sequence ──────────────────────────────────────────────────────── */

/**
 * The canonical sequence of stages. Every lifecycle comparison, progress
 * calculation, and ordering must use this array — never hardcode positions.
 */
export const COMMITMENT_STAGE_ORDER: CommercialCommitmentStage[] = [
  'negotiated',
  'agreement_generated',
  'agreement_approved',
  'obligations_created',
  'invoice_requested',
  'invoice_received',
  'exported_to_xero',
  'payment_released',
  'settlement_complete',
];

/* ─── Display labels ────────────────────────────────────────────────────────── */

/** Commercial language labels shown in the UI. No technical jargon. */
export const COMMITMENT_STAGE_LABELS: Record<CommercialCommitmentStage, string> = {
  negotiated:           'Negotiated',
  agreement_generated:  'Agreement Generated',
  agreement_approved:   'Agreement Approved',
  obligations_created:  'Commercial Obligations Created',
  invoice_requested:    'Invoice Requested',
  invoice_received:     'Invoice Received',
  exported_to_xero:     'Exported to Xero',
  payment_released:     'Payment Released',
  settlement_complete:  'Settlement Complete',
};

/* ─── Short labels (for compact displays) ──────────────────────────────────── */

export const COMMITMENT_STAGE_SHORT_LABELS: Record<CommercialCommitmentStage, string> = {
  negotiated:           'Negotiated',
  agreement_generated:  'Generated',
  agreement_approved:   'Approved',
  obligations_created:  'Obligations',
  invoice_requested:    'Invoice Requested',
  invoice_received:     'Invoice Received',
  exported_to_xero:     'In Xero',
  payment_released:     'Paid',
  settlement_complete:  'Settled',
};

/* ─── Commercial impact descriptions ───────────────────────────────────────── */

/**
 * What completing each stage enables commercially.
 * Every milestone must answer: "Why does this matter to the business?"
 */
export const COMMITMENT_STAGE_IMPACT: Record<CommercialCommitmentStage, string> = {
  negotiated:
    'Commercial terms are recorded. The agreement is ready to be formalised and sent for approval.',
  agreement_generated:
    'The formal agreement document is ready. Participants can now review and approve their commercial terms.',
  agreement_approved:
    'All parties have confirmed the commercial terms. Revenue attribution and settlement can now begin.',
  obligations_created:
    'Settlement amounts are now calculated and ready for review. Invoices can be requested.',
  invoice_requested:
    'An invoice request has been sent. Awaiting receipt before export to Xero.',
  invoice_received:
    'Invoice confirmed. This commitment is ready to be exported to Xero for accounting.',
  exported_to_xero:
    'Accounting record confirmed in Xero. Payment can now be released.',
  payment_released:
    'Payment has been sent. The financial obligation for this commitment is discharged.',
  settlement_complete:
    'All financial obligations are settled. This commercial relationship is fully operational.',
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

/**
 * Returns the zero-based position of a stage in the lifecycle sequence.
 * Returns -1 for unknown stages.
 */
export function stageIndex(stage: CommercialCommitmentStage): number {
  return COMMITMENT_STAGE_ORDER.indexOf(stage);
}

/**
 * Returns true if `a` comes before or at the same position as `b`.
 */
export function isStageAtOrBefore(
  a: CommercialCommitmentStage,
  b: CommercialCommitmentStage
): boolean {
  return stageIndex(a) <= stageIndex(b);
}

/**
 * Returns true if `a` is strictly before `b` in the lifecycle.
 */
export function isStageBeforeStage(
  a: CommercialCommitmentStage,
  b: CommercialCommitmentStage
): boolean {
  return stageIndex(a) < stageIndex(b);
}

/**
 * Returns the next stage after the given stage, or null if already at settlement_complete.
 */
export function nextCommitmentStage(
  stage: CommercialCommitmentStage
): CommercialCommitmentStage | null {
  const idx = stageIndex(stage);
  if (idx < 0 || idx >= COMMITMENT_STAGE_ORDER.length - 1) return null;
  return COMMITMENT_STAGE_ORDER[idx + 1]!;
}

/**
 * Normalises a string to a CommercialCommitmentStage, returning null if not recognised.
 */
export function parseCommitmentStage(
  value: string | null | undefined
): CommercialCommitmentStage | null {
  if (!value) return null;
  const found = COMMITMENT_STAGE_ORDER.find((s) => s === value);
  return found ?? null;
}

/**
 * Returns 0–100 progress percentage for a given stage.
 * Evenly distributed across all stages.
 */
export function commitmentStageProgress(stage: CommercialCommitmentStage): number {
  const idx = stageIndex(stage);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / COMMITMENT_STAGE_ORDER.length) * 100);
}
