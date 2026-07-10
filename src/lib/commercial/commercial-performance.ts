/**
 * Commercial Performance Engine
 *
 * The canonical engine that answers: "How is this business performing commercially?"
 *
 * Design rules:
 *   - The Commercial Graph is the single source of truth.
 *   - Commercial Performance is a PROJECTION of the Commercial Graph.
 *   - No React component, page, or hook may calculate these values independently.
 *   - All functions are pure — deterministic, no network calls, no side effects.
 *   - Every metric derives from the output of existing canonical engines:
 *       CommercialForecastResult  (commercial-forecast.ts)
 *       SettlementReadinessResult (settlement-readiness.ts)
 *       WorkspaceAccountingSyncStatus (accounting-export.ts)
 *       CommercialTimelineEvent[] (commercial-timeline-events.ts)
 *   - No duplicate calculations. This engine receives already-derived results;
 *     it never re-runs Forecast, Settlement, or Accounting calculations.
 *
 * Seven exported functions:
 *   deriveCommercialPerformance()         — master composite result
 *   deriveCashPosition()                  — today/expected/committed/paid/outstanding
 *   deriveEventProfitability()            — revenue/costs/margin/percentages
 *   deriveRevenueConfidence()             — per-source confidence breakdown
 *   deriveCommercialVariance()            — forecast vs actual by category
 *   derivePortfolioPerformance()          — multi-project summary sorted by importance
 *   buildCommercialPerformanceNarrative() — Provvy integration
 *
 * Variance Timeline derives from the existing CommercialTimelineEvent stream —
 * it never introduces a second history model.
 */

import type { CommercialForecastResult, IncomingRevenueItem } from '@/lib/commercial/commercial-forecast';
import type { SettlementReadinessResult } from '@/lib/commercial/settlement-readiness';
import type { WorkspaceAccountingSyncStatus } from '@/lib/commercial/accounting-export';
import type { CommercialTimelineEvent } from '@/lib/commercial/commercial-timeline-events';

/* ─── Input ─────────────────────────────────────────────────────────────── */

export type CommercialPerformanceInput = {
  projectId: string;
  projectName: string;
  currency: string;

  /**
   * Output of deriveCommercialForecast() — the canonical money in/out calculation.
   * Commercial Performance never re-runs this; it consumes the result.
   */
  forecast: CommercialForecastResult;

  /**
   * Per-participant settlement readiness results from deriveWorkspaceSettlementReadiness().
   * Used for outstanding/paid cash position and health signals.
   */
  settlementResults: SettlementReadinessResult[];

  /**
   * Accounting sync status from deriveAccountingSyncStatus().
   * Provides actual-paid figures.
   */
  accountingSync: WorkspaceAccountingSyncStatus;

  /**
   * Existing commercial timeline events (from buildCommercialTimeline()).
   * The Variance Timeline is a filtered/annotated projection of this stream.
   */
  timeline: CommercialTimelineEvent[];

  /**
   * Optional baseline forecast (e.g., the forecast at agreement creation).
   * Used to calculate variance against original expectations.
   * When null, variance compares confirmed vs expected.
   */
  baselineForecast?: CommercialForecastResult | null;

  /** ISO date string. Defaults to today. */
  currentDate?: string;
};

/* ─── Cash Position ─────────────────────────────────────────────────────── */

export type CashPosition = {
  /** Current confirmed cash/revenue (confirmed + cleared revenue). */
  today: number;
  /** Total expected incoming revenue (all confidence levels). */
  expected: number;
  /** Total commercial commitments (fixed + estimates). */
  committed: number;
  /**
   * Amount already paid out to participants (from accounting exports).
   */
  paid: number;
  /**
   * Remaining unpaid obligations (committed - paid).
   */
  outstanding: number;
  /**
   * Forecast surplus/deficit after all commitments are met.
   */
  forecastPosition: number;
  currency: string;
  /** True when current cash can cover all outstanding commitments. */
  canCoverCommitments: boolean;
};

/* ─── Event Profitability ───────────────────────────────────────────────── */

export type EventProfitability = {
  projectName: string;
  currency: string;
  /** Total expected revenue. */
  revenue: number;
  /** Total committed costs (fixed + estimated share). */
  committedCosts: number;
  /** Amount already paid out (from accounting). */
  paid: number;
  /** revenue - committedCosts. */
  forecastMargin: number;
  /** forecastMargin / revenue × 100. null when revenue is 0. */
  marginPercent: number | null;
  /** paid / revenue × 100. null when revenue is 0. */
  cashCollectedPercent: number | null;
  /** committedCosts - paid. */
  outstandingCommitments: number;
  /**
   * Average committed cost per participant.
   * null when no participants.
   */
  averageCostPerParticipant: number | null;
  participantCount: number;
  /** Performance label: 'healthy' | 'watch' | 'attention'. */
  performance: CommercialPerformanceStatus;
};

