/**
 * Payment Setup Domain Types
 *
 * Persisted types for the payment setup workflow.
 * These live in participant_payload.paymentSetup (JSON blob — no DB migration needed).
 *
 * Draft invoice lifecycle:
 *   DRAFT → SUPPLIER_REVIEW → SUBMITTED → APPROVED → EXPORTED_TO_XERO → SETTLED
 */

/** Invoice lifecycle status. */
export type DraftInvoiceStatus =
  | 'DRAFT'              // Created at agreement approval — operator can review before sending
  | 'SUPPLIER_REVIEW'    // Sent to supplier — they can review it
  | 'SUBMITTED'          // Supplier confirmed and submitted their payment details
  | 'APPROVED'           // Operator approved — ready for accounting export
  | 'EXPORTED_TO_XERO'   // Exported to Xero — accounting record created
  | 'SETTLED';           // Payment released to supplier

/** A persisted draft invoice — the source of truth, generated once at agreement approval. */
export type PersistedDraftInvoice = {
  /** Unique invoice ID (uuid). */
  id: string;
  /** ISO timestamp when this invoice was generated. */
  createdAt: string;
  /** Current lifecycle status. */
  status: DraftInvoiceStatus;
  /** Supplier (participant) name. */
  supplier: string;
  /** Participant ID. */
  participantId: string;
  /** Agreement / project reference. */
  agreementReference: string | null;
  /** Project name. */
  projectName: string;
  /** Line item description. */
  description: string;
  /** Invoice currency (always AUD for AU participants). */
  currency: string;
  /** Pre-GST subtotal. */
  subtotal: number;
  /** GST amount (null when GST not applicable or pending). */
  gstAmount: number | null;
  /** Invoice total (subtotal + GST). */
  total: number;
  /** Whether GST is included. Recalculated when supplier confirms GST = Yes. */
  gstIncluded: boolean;
  /** GST status at invoice generation time. May be updated after supplier confirms. */
  gstStatus: 'pending' | 'yes' | 'no' | 'not_applicable';
  /** ISO due date (if known). */
  dueDate: string | null;
  /** Invoice line items for Xero export. */
  lineItems: PersistedInvoiceLineItem[];
};

export type PersistedInvoiceLineItem = {
  description: string;
  quantity: number;
  unitAmount: number;
  /** Xero tax type: 'OUTPUT' (GST on sales) | 'NONE' | 'EXEMPTEXPENSES' */
  taxType: string;
};

/** An attachment uploaded during payment setup (alternative payment method evidence). */
export type PaymentAttachment = {
  /** Unique attachment ID (uuid). */
  id: string;
  /** R2 / local storage key. */
  storageKey: string;
  /** Original filename (sanitised). */
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** ISO timestamp. */
  uploadedAt: string;
};

/** The full payment setup state stored in participant_payload.paymentSetup. */
export type PaymentSetupState = {
  // ── Token ─────────────────────────────────────────────
  /** Signed UUID token for the public portal. */
  token?: string;
  tokenCreatedAt?: string;
  tokenExpiresAt?: string;
  /** Set when supplier completes submission — invalidates the token. */
  tokenUsedAt?: string;

  /** ISO timestamp when operator generated and sent the payment request portal. */
  paymentRequestGeneratedAt?: string;
  /** ISO timestamp when participant first opened the secure portal. */
  portalFirstOpenedAt?: string;

  // ── Draft invoice ─────────────────────────────────────
  draftInvoice?: PersistedDraftInvoice;

  // ── Attachments ───────────────────────────────────────
  attachments?: PaymentAttachment[];

  // ── Xero export ───────────────────────────────────────
  xeroContactId?: string;
  xeroInvoiceId?: string;
  xeroInvoiceNumber?: string;
  xeroExportedAt?: string;
  xeroExportedBy?: string;
  /** Timestamp of the most recent export attempt (set on both success and failure). */
  xeroLastAttemptAt?: string;
  xeroSyncStatus?: 'pending' | 'synced' | 'failed';
  xeroFailureReason?: string | null;
};
