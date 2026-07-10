/**
 * Commercial Explainability Engine
 *
 * Sprint 7.5 — Commercial Number Explainability
 *
 * Every commercial figure in the UI must be explainable in one click.
 * This engine is the single canonical source for all breakdowns.
 *
 * Design rules:
 *   - No component may calculate its own drill-down. All drill-down
 *     logic routes through this engine.
 *   - All functions are pure and deterministic.
 *   - The engine never re-derives money — it only explains existing
 *     `CommercialForecastResult` data. No duplicate calculations.
 *   - Every returned breakdown item must include its evidence chain:
 *     agreement → participant → invoice/forecast → commercial stage.
 *
 * Architecture:
 *   CommercialForecastResult (canonical source)
 *       ↓
 *   commercial-explainability.ts (explains it)
 *       ↓
 *   Drawer components (display the explanation)
 */

import {
  formatForecastAmount,
  type CommercialForecastResult,
  type IncomingRevenueItem,
  type CommitmentItem,
} from '@/lib/commercial/commercial-forecast';

/* ─── Source type ────────────────────────────────────────────────────────────── */

/**
 * What kind of commercial record generated this item.
 * This tells the operator whether accounting entries exist yet.
 */
export type ExplainabilitySourceType =
  | 'Invoice'
  | 'Forecast'
  | 'Commercial Commitment'
  | 'Revenue Source'
  | 'Settlement'
  | 'Accounting Export';

/* ─── Breakdown item ────────────────────────────────────────────────────────── */

/**
 * A single line item in any commercial explainability breakdown.
 *
 * Every item traces back to an agreement, participant, and document.
 * The operator can click any item to view the source agreement,
 * invoice, or commercial timeline.
 */
export type CommercialBreakdownItem = {
  id: string;
  /** Agreement this item belongs to. */
  agreementId?: string;
  agreementName?: string;
  /** Participant who generated this item. */
  participantId?: string;
  participantName?: string;
  /** Invoice reference if item is backed by an invoice. */
  invoiceId?: string;
  invoiceReference?: string;
  /** Forecast ID if item is from a forecast source. */
  forecastId?: string;
  /** Obligation ID if item is from an obligation. */
  obligationId?: string;
  /** Plain-English description of what this item represents. */
  description: string;
  amount: number;
  currency: string;
  /** Human-readable status: "Awaiting Payment", "Confirmed", "Forecast", "Pending Invoice" */
  status: string;
  /** The commercial lifecycle stage this item is at. */
  commercialStage?: string;
  /** 0–100 confidence score for this item. */
  confidence?: number;
  /** Where this item originated. */
  sourceType: ExplainabilitySourceType;
  /**
   * True when this item has accounting ledger entries.
   * When false, the item exists only as a commercial commitment.
   * This distinction matters: commercial commitments precede accounting entries.
   */
  hasLedgerEntries: boolean;
  /**
   * The confidence reasons explaining why the score is what it is.
   * Shown in the confidence breakdown drawer.
   */
  confidenceReasons?: Array<{ positive: boolean; label: string }>;
};

/* ─── Breakdown result ──────────────────────────────────────────────────────── */

/**
 * The output of every explainability function.
 * A total figure plus the evidence that produced it.
 */
export type CommercialBreakdown = {
  /** The aggregated total (same number shown on the dashboard card). */
  total: number;
  currency: string;
  /** The individual items that sum to `total`. */
  items: CommercialBreakdownItem[];
  /** Plain-English explanation of how this figure was calculated. */
  reason: string;
  /** ISO timestamp of the last input that changed this figure. */
  lastUpdated?: string;
  /** 0–100 confidence score for the total (when applicable). */
  confidence?: number;
  /** Dominant source type for the total. */
  sourceType: ExplainabilitySourceType;
  /**
   * When `items` is empty: why the figure is zero.
   * Never show AUD 0 without an explanation.
   */
  emptyStateReason?: string;
  /** Structured empty state checklist (when items are empty). */
  emptyStateChecklist?: string[];
};

/* ─── Net forecast explanation ──────────────────────────────────────────────── */