/* ─── Revenue Confidence ────────────────────────────────────────────────── */

export type RevenueConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type RevenueSourceConfidence = {
  /** Revenue source identifier / name. */
  source: string;
  sourceType: string;
  expectedAmount: number;
  currency: string;
  /** 0–100. */
  confidenceScore: number;
  confidenceLevel: RevenueConfidenceLevel;
  /** Fact-based reasons explaining this confidence level (not AI prose). */
  reasons: string[];
  status: 'confirmed' | 'pending' | 'forecast' | 'at_risk' | 'overdue';
};

export type RevenueConfidenceResult = {
  sources: RevenueSourceConfidence[];
  /** Sum of revenue from confirmed sources (confidence > 80). */
  confirmedRevenue: number;
  /** Sum from medium-confidence sources (confidence 40–80). */
  expectedRevenue: number;
  /** Sum from low-confidence sources (confidence < 40). */
  forecastRevenue: number;
  /** 0–100 weighted average across all sources. */
  overallConfidence: number;
  overallLevel: RevenueConfidenceLevel;
  currency: string;
};

/* ─── Commercial Health ─────────────────────────────────────────────────── */

export type CommercialPerformanceStatus = 'healthy' | 'watch' | 'attention';

export type CommercialHealthSummary = {
  /** 'Healthy' | 'Watch' | 'Attention' */
  status: CommercialPerformanceStatus;
  /** One-line commercial summary. e.g. "Revenue exceeds commitments." */
  summary: string;
  /**
   * Fact-based reasons explaining the status.
   * Operator language only. No percentages. No AI. Facts only.
   */
  reasons: string[];
  /** The next commercial milestone the operator should focus on. */
  nextMilestone: string | null;
};

/* ─── Commercial Variance ───────────────────────────────────────────────── */

export type VarianceCategory = 'revenue' | 'expenses' | 'funding' | 'settlement' | 'payments';

export type CommercialVarianceItem = {
  category: VarianceCategory;
  label: string;
  /** Baseline figure (original forecast or target). */
  forecast: number;
  /** Current actual figure. */
  actual: number;
  /** actual - forecast. Negative = shortfall. */
  difference: number;
  /** True when difference is negative (actual < forecast). */
  isBehindForecast: boolean;
  /** Plain-English explanation of why variance exists. */
  reason: string;
  currency: string;
};

export type CommercialVarianceResult = {
  items: CommercialVarianceItem[];
  /** Total variance across all categories. */
  totalDifference: number;
  /** True when overall performance is ahead of forecast. */
  aheadOfForecast: boolean;
  /** The single most important variance to address. */
  primaryVariance: CommercialVarianceItem | null;
  currency: string;
};

/* ─── Variance Timeline ─────────────────────────────────────────────────── */

/**
 * A Variance Timeline entry is a projection of a CommercialTimelineEvent
 * that carries financial impact data.
 *
 * The Variance Timeline does NOT introduce a second history model.
 * It filters and annotates the existing CommercialTimelineEvent stream.
 */
export type VarianceTimelineEntry = {
  /** Original timeline event ID. */
  eventId: string;
  eventType: CommercialTimelineEvent['type'];
  title: string;
  description: string;
  /** ISO timestamp. */
  occurredAt: string;
  /** Forecast margin at this point. null when not a financial event. */
  forecastMarginAt: number | null;
  /**
   * Change in forecast margin caused by this event.
   * Positive = improved. Negative = worsened.
   */
  marginDelta: number | null;
  /** Plain-English explanation of WHY performance changed. */
  explanation: string;
  currency: string;
};

/* ─── Portfolio Performance ─────────────────────────────────────────────── */

export type PortfolioProjectSummary = {
  projectId: string;
  projectName: string;
  currency: string;
  /** Forecast surplus/deficit. */
  forecastMargin: number;
  status: CommercialPerformanceStatus;
  /** The primary risk or blocker. null when healthy. */
  primaryRisk: string | null;
  /** One recommended next action. */
  nextAction: string | null;
  /** Commercial completeness: 0–100. */
  completionPercent: number;
};

