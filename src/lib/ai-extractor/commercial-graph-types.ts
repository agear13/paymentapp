import type { ExtractionReadinessAssessment } from './extraction-readiness';
import type { AgreementType } from './classify-agreement-type';

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

/**
 * A grouped payment event: what is paid, when, and under what condition.
 *
 * Combines compensation terms that share the same trigger into one cohesive event.
 * Conditional bonuses attach as `condition` on the parent event, not as separate events.
 *
 * Example:
 *   due: "Within 14 days after event"
 *   pays: ["Fixed fee $600", "+$150 bonus"]
 *   condition: "Attendance exceeds 500"
 */
export type PaymentEventModel = {
  /** When payment is due (from compensation term trigger / deadline). Null if not captured. */
  due: string | null;
  /** What is being paid in this event (human-readable labels). */
  pays: string[];
  /** Any condition that must be met. Null if unconditional. */
  condition: string | null;
};

/**
 * Structured revenue share details for a single participant.
 * Distinct from a generic "10% revenue share" string label.
 */
export type RevenueShareDetail = {
  percentage: number;
  revenueBasis: string;
  referralCode?: string;
};

/**
 * Per-participant review readiness.
 *
 *   ready          — all key fields are present and high-confidence.
 *   needs_review   — one or more fields are low/medium confidence.
 *   missing_info   — required fields (email, earnings, settlement) are absent.
 */
export type ParticipantReviewStatus = 'ready' | 'needs_review' | 'missing_info';

export type ParticipantCommercialCard = {
  participantId: string;
  name: string;
  role: string;
  serviceCategory: string | null;
  /** Operational deliverables (what the participant must do). */
  deliverables: string[];
  /** Operational obligations — same as deliverables, kept for legacy compatibility. */
  operationalObligations: string[];
  /** Compensation labels (human-readable). */
  compensationTerms: string[];
  /**
   * Payment events: compensation terms grouped by trigger/timing.
   * Each event represents "what is paid, when, and under what condition."
   * Conditional bonuses attach to their parent event rather than becoming
   * standalone events.
   */
  paymentEvents: PaymentEventModel[];
  /**
   * Agreement-level or party-specific settlement rules (timing, basis).
   * Distinct from payment events — these are contractual clauses, not
   * specific payment amounts.
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
   * Null for fixed-fee-only participants.
   */
  revenueShareDetail: RevenueShareDetail | null;
  /**
   * Items extracted with low or medium confidence that require human review.
   * Only populated when genuinely ambiguous — not for every field.
   */
  lowConfidenceItems: string[];
  /** Whether this card is ready to approve or needs operator review. */
  reviewStatus: ParticipantReviewStatus;
};

export type CommercialStructureOverview = {
  bulletPoints: string[];
};

export type UnifiedSettlementScheduleEntry = {
  participantId: string;
  participantName: string;
  compensationSummary: string[];
  settlementTriggers: string[];
};

/**
 * Per-participant revenue share summary row, for the Revenue Share Summary section.
 */
export type RevenueShareSummaryRow = {
  participantId: string;
  participantName: string;
  percentage: number;
  revenueBasis: string;
  referralCode?: string;
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
  /** Structured revenue share summary (replaces "Revenue sharing detected"). */
  revenueShareSummary: RevenueShareSummaryRow[];
  readinessAssessment?: ExtractionReadinessAssessment;
};