/**
 * The Net Forecast breakdown explains the arithmetic, not just the result.
 * Every input line is clickable.
 */
export type NetForecastBreakdown = {
  revenue: CommercialBreakdown;
  obligations: CommercialBreakdown;
  /** Derived result: revenue.total - obligations.total */
  netPosition: number;
  currency: string;
  positionLabel: 'Surplus' | 'Shortfall' | 'Break Even' | 'Insufficient Data';
  positionDescription: string;
  reason: string;
};

/* ─── Cash readiness explanation ─────────────────────────────────────────────── */

export type CashReadinessFigure = {
  label: string;
  amount: number;
  currency: string;
  description: string;
};

export type CashReadinessBlocker = {
  participantName: string;
  reason: string;
  actionRequired: string;
};

export type CashReadinessBreakdown = {
  canEveryoneBePaid: boolean;
  available: CashReadinessFigure;
  committed: CashReadinessFigure;
  remaining: CashReadinessFigure;
  currency: string;
  blockers: CashReadinessBlocker[];
  reason: string;
  emptyStateReason?: string;
};

/* ─── 1. Expected Revenue Breakdown ─────────────────────────────────────────── */

/**
 * Explains every source that contributes to the "Expected Revenue" card.
 * Maps directly to `forecast.incomingRevenue` — no new calculations.
 */
export function deriveExpectedRevenueBreakdown(
  forecast: CommercialForecastResult
): CommercialBreakdown {
  const currency = forecast.currency;

  if (forecast.incomingRevenue.length === 0) {
    return {
      total: 0,
      currency,
      items: [],
      reason: 'No revenue sources have been added to this agreement yet.',
      sourceType: 'Revenue Source',
      emptyStateReason: 'No expected revenue yet.',
      emptyStateChecklist: [
        'Participation agreements are approved',
        'Revenue sources are added',
        'Commercial commitments are created',
      ],
    };
  }

  const items: CommercialBreakdownItem[] = forecast.incomingRevenue.map(
    (source: IncomingRevenueItem) => ({
      id: source.id,
      description: source.sourceName,
      amount: source.amount,
      currency: source.currency,
      status: source.statusLabel,
      confidence: source.confidence.score,
      sourceType: mapRevenueSourceType(source.sourceType, source.status),
      hasLedgerEntries: source.hasEvidence,
      confidenceReasons: source.confidence.reasons,
      commercialStage: mapRevenueStatusToStage(source.status),
    })
  );

  const dominantSourceType = resolveDominantSourceType(items);
  const totalFormatted = formatForecastAmount(forecast.totalExpectedRevenue, currency);

  return {
    total: forecast.totalExpectedRevenue,
    currency,
    items,
    reason: `${totalFormatted} is the total of ${items.length} revenue source${items.length !== 1 ? 's' : ''}.`,
    confidence: forecast.overallConfidence.score,
    sourceType: dominantSourceType,
  };
}

/* ─── 2. Expected Obligations Breakdown ──────────────────────────────────────── */

/**
 * Explains every commitment that contributes to the "Expected Obligations" card.
 * Maps directly to `forecast.fixedCommitments` + `forecast.revenueShareCommitments` + `forecast.conditionalCommitments`.
 */
export function deriveExpectedObligationsBreakdown(
  forecast: CommercialForecastResult
): CommercialBreakdown {
  const currency = forecast.currency;
  const allCommitments = [
    ...forecast.fixedCommitments,
    ...forecast.revenueShareCommitments,
    ...forecast.conditionalCommitments,
  ];

  if (allCommitments.length === 0) {
    return {
      total: 0,
      currency,
      items: [],
      reason: 'No commercial commitments have been created yet.',
      sourceType: 'Commercial Commitment',
      emptyStateReason: 'No expected obligations yet.',
      emptyStateChecklist: [
        'Participants are added to the agreement',
        'Earnings are configured for each participant',
        'Participation agreements are approved',
      ],
    };
  }

  const items: CommercialBreakdownItem[] = allCommitments.map(
    (commitment: CommitmentItem) => ({
      id: commitment.id,
      participantName: commitment.participantName,
      description: commitment.participantName,
      amount: commitment.amount ?? 0,
      currency: commitment.currency,
      status: deriveObligationStatus(commitment),
      commercialStage: deriveObligationStage(commitment),
      confidence: commitment.funded ? 100 : 60,
      sourceType: 'Commercial Commitment' as ExplainabilitySourceType,
      hasLedgerEntries: false,
    })
  );

  const totalFormatted = formatForecastAmount(forecast.totalCommitments, currency);

  return {
    total: forecast.totalCommitments,
    currency,
    items,
    reason: `${totalFormatted} is owed across ${items.length} commercial commitment${items.length !== 1 ? 's' : ''}.`,
    sourceType: 'Commercial Commitment',
  };
}