export type PortfolioPerformanceResult = {
  /**
   * Projects sorted by commercial importance:
   *   1. Attention (most urgent first)
   *   2. Watch (higher risk first)
   *   3. Healthy (highest margin first)
   */
  projects: PortfolioProjectSummary[];
  totalForecastMargin: number;
  attentionCount: number;
  watchCount: number;
  healthyCount: number;
  currency: string;
};

/* ─── Master composite result ───────────────────────────────────────────── */

export type CommercialPerformanceResult = {
  projectId: string;
  projectName: string;
  currency: string;
  cashPosition: CashPosition;
  eventProfitability: EventProfitability;
  revenueConfidence: RevenueConfidenceResult;
  commercialVariance: CommercialVarianceResult;
  varianceTimeline: VarianceTimelineEntry[];
  commercialHealth: CommercialHealthSummary;
};

/* ══════════════════════════════════════════════════════════════════════════
   CORE ENGINE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Master Commercial Performance function.
 *
 * PURE FUNCTION — deterministic, no network calls, no side effects.
 *
 * Accepts the already-derived outputs of the canonical engines and produces
 * the complete commercial performance picture. No calculations are duplicated
 * from Forecast, Settlement, or Accounting engines.
 */
export function deriveCommercialPerformance(
  input: CommercialPerformanceInput
): CommercialPerformanceResult {
  const cashPosition = deriveCashPosition(input);
  const eventProfitability = deriveEventProfitability(input);
  const revenueConfidence = deriveRevenueConfidence(input);
  const commercialVariance = deriveCommercialVariance(input);
  const varianceTimeline = deriveVarianceTimeline(input);
  const commercialHealth = deriveCommercialHealth(eventProfitability, revenueConfidence, input);

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    currency: input.currency,
    cashPosition,
    eventProfitability,
    revenueConfidence,
    commercialVariance,
    varianceTimeline,
    commercialHealth,
  };
}

/* ─── 1. Cash Position ──────────────────────────────────────────────────── */

/**
 * Derive the canonical cash position.
 *
 * Sources (no re-calculation):
 *   today   = forecast.confirmedRevenue   (confirmed/cleared funds)
 *   expected = forecast.totalExpectedRevenue
 *   committed = forecast.totalCommitments
 *   paid    = accounting exports completed (from accountingSync)
 *   outstanding = committed - paid
 */
export function deriveCashPosition(input: CommercialPerformanceInput): CashPosition {
  const { forecast, accountingSync } = input;

  // Paid = total exported to accounting × obligation amounts.
  // Since we don't have direct amount data from the sync status,
  // derive from settlement results where status === 'paid' or accounting exported.
  const paid = deriveActualPaid(input);

  const today = forecast.confirmedRevenue;
  const expected = forecast.totalExpectedRevenue;
  const committed = forecast.totalCommitments;
  const outstanding = Math.max(0, committed - paid);
  const forecastPosition = forecast.forecastPosition.forecastBalance;
  const canCoverCommitments = forecast.cashReadiness.canEveryoneBePaid;

  return {
    today,
    expected,
    committed,
    paid,
    outstanding,
    forecastPosition,
    currency: input.currency,
    canCoverCommitments,
  };
}

function deriveActualPaid(input: CommercialPerformanceInput): number {
  // Derive from settlement results — participants with 'paid' status
  const paidSettlements = input.settlementResults.filter((r) => {
    // Check if the settlement was completed (readyToSettle + accounting exported)
    return r.readyToSettle;
  });

  // If no settlement data, use accounting exported count as a proxy
  // In a full implementation this would sum actual payment amounts from payment events
  if (paidSettlements.length === 0 && input.accountingSync.exportedTodayCount === 0) {
    return 0;
  }

  // Estimate: use the ratio of exported participants to total as a fraction of total commitments
  const totalExportable = input.accountingSync.totalExportable;
  if (totalExportable === 0) return 0;

  const exportedCount = input.accountingSync.participants.filter(
    (p) => p.status === 'exported'
  ).length;

  const exportedFraction = exportedCount / totalExportable;
  return Math.round(input.forecast.totalCommitments * exportedFraction);
}

/* ─── 2. Event Profitability ────────────────────────────────────────────── */

/**
 * Derive the primary event profitability card.
 *
 * Derives from forecast outputs — no re-calculation.
 * Adds percentages and per-participant averages.
 */
