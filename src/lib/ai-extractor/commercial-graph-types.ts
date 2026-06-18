import type { ExtractionReadinessAssessment } from './extraction-readiness';
import type { AgreementType } from './classify-agreement-type';

/* ─── Commercial structure ───────────────────────────────────────────────────── */

export type CommercialStructureMetrics = {
  agreementType: AgreementType | null;
  agreementTypeLabel: string;
  agreementOwner: string | null;
  participantCount: number;
  deliverableCount: number;
  operationalObligationCount: number;
  compensationTermCount: number;
  settlementEventCount: number;
  revenueShareAgreementCount: number;
  fixedPaymentAgreementCount: number;
  hybridCompensationCount: number;
  milestonePaymentCount: number;
  instalmentPaymentCount: number;
  conditionalPaymentCount: number;
  estimatedFixedCommitment: number;
  variableRevenueBases: string[];
  settlementBlockers: string[];
};

/* ─── Payment events ─────────────────────────────────────────────────────────── */

/**
 * A grouped payment event: what is paid, when, and under what condition.
 *
 * Combines compensation terms that share the same trigger into one cohesive event.
 * Conditional bonuses attach as `condition` on the parent event, not as separate events.
 */
export type PaymentEventModel = {
  /** When payment is due (from compensation term trigger / deadline). Null if not captured. */
  due: string | null;
  /** Short payment labels (amount / percentage only — no timing prose). */
  pays: string[];
  /** Any condition that must be met. Null if unconditional. */
  condition: string | null;
};

/* ─── Revenue share ──────────────────────────────────────────────────────────── */

/**
 * Structured revenue share details for a single participant.
 */
export type RevenueShareDetail = {
  percentage: number;
  revenueBasis: string;
  referralCode?: string;
};

/**
 * Per-participant revenue share summary row.
 * Settlement timing and condition are included for operator review.
 */
export type RevenueShareSummaryRow = {
  participantId: string;
  participantName: string;
  percentage: number;
  revenueBasis: string;
  referralCode?: string;
  /** Settlement timing for this revenue share (e.g. "Within 7 days after event"). */
  settlement?: string;
  /** Condition required before revenue share is payable. */
  condition?: string;
};

/* ─── Review state ───────────────────────────────────────────────────────────── */

/**
 * Specific reason why a participant card is not in "ready" state.
 * Never show a generic "Needs Review" — always give an explicit reason.
 */
export type ReviewReasonCode =
  | 'missing_email'
  | 'missing_payment_destination'
  | 'missing_tax_details'
  | 'low_confidence_compensation'
  | 'conditional_payment_unconfirmed'
  | 'missing_revenue_basis'
  | 'missing_role'
  | 'unresolved_dependency';

export type ReviewReason = {
  code: ReviewReasonCode;
  label: string;
};

/**
 * Per-participant review readiness.
 *
 *   ready            — all key fields are present and high-confidence.
 *   needs_review     — one or more fields are low/medium confidence.
 *   missing_info     — required fields (email, earnings, settlement) are absent.
 */
export type ParticipantReviewStatus = 'ready' | 'needs_review' | 'missing_info';

/* ─── Grouped blockers ──────────────────────────────────────────────────────── */

/**
 * A single grouped blocker entry, collapsing the same issue across multiple participants
 * into one canonical row instead of repeating it per participant.
 *
 * Example:
 *   title:        "Participant Emails"
 *   description:  "5 participants require an email address"
 *   participants: ["Sarah", "Alex", "Mia", "Chris", "Ben"]
 */
export type GroupedBlocker = {
  /** Machine-readable type for grouping/deduplication. */
  type: ReviewReasonCode | 'other';
  title: string;
  description: string;
  /** Names of all participants affected by this blocker. */
  participants: string[];
};

/* ─── Commercial risk summary ───────────────────────────────────────────────── */

/**
 * One item in the commercial risk summary panel.
 *   fact    — verified commercial data (shown with ✓)
 *   warning — something requiring operator attention (shown with ⚠)
 */
export type CommercialRiskItem = {
  type: 'fact' | 'warning';
  text: string;
};

/* ─── Participant card ───────────────────────────────────────────────────────── */

export type ParticipantCommercialCard = {
  participantId: string;
  name: string;
  role: string;
  serviceCategory: string | null;
  /** Operational deliverables (what the participant must do). */
  deliverables: string[];
  /** Operational obligations — same as deliverables, kept for legacy compatibility. */
  operationalObligations: string[];
  /** All compensation labels (human-readable), kept for backward compatibility. */
  compensationTerms: string[];
  /**
   * Fixed payment labels only (fixed_fee, instalment, milestone).
   * Separate from revenue share to avoid mixing compensation models.
   */
  fixedPayments: string[];
  /**
   * Revenue share labels only (revenue_share).
   * Displayed as a distinct section from fixed payments.
   */
  revenueShareTerms: string[];
  /**
   * Conditional bonus labels only.
   * Displayed alongside the payment event they attach to.
   */
  conditionalBonuses: string[];
  /**
   * Payment events: compensation terms grouped by trigger/timing.
   * Uses short amount/pct labels (no timing prose in the pays[] array).
   * Conditional bonuses attach to their parent event.
   */
  paymentEvents: PaymentEventModel[];
  /**
   * Agreement-level or party-specific settlement rules (timing, basis).
   * Distinct from payment events — these are contractual clauses, not amounts.
   */
  settlementRules: string[];
  /**
   * @deprecated Use paymentEvents instead.
   * Kept for backward compatibility with existing callers.
   */
  settlementSchedule: string[];
  dependencies: string[];
  /**
   * Revenue share detail, if this participant earns variable revenue.
   */
  revenueShareDetail: RevenueShareDetail | null;
  /**
   * Items extracted with low or medium confidence that require human review.
   */
  lowConfidenceItems: string[];
  /**
   * Specific reasons why this participant is not in "ready" state.
   * Always populated when reviewStatus !== 'ready'.
   * Never empty when showing a Needs Review or Missing Info badge.
   */
  reviewReasons: ReviewReason[];
  /** Whether this card is ready to approve or needs operator review. */
  reviewStatus: ParticipantReviewStatus;
};

/* ─── Graph snapshot ─────────────────────────────────────────────────────────── */

export type CommercialStructureOverview = {
  bulletPoints: string[];
};

export type UnifiedSettlementScheduleEntry = {
  participantId: string;
  participantName: string;
  compensationSummary: string[];
  settlementTriggers: string[];
};

export type CommercialGraphSnapshot = {
  schemaVersion: 'v5';
  agreementOwner: string | null;
  agreementOwnerResponsibilities: string[];
  commercialStructure: CommercialStructureMetrics;
  commercialSummary: string;
  commercialStructureOverview: CommercialStructureOverview;
  participantCards: ParticipantCommercialCard[];
  settlementSchedule: UnifiedSettlementScheduleEntry[];
  operationalObligations: { participant: string; items: string[] }[];
  compensationTerms: { participant: string; items: string[] }[];
  /** Structured revenue share summary (per participant, with settlement timing). */
  revenueShareSummary: RevenueShareSummaryRow[];
  /**
   * Grouped blockers — same-type issues collapsed across participants.
   * Replaces repeated per-participant blocker lists.
   */
  groupedBlockers: GroupedBlocker[];
  /**
   * Structured commercial risk summary (facts + warnings).
   * Replaces the AI prose narrative as the primary summary surface.
   */
  commercialRiskSummary: CommercialRiskItem[];
  readinessAssessment?: ExtractionReadinessAssessment;
};