/* ─── 3. Net Forecast Breakdown ──────────────────────────────────────────────── */

/**
 * Explains the arithmetic behind the "Net Forecast" card.
 * Revenue minus Obligations, with every input line traceable.
 */
export function deriveNetForecastBreakdown(
  forecast: CommercialForecastResult
): NetForecastBreakdown {
  const revenue = deriveExpectedRevenueBreakdown(forecast);
  const obligations = deriveExpectedObligationsBreakdown(forecast);
  const { forecastPosition } = forecast;
  const netPosition = forecastPosition.forecastBalance;
  const currency = forecast.currency;

  const positionLabel: NetForecastBreakdown['positionLabel'] =
    forecastPosition.status === 'surplus'
      ? 'Surplus'
      : forecastPosition.status === 'deficit'
        ? 'Shortfall'
        : forecastPosition.status === 'break_even'
          ? 'Break Even'
          : 'Insufficient Data';

  const positionDescription =
    forecastPosition.status === 'surplus'
      ? `${formatForecastAmount(netPosition, currency)} available after all commitments are met.`
      : forecastPosition.status === 'deficit'
        ? `${formatForecastAmount(Math.abs(netPosition), currency)} shortfall — not all commitments can be paid.`
        : forecastPosition.status === 'break_even'
          ? 'Revenue exactly covers all commitments.'
          : 'Not enough data to calculate a reliable forecast.';

  return {
    revenue,
    obligations,
    netPosition,
    currency,
    positionLabel,
    positionDescription,
    reason: `Net Forecast = Revenue (${formatForecastAmount(revenue.total, currency)}) − Obligations (${formatForecastAmount(obligations.total, currency)})`,
  };
}

/* ─── 4. Cash Readiness Breakdown ────────────────────────────────────────────── */

/**
 * Explains the "Cash Readiness" card.
 * Shows Available / Committed / Remaining and any blockers.
 */
export function deriveCashReadinessBreakdown(
  forecast: CommercialForecastResult
): CashReadinessBreakdown {
  const { cashReadiness, forecastPosition } = forecast;
  const currency = forecast.currency;

  if (forecastPosition.status === 'insufficient_data') {
    return {
      canEveryoneBePaid: false,
      available: { label: 'Available', amount: 0, currency, description: 'No revenue confirmed yet.' },
      committed: { label: 'Committed', amount: 0, currency, description: 'No obligations created yet.' },
      remaining: { label: 'Remaining', amount: 0, currency, description: 'Add revenue sources and participant obligations to see cash readiness.' },
      currency,
      blockers: [],
      reason: 'Insufficient data to determine cash readiness.',
      emptyStateReason: 'Cash readiness cannot be calculated yet. Add revenue sources and configure participant obligations.',
    };
  }

  const available: CashReadinessFigure = {
    label: 'Available',
    amount: forecastPosition.totalExpectedRevenue,
    currency,
    description: 'Total expected incoming revenue across all sources.',
  };

  const committed: CashReadinessFigure = {
    label: 'Committed',
    amount: forecastPosition.totalCommitments,
    currency,
    description: 'Total commercial commitments that must be paid to participants.',
  };

  const remaining: CashReadinessFigure = {
    label: 'Remaining',
    amount: forecastPosition.forecastBalance,
    currency,
    description:
      forecastPosition.forecastBalance >= 0
        ? 'Surplus after all commitments are met.'
        : 'Shortfall — additional revenue is needed to meet all commitments.',
  };

  // Derive blockers from commercial risks
  const blockers: CashReadinessBlocker[] = forecast.commercialRisks
    .filter((r) => r.severity === 'high')
    .slice(0, 5)
    .map((risk) => ({
      participantName: 'Commercial Risk',
      reason: risk.title,
      actionRequired: risk.recommendedAction,
    }));

  if (cashReadiness.primaryBlocker && blockers.length === 0) {
    blockers.push({
      participantName: 'Payment',
      reason: cashReadiness.primaryBlocker,
      actionRequired: 'Resolve the blocking issue before settlement.',
    });
  }

  return {
    canEveryoneBePaid: cashReadiness.canEveryoneBePaid,
    available,
    committed,
    remaining,
    currency,
    blockers,
    reason: cashReadiness.canEveryoneBePaid
      ? `All ${formatForecastAmount(forecastPosition.totalCommitments, currency)} in commitments can be paid from ${formatForecastAmount(forecastPosition.totalExpectedRevenue, currency)} available revenue.`
      : `Revenue of ${formatForecastAmount(forecastPosition.totalExpectedRevenue, currency)} is insufficient to cover ${formatForecastAmount(forecastPosition.totalCommitments, currency)} in commitments.`,
  };
}