export function deriveEventProfitability(
  input: CommercialPerformanceInput
): EventProfitability {
  const { forecast, settlementResults, projectName, currency } = input;

  const revenue = forecast.totalExpectedRevenue;
  const committedCosts = forecast.totalCommitments;
  const paid = deriveActualPaid(input);
  const forecastMargin = forecast.forecastPosition.forecastBalance;
  const outstandingCommitments = Math.max(0, committedCosts - paid);

  const marginPercent = revenue > 0
    ? Math.round((forecastMargin / revenue) * 1000) / 10
    : null;

  const cashCollectedPercent = revenue > 0
    ? Math.round((forecast.confirmedRevenue / revenue) * 1000) / 10
    : null;

  const participantCount = settlementResults.length;
  const averageCostPerParticipant =
    participantCount > 0
      ? Math.round(committedCosts / participantCount)
      : null;

  const performance = derivePerformanceStatus(forecast);

  return {
    projectName,
    currency,
    revenue,
    committedCosts,
    paid,
    forecastMargin,
    marginPercent,
    cashCollectedPercent,
    outstandingCommitments,
    averageCostPerParticipant,
    participantCount,
    performance,
  };
}

function derivePerformanceStatus(forecast: CommercialForecastResult): CommercialPerformanceStatus {
  const { forecastPosition, cashReadiness, commercialRisks } = forecast;

  if (forecastPosition.status === 'deficit') return 'attention';
  if (!cashReadiness.canEveryoneBePaid) return 'attention';
  if (commercialRisks.some((r) => r.severity === 'high')) return 'watch';
  if (forecastPosition.forecastBalance <= 0) return 'watch';
  return 'healthy';
}

/* ─── 3. Revenue Confidence ─────────────────────────────────────────────── */

/**
 * Derive the per-source revenue confidence breakdown.
 *
 * Consumes forecast.incomingRevenue — no re-calculation.
 * Maps each IncomingRevenueItem to a RevenueSourceConfidence.
 */
export function deriveRevenueConfidence(
  input: CommercialPerformanceInput
): RevenueConfidenceResult {
  const { forecast, currency } = input;

  const sources: RevenueSourceConfidence[] = forecast.incomingRevenue.map(
    (item) => mapIncomingToConfidence(item, currency)
  );

  /**
   * Use canonical revenue buckets from the forecast engine (already derived by
   * deriveCommercialForecast) rather than re-bucketing by confidence score thresholds.
   * This ensures commercial-performance always agrees with the dashboard and explainability.
   */
  const confirmedRevenue = forecast.confirmedRevenue;
  const expectedRevenue = forecast.pendingRevenue;
  const forecastRevenue = forecast.forecastRevenue;

  const totalAmount = sources.reduce((sum, s) => sum + s.expectedAmount, 0);
  const overallConfidence =
    totalAmount > 0
      ? Math.round(
          sources.reduce((sum, s) => sum + s.confidenceScore * s.expectedAmount, 0) / totalAmount
        )
      : 0;

  const overallLevel = confidenceScoreToLevel(overallConfidence);

  return {
    sources,
    confirmedRevenue,
    expectedRevenue,
    forecastRevenue,
    overallConfidence,
    overallLevel,
    currency,
  };
}

function mapIncomingToConfidence(
  item: IncomingRevenueItem,
  currency: string
): RevenueSourceConfidence {
  const score = item.confidence.score;
  const reasons = item.confidence.reasons.map((r) => r.label);

  return {
    source: item.sourceName,
    sourceType: item.sourceType,
    expectedAmount: item.amount,
    currency,
    confidenceScore: score,
    confidenceLevel: confidenceScoreToLevel(score),
    reasons,
    status: item.status,
  };
}

function confidenceScoreToLevel(score: number): RevenueConfidenceLevel {
  if (score >= 80) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/* ─── 4. Commercial Variance ────────────────────────────────────────────── */

/**
 * Derive commercial variance: forecast vs actual by category.
 *
 * Consumes forecast + accounting outputs — no re-calculation.
 * When baselineForecast is provided, compares against original expectations.
 * When not, compares expected vs confirmed within the current forecast.
 */
export function deriveCommercialVariance(
  input: CommercialPerformanceInput
): CommercialVarianceResult {
  const { forecast, baselineForecast, accountingSync, settlementResults, currency } = input;

  const items: CommercialVarianceItem[] = [];

  /* ── Revenue variance ── */
  const forecastRevenue = baselineForecast?.totalExpectedRevenue ?? forecast.totalExpectedRevenue;
  const actualRevenue = forecast.confirmedRevenue;
  const revenueDiff = actualRevenue - forecastRevenue;

  items.push({
    category: 'revenue',
    label: 'Revenue',
    forecast: forecastRevenue,
    actual: actualRevenue,
    difference: revenueDiff,
    isBehindForecast: revenueDiff < 0,
    reason: deriveRevenueVarianceReason(revenueDiff, forecast),
    currency,
  });

  /* ── Expenses variance ── */
  const forecastExpenses = baselineForecast?.totalCommitments ?? forecast.totalCommitments;
  const actualExpenses = forecast.totalCommitments;
  const expenseDiff = forecastExpenses - actualExpenses; // positive = under budget

  items.push({
    category: 'expenses',
    label: 'Committed Costs',
    forecast: forecastExpenses,
    actual: actualExpenses,
    difference: expenseDiff,
    isBehindForecast: expenseDiff < 0,
    reason: deriveExpenseVarianceReason(expenseDiff, forecast),
    currency,
  });

  /* ── Funding variance ── */
  const fundedParticipants = settlementResults.filter(
    (r) => r.readyToSettle
  ).length;
  const totalParticipants = settlementResults.length;
  const fundingTarget = forecast.totalCommitments;
  const fundingActual = totalParticipants > 0
    ? Math.round(fundingTarget * (fundedParticipants / totalParticipants))
    : 0;
  const fundingDiff = fundingActual - fundingTarget;

  items.push({
    category: 'funding',
    label: 'Funding',
    forecast: fundingTarget,
    actual: fundingActual,
    difference: fundingDiff,
    isBehindForecast: fundingDiff < 0,
    reason: fundedParticipants === totalParticipants
      ? 'All participants have confirmed funding.'
      : `${totalParticipants - fundedParticipants} of ${totalParticipants} participant${totalParticipants !== 1 ? 's have' : ' has'} not yet confirmed funding.`,
    currency,
  });

  /* ── Settlement variance ── */
  const readyCount = settlementResults.filter((r) => r.readyToSettle).length;
  const settledTarget = totalParticipants;
  const settlementDiff = readyCount - settledTarget;

  items.push({
    category: 'settlement',
    label: 'Settlement',
    forecast: settledTarget,
    actual: readyCount,
    difference: settlementDiff,
    isBehindForecast: settlementDiff < 0,
    reason: readyCount === totalParticipants
      ? 'All participants are ready for settlement.'
      : `${readyCount} of ${totalParticipants} participant${totalParticipants !== 1 ? 's are' : ' is'} ready for settlement.`,
    currency,
  });

  /* ── Payments variance ── */
  const exportedCount = accountingSync.participants.filter(
    (p) => p.status === 'exported'
  ).length;
  const paymentsTarget = accountingSync.totalExportable;
  const paymentsDiff = exportedCount - paymentsTarget;

  items.push({
    category: 'payments',
    label: 'Accounting Exports',
    forecast: paymentsTarget,
    actual: exportedCount,
    difference: paymentsDiff,
    isBehindForecast: paymentsDiff < 0,
    reason: exportedCount === paymentsTarget
      ? 'All invoices have been exported to the accounting system.'
      : `${exportedCount} of ${paymentsTarget} invoice${paymentsTarget !== 1 ? 's have' : ' has'} been exported.`,
    currency,
  });

  const totalDifference = revenueDiff + expenseDiff;
  const aheadOfForecast = totalDifference >= 0;

  // Primary variance: largest negative difference (most material concern)
  const negativeItems = items
    .filter((i) => i.isBehindForecast && i.category === 'revenue')
    .sort((a, b) => a.difference - b.difference);
  const primaryVariance = negativeItems[0] ?? items.find((i) => i.isBehindForecast) ?? null;

  return { items, totalDifference, aheadOfForecast, primaryVariance, currency };
}

function deriveRevenueVarianceReason(diff: number, forecast: CommercialForecastResult): string {
  if (diff === 0) return 'Revenue is tracking exactly to forecast.';
  if (diff > 0) return 'Revenue has come in ahead of forecast.';

  const hasOverdue = forecast.incomingRevenue.some((r) => r.status === 'overdue');
  const hasAtRisk = forecast.incomingRevenue.some((r) => r.status === 'at_risk');

  if (hasOverdue) return 'One or more revenue sources are overdue.';
  if (hasAtRisk) return 'One or more revenue sources are at risk.';
  return 'Confirmed revenue is below forecast. Some payments have not yet been received.';
}

function deriveExpenseVarianceReason(diff: number, forecast: CommercialForecastResult): string {
  if (diff === 0) return 'Committed costs are tracking to forecast.';
  if (diff > 0) return 'Committed costs are below forecast — favourable.';
  return 'Additional commitments have been added since the original forecast.';
}

/* ─── 5. Variance Timeline ──────────────────────────────────────────────── */

/** Financial event types that carry variance significance. */
const FINANCIAL_EVENT_TYPES = new Set<CommercialTimelineEvent['type']>([
  'agreement_negotiated',
  'revenue_received',
  'revenue_confirmed',
  'deposit_received',
  'payment_evidence_uploaded',
  'forecast_updated',
  'commercial_risk_resolved',
  'obligations_created',
  'obligations_funded',
  'payment_released',
  'settlement_complete',
  'conditional_bonus_unlocked',
]);

/**
 * Project the existing CommercialTimelineEvent stream into a Variance Timeline.
 *
 * Does NOT introduce a second history model.
 * Filters events that carry financial significance and annotates each with:
 *   - Forecast margin at that point (if available in metadata)
 *   - Margin delta
 *   - Plain-English explanation of WHY performance changed
 */
export function deriveVarianceTimeline(
  input: CommercialPerformanceInput
): VarianceTimelineEntry[] {
  const { timeline, forecast, currency } = input;

  // Filter to financially significant events
  const financialEvents = timeline
    .filter((e) => FINANCIAL_EVENT_TYPES.has(e.type))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)); // oldest first for running total

  if (financialEvents.length === 0) return [];

  // Build entries. For a full implementation, the timeline events would carry
  // snapshot metadata (forecast margin at time of event). When absent, we
  // derive a simplified running picture from the current forecast.
  const currentMargin = forecast.forecastPosition.forecastBalance;
  const entries: VarianceTimelineEntry[] = [];
  let runningMargin = currentMargin;

  // Work backwards from current state to reconstruct approximate history
  for (let i = financialEvents.length - 1; i >= 0; i--) {
    const event = financialEvents[i];
    const snapshotMargin: number | null =
      typeof event.metadata?.forecastMargin === 'number'
        ? (event.metadata.forecastMargin as number)
        : (i === financialEvents.length - 1 ? currentMargin : null);

    const delta: number | null =
      typeof event.metadata?.marginDelta === 'number'
        ? (event.metadata.marginDelta as number)
        : null;

    if (snapshotMargin !== null) {
      runningMargin = snapshotMargin;
    }

    entries.push({
      eventId: event.id,
      eventType: event.type,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt,
      forecastMarginAt: snapshotMargin,
      marginDelta: delta,
      explanation: buildVarianceExplanation(event, delta),
      currency,
    });
  }

  // Return newest-first (canonical timeline order)
  return entries.reverse();
}