/* ─── 5. Commercial Confidence Breakdown ─────────────────────────────────────── */

/**
 * Explains the "Commercial Confidence" percentage.
 * Shows each revenue source's individual confidence and the reasons behind it.
 */
export function deriveCommercialConfidenceBreakdown(
  forecast: CommercialForecastResult
): CommercialBreakdown {
  const currency = forecast.currency;

  if (forecast.incomingRevenue.length === 0) {
    return {
      total: 0,
      currency,
      items: [],
      reason: 'Confidence cannot be calculated — no revenue sources exist.',
      sourceType: 'Forecast',
      confidence: 0,
      emptyStateReason: 'Add revenue sources to see confidence scores.',
      emptyStateChecklist: [
        'Participation agreements are approved',
        'Revenue sources are added',
        'Invoices are generated',
      ],
    };
  }

  const items: CommercialBreakdownItem[] = forecast.incomingRevenue.map(
    (source: IncomingRevenueItem) => ({
      id: source.id,
      description: source.sourceName,
      amount: source.amount,
      currency: source.currency,
      status: source.statusLabel,
      confidence: source.confidence.score,
      sourceType: mapRevenueSourceType(source.sourceType, source.status),
      hasLedgerEntries: source.hasEvidence,
      confidenceReasons: source.confidence.reasons,
      commercialStage: mapRevenueStatusToStage(source.status),
    })
  );

  const overallScore = forecast.overallConfidence.score;
  const level = forecast.overallConfidence.level;

  const levelDescription =
    level === 'HIGH'
      ? 'Revenue is well-confirmed with strong evidence.'
      : level === 'MEDIUM'
        ? 'Most revenue is pending — collection in progress.'
        : level === 'LOW'
          ? 'Revenue is forecast-heavy — limited confirmed evidence.'
          : 'Not enough data to calculate a reliable confidence score.';

  return {
    total: overallScore,
    currency,
    items,
    reason: levelDescription,
    confidence: overallScore,
    sourceType: 'Forecast',
  };
}

/* ─── 6. Revenue Source Breakdown ────────────────────────────────────────────── */

/**
 * Returns revenue items grouped by source type (Invoice vs Forecast vs Confirmed).
 * Equivalent to `deriveExpectedRevenueBreakdown` but annotated for the reporting context.
 */
export function deriveRevenueSourceBreakdown(
  forecast: CommercialForecastResult
): CommercialBreakdown {
  return deriveExpectedRevenueBreakdown(forecast);
}

/* ─── 7. Generic figure explanation ─────────────────────────────────────────── */

/**
 * Returns a human-readable explanation of any displayed commercial figure.
 * Used for tooltip / on-demand explanations throughout the product.
 */