function buildVarianceExplanation(
  event: CommercialTimelineEvent,
  delta: number | null
): string {
  if (event.commercialImpact) return event.commercialImpact;

  switch (event.type) {
    case 'revenue_confirmed':
      return 'Revenue confirmed — forecast confidence increased.';
    case 'deposit_received':
      return 'Deposit received — confirmed cash position improved.';
    case 'payment_evidence_uploaded':
      return 'Payment evidence uploaded — revenue confidence updated.';
    case 'obligations_created':
      return 'Commercial obligations recorded — committed costs updated.';
    case 'conditional_bonus_unlocked':
      return 'Conditional bonus triggered — committed costs increased.';
    case 'payment_released':
      return 'Payment released — outstanding obligations reduced.';
    case 'settlement_complete':
      return 'Settlement complete — all commercial commitments fulfilled.';
    case 'forecast_updated':
      return delta !== null
        ? `Forecast margin ${delta >= 0 ? 'increased' : 'decreased'} by ${formatCurrency(Math.abs(delta))}.`
        : 'Forecast was updated following a commercial change.';
    default:
      return event.description;
  }
}

/* ─── 6. Commercial Health Summary ──────────────────────────────────────── */

/**
 * Derive the narrative-first commercial health summary.
 *
 * This is DISTINCT from the score-based CommercialHealthScore in commercial-health.ts.
 * This function produces operator language: status / summary / reasons / next milestone.
 * No percentages. No scores. Facts and outcomes only.
 */
export function deriveCommercialHealth(
  profitability: EventProfitability,
  confidence: RevenueConfidenceResult,
  input: CommercialPerformanceInput
): CommercialHealthSummary {
  const { forecast, settlementResults } = input;

  const status = profitability.performance;
  const reasons: string[] = [];

  /* Build fact-based reasons */
  if (forecast.forecastPosition.status === 'surplus') {
    reasons.push('Revenue exceeds commitments.');
  } else if (forecast.forecastPosition.status === 'deficit') {
    reasons.push('Commitments exceed current revenue forecast.');
  } else {
    reasons.push('Revenue and commitments are balanced.');
  }

  const allApproved =
    settlementResults.length > 0 &&
    settlementResults.every((r) => {
      const approvalItem = r.checklist.find((i) => i.id === 'participant_approval');
      return approvalItem?.status === 'complete';
    });
  if (allApproved && settlementResults.length > 0) {
    reasons.push('All suppliers have approved their commercial terms.');
  } else if (settlementResults.length > 0) {
    const pending = settlementResults.filter((r) => {
      const item = r.checklist.find((i) => i.id === 'participant_approval');
      return item?.status !== 'complete';
    }).length;
    if (pending > 0) reasons.push(`${pending} supplier${pending > 1 ? 's are' : ' is'} yet to approve.`);
  }

  const readyToSettle = settlementResults.filter((r) => r.readyToSettle).length;
  const total = settlementResults.length;
  if (total > 0) {
    if (readyToSettle === total) {
      reasons.push('Settlement is ready to proceed for all suppliers.');
    } else if (readyToSettle > 0) {
      reasons.push(`${readyToSettle} of ${total} suppliers are ready for settlement.`);
    } else {
      reasons.push('Settlement preparation is in progress.');
    }
  }

  if (confidence.overallLevel === 'HIGH') {
    reasons.push('Revenue confidence is high.');
  } else if (confidence.overallLevel === 'LOW') {
    reasons.push('Revenue confidence is low — some sources are unconfirmed.');
  }

  /* Summary */
  const summary = buildHealthSummary(status, profitability, forecast);

  /* Next milestone */
  const nextMilestone = deriveNextMilestone(input, settlementResults, profitability);

  return { status, summary, reasons, nextMilestone };
}

function buildHealthSummary(
  status: CommercialPerformanceStatus,
  profitability: EventProfitability,
  forecast: CommercialForecastResult
): string {
  switch (status) {
    case 'healthy':
      return forecast.cashReadiness.canEveryoneBePaid
        ? 'Revenue exceeds commitments. All suppliers can be paid.'
        : 'Project is performing well commercially.';
    case 'watch':
      return forecast.commercialRisks.length > 0
        ? `One or more commercial risks require monitoring.`
        : 'Project is progressing. Watch for outstanding items.';
    case 'attention':
      return forecast.forecastPosition.status === 'deficit'
        ? 'Revenue is below commitments. Immediate action required.'
        : 'Commercial attention required. Review outstanding items.';
  }
}

function deriveNextMilestone(
  input: CommercialPerformanceInput,
  settlementResults: SettlementReadinessResult[],
  profitability: EventProfitability
): string | null {
  const { forecast } = input;

  // Determine the most important upcoming milestone
  if (forecast.forecastPosition.status === 'deficit') {
    return 'Resolve revenue shortfall before settlement can proceed.';
  }

  const notReady = settlementResults.filter((r) => !r.readyToSettle);
  if (notReady.length > 0) {
    const topBlocker = notReady[0]?.nextAction;
    if (topBlocker) return topBlocker;
    return 'Complete settlement preparation for remaining suppliers.';
  }

  if (forecast.incomingRevenue.some((r) => r.status === 'overdue')) {
    return 'Follow up on overdue revenue sources.';
  }

  if (profitability.paid < profitability.committedCosts) {
    return 'Release payments to remaining suppliers.';
  }

  if (forecast.commercialRisks.length > 0) {
    return forecast.commercialRisks[0].recommendedAction;
  }

  return null;
}

/* ─── 7. Portfolio Performance ──────────────────────────────────────────── */

/**
 * Aggregate performance across multiple commercial projects.
 *
 * Accepts one CommercialPerformanceResult per project.
 * Sorted by commercial importance: Attention → Watch → Healthy.
 * Within each tier, sorted by margin (most concerning first).
 */
export function derivePortfolioPerformance(
  projects: CommercialPerformanceInput[],
  currency = 'AUD'
): PortfolioPerformanceResult {
  const summaries: PortfolioProjectSummary[] = projects.map((p) => {
    const perf = deriveCommercialPerformance(p);
    return buildProjectSummary(p, perf);
  });

  // Sort: attention first, then watch, then healthy; within each tier by margin ascending (worst first)
  const sorted = summaries.sort(compareProjectSummaries);

  const totalForecastMargin = summaries.reduce((sum, s) => sum + s.forecastMargin, 0);
  const attentionCount = summaries.filter((s) => s.status === 'attention').length;
  const watchCount = summaries.filter((s) => s.status === 'watch').length;
  const healthyCount = summaries.filter((s) => s.status === 'healthy').length;

  return {
    projects: sorted,
    totalForecastMargin,
    attentionCount,
    watchCount,
    healthyCount,
    currency,
  };
}