export function deriveCommercialFigureExplanation(
  forecast: CommercialForecastResult,
  figure: 'expected_revenue' | 'expected_obligations' | 'net_forecast' | 'cash_readiness' | 'commercial_confidence'
): string {
  switch (figure) {
    case 'expected_revenue': {
      const count = forecast.incomingRevenue.length;
      if (count === 0) return 'No revenue sources have been added yet.';
      return `${formatForecastAmount(forecast.totalExpectedRevenue, forecast.currency)} expected from ${count} revenue source${count !== 1 ? 's' : ''}.`;
    }
    case 'expected_obligations': {
      const count = [
        ...forecast.fixedCommitments,
        ...forecast.revenueShareCommitments,
        ...forecast.conditionalCommitments,
      ].length;
      if (count === 0) return 'No commercial commitments have been created yet.';
      return `${formatForecastAmount(forecast.totalCommitments, forecast.currency)} owed across ${count} commitment${count !== 1 ? 's' : ''}.`;
    }
    case 'net_forecast': {
      const { forecastPosition } = forecast;
      if (forecastPosition.status === 'insufficient_data') return 'Not enough data to calculate a net forecast.';
      return `${formatForecastAmount(forecast.totalExpectedRevenue, forecast.currency)} revenue minus ${formatForecastAmount(forecast.totalCommitments, forecast.currency)} in commitments = ${forecastPosition.forecastBalance >= 0 ? '+' : ''}${formatForecastAmount(forecastPosition.forecastBalance, forecast.currency)}.`;
    }
    case 'cash_readiness': {
      const { cashReadiness } = forecast;
      if (cashReadiness.canEveryoneBePaid) {
        return `All commitments can be paid. ${cashReadiness.expectedBalanceAfterSettlement != null ? formatForecastAmount(cashReadiness.expectedBalanceAfterSettlement, forecast.currency) + ' remaining after settlement.' : ''}`;
      }
      return cashReadiness.primaryBlocker ?? 'Not all commitments can be paid from available revenue.';
    }
    case 'commercial_confidence': {
      const { overallConfidence } = forecast;
      if (overallConfidence.level === 'INSUFFICIENT_DATA') return 'Not enough data to calculate confidence.';
      return `${overallConfidence.score}% — ${overallConfidence.summary}`;
    }
  }
}

/* ─── Internal helpers ──────────────────────────────────────────────────────── */

function mapRevenueSourceType(
  sourceType: string,
  status: IncomingRevenueItem['status']
): ExplainabilitySourceType {
  // Status takes priority: a forecast is always a Forecast regardless of source type.
  if (status === 'forecast') return 'Forecast';
  if (status === 'confirmed') return 'Invoice';
  if (sourceType.toLowerCase().includes('invoice')) return 'Invoice';
  return 'Revenue Source';
}

function mapRevenueStatusToStage(status: IncomingRevenueItem['status']): string {
  switch (status) {
    case 'confirmed': return 'Payment Received';
    case 'pending': return 'Awaiting Payment';
    case 'forecast': return 'Forecasted';
    case 'overdue': return 'Overdue';
    case 'at_risk': return 'At Risk';
    default: return 'Pending';
  }
}

function deriveObligationStatus(commitment: CommitmentItem): string {
  if (commitment.funded) return 'Funded';
  if (commitment.status === 'approved') return 'Approved';
  if (commitment.amount == null) return 'Awaiting Invoice';
  return 'Pending';
}

function deriveObligationStage(commitment: CommitmentItem): string {
  if (commitment.funded) return 'Ready for Settlement';
  if (commitment.status === 'approved') return 'Approved';
  return 'Commercial Commitment';
}

function resolveDominantSourceType(items: CommercialBreakdownItem[]): ExplainabilitySourceType {
  const counts: Partial<Record<ExplainabilitySourceType, number>> = {};
  for (const item of items) {
    counts[item.sourceType] = (counts[item.sourceType] ?? 0) + 1;
  }
  let dominant: ExplainabilitySourceType = 'Revenue Source';
  let max = 0;
  for (const [type, count] of Object.entries(counts) as Array<[ExplainabilitySourceType, number]>) {
    if (count > max) { max = count; dominant = type; }
  }
  return dominant;
}