function buildProjectSummary(
  input: CommercialPerformanceInput,
  perf: CommercialPerformanceResult
): PortfolioProjectSummary {
  const { eventProfitability, commercialHealth } = perf;

  const primaryRisk =
    input.forecast.commercialRisks[0]?.title ??
    (eventProfitability.performance !== 'healthy' ? commercialHealth.summary : null);

  const completionPercent = deriveCompletionPercent(input);

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    currency: input.currency,
    forecastMargin: eventProfitability.forecastMargin,
    status: eventProfitability.performance,
    primaryRisk,
    nextAction: commercialHealth.nextMilestone,
    completionPercent,
  };
}

function deriveCompletionPercent(input: CommercialPerformanceInput): number {
  const { settlementResults, accountingSync } = input;
  if (settlementResults.length === 0) return 0;

  const readyCount = settlementResults.filter((r) => r.readyToSettle).length;
  const exportedCount = accountingSync.participants.filter((p) => p.status === 'exported').length;
  const totalExportable = accountingSync.totalExportable || 1;

  const settlementProgress = readyCount / settlementResults.length;
  const accountingProgress = exportedCount / totalExportable;

  return Math.round(((settlementProgress + accountingProgress) / 2) * 100);
}

const STATUS_ORDER: Record<CommercialPerformanceStatus, number> = {
  attention: 0,
  watch: 1,
  healthy: 2,
};

function compareProjectSummaries(a: PortfolioProjectSummary, b: PortfolioProjectSummary): number {
  const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (statusDiff !== 0) return statusDiff;
  // Within same status: worst margin first (attention/watch) or best margin first (healthy)
  if (a.status === 'healthy') return b.forecastMargin - a.forecastMargin;
  return a.forecastMargin - b.forecastMargin;
}

/* ─── Provvy integration ────────────────────────────────────────────────── */

/**
 * Build a Provvy-ready commercial performance narrative.
 *
 * Answers questions like:
 *   "How is this business performing commercially?"
 *   "Which event is making the most money?"
 *   "Why has profitability fallen?"
 *   "Which project needs attention first?"
 *
 * Every response ends with exactly one recommended action.
 * Derives entirely from deriveCommercialPerformance() — no duplicated reasoning.
 */
export function buildCommercialPerformanceNarrative(
  perf: CommercialPerformanceResult
): string {
  const { eventProfitability, cashPosition, revenueConfidence, commercialHealth, commercialVariance } = perf;

  const lines: string[] = [];

  /* Status headline */
  lines.push(commercialHealth.summary);

  /* Key figures */
  if (eventProfitability.revenue > 0) {
    lines.push('');
    lines.push(`Expected revenue: ${formatCurrency(eventProfitability.revenue, eventProfitability.currency)}`);
    lines.push(`Committed costs: ${formatCurrency(eventProfitability.committedCosts, eventProfitability.currency)}`);
    lines.push(`Forecast margin: ${formatCurrency(eventProfitability.forecastMargin, eventProfitability.currency)}`);
  }

  /* Revenue confidence */
  if (revenueConfidence.overallLevel !== 'HIGH') {
    lines.push('');
    lines.push(`Revenue confidence: ${revenueConfidence.overallLevel.toLowerCase()}.`);
    const lowSources = revenueConfidence.sources.filter((s) => s.confidenceLevel !== 'HIGH');
    if (lowSources.length > 0) {
      lines.push(`${lowSources.map((s) => s.source).join(', ')} ${lowSources.length > 1 ? 'are' : 'is'} not yet confirmed.`);
    }
  }

  /* Primary variance */
  if (commercialVariance.primaryVariance && commercialVariance.primaryVariance.isBehindForecast) {
    lines.push('');
    lines.push(`Primary variance: ${commercialVariance.primaryVariance.label}.`);
    lines.push(commercialVariance.primaryVariance.reason);
  }

  /* Recommended next action */
  if (commercialHealth.nextMilestone) {
    lines.push('');
    lines.push(`Recommended next action: ${commercialHealth.nextMilestone}`);
  }

  return lines.join('\n');
}

/* ─── Utilities ─────────────────────────────────────────────────────────── */

function formatCurrency(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
