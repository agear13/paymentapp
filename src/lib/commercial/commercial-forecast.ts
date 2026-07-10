/**
 * Commercial Forecast Engine
 *
 * The single canonical engine that answers: "Can we afford to meet every commercial commitment?"
 *
 * Design rules:
 *   - No page or component may perform forecast calculations independently.
 *   - Every financial figure in the UI must come from deriveCommercialForecast().
 *   - Operator-facing language only. No accounting terminology.
 *   - Results are deterministic — same inputs always produce the same output.
 *
 * Output answers four commercial questions:
 *   1. What money is expected to come in?
 *   2. What commitments must be paid?
 *   3. Are we ahead or behind?
 *   4. What is putting this at risk?
 */

import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';

/* ─── Input ─────────────────────────────────────────────────────────────────── */

export type CommercialForecastInput = {
  /** Individual funding source records for "Money Coming In". */
  fundingSources: ProjectFundingSourceDto[];
  /** Aggregated treasury summary. Used when individual sources aren't available. */
  treasury: ProjectTreasurySummary | null;
  /** Obligation rows representing "Money Going Out". */
  obligationRows: BriefingObligationRowInput[];
  /** Release confidence snapshot for cash readiness signals. */
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  /** The workspace default currency (ISO code). */
  currency: string;
};

/* ─── Commitment categories ─────────────────────────────────────────────────── */

/**
 * Three mutually-exclusive categories for operator comprehension.
 * Operators must immediately know what is fixed, variable, and conditional.
 */
export type CommitmentCategory = 'fixed' | 'revenue_share' | 'conditional';

export type CommitmentItem = {
  id: string;
  participantName: string;
  participantRole: string;
  /** Fixed dollar amount. Null for revenue-share commitments. */
  amount: number | null;
  /** Revenue share percentage. Null for fixed commitments. */
  percentage: number | null;
  /** Human-readable amount label: "$300", "15% of bar revenue", "+$150 if attendance > 500" */
  amountLabel: string;
  category: CommitmentCategory;
  /** The condition that triggers a conditional payment, if any. */
  condition: string | null;
  currency: string;
  status: string;
  /** True if this commitment is backed by confirmed funding. */
  funded: boolean;
};

/* ─── Money Coming In ───────────────────────────────────────────────────────── */

export type IncomingRevenueConfidence = {
  /** 0–100 percentage. */
  score: number;
  /** "95%" or "40%" */
  label: string;
  /**
   * Structured reasons explaining the confidence score.
   * Generated from facts — not AI prose.
   * Each reason has a check/cross icon and a plain-English explanation.
   */
  reasons: ConfidenceReason[];
};

export type ConfidenceReason = {
  positive: boolean;
  label: string;
};

export type IncomingRevenueStatus =
  | 'confirmed'     // money received
  | 'pending'       // payment due, not yet received
  | 'forecast'      // expected but not yet invoiced
  | 'overdue'       // past expected date
  | 'at_risk';      // has risk signals

export type IncomingRevenueItem = {
  id: string;
  /** Customer / Organisation / Grant name */
  sourceName: string;
  /** Human-readable source type */
  sourceType: string;
  amount: number;
  currency: string;
  /** "Expected", "Confirmed", "Forecast", "Overdue" */
  statusLabel: string;
  status: IncomingRevenueStatus;
  expectedDate: string | null;
  confidence: IncomingRevenueConfidence;
  /** True when payment evidence has been linked (invoice/receipt). */
  hasEvidence: boolean;
};

/* ─── Commercial Risks ──────────────────────────────────────────────────────── */

export type CommercialRiskSeverity = 'high' | 'medium' | 'low';

export type CommercialRisk = {
  id: string;
  title: string;
  explanation: string;
  /** What could go wrong commercially if this isn't resolved. */
  consequence: string;
  /** One clear action the operator should take. */
  recommendedAction: string;
  severity: CommercialRiskSeverity;
};

/* ─── Participant payment readiness ─────────────────────────────────────────── */

export type ParticipantReadinessCheck = {
  label: string;
  complete: boolean;
};

export type ParticipantPaymentReadiness = {
  participantId: string;
  participantName: string;
  checks: ParticipantReadinessCheck[];
  /** True when ALL checks are complete. */
  readyForPayment: boolean;
  /** If not ready, the one next action required. */
  nextAction: string | null;
};

/* ─── Forecast Position ─────────────────────────────────────────────────────── */

export type ForecastPositionStatus = 'surplus' | 'deficit' | 'break_even' | 'insufficient_data';

export type ForecastPosition = {
  status: ForecastPositionStatus;
  /** Total expected revenue — all inflows regardless of confidence. */
  totalExpectedRevenue: number;
  /** Only high-confidence confirmed/pending revenue. */
  reliableRevenue: number;
  /** Total commitments (fixed + estimated revenue-share + conditional). */
  totalCommitments: number;
  /** forecastBalance = totalExpectedRevenue - totalCommitments */
  forecastBalance: number;
  /** Positive: surplus. Negative: shortfall. */
  forecastSurplus: number;
  currency: string;
};

/* ─── Cash Readiness ─────────────────────────────────────────────────────────── */

export type CashReadiness = {
  /** Can every commercial commitment be paid? */
  canEveryoneBePaid: boolean;
  /** "Expected balance after settlement" (surplus scenario). */
  expectedBalanceAfterSettlement: number | null;
  /** Absolute value of the deficit (deficit scenario). */
  forecastShortfall: number | null;
  /** Primary reason why payment cannot be made, if applicable. */
  primaryBlocker: string | null;
  currency: string;
};

/* ─── Overall confidence ────────────────────────────────────────────────────── */

export type ForecastConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export type ForecastConfidence = {
  level: ForecastConfidenceLevel;
  score: number;
  summary: string;
};

/* ─── Main output ───────────────────────────────────────────────────────────── */

export type CommercialForecastResult = {
  /* ── Money Coming In ── */
  incomingRevenue: IncomingRevenueItem[];
  totalExpectedRevenue: number;
  confirmedRevenue: number;
  pendingRevenue: number;
  forecastRevenue: number;

  /* ── Money Going Out ── */
  fixedCommitments: CommitmentItem[];
  revenueShareCommitments: CommitmentItem[];
  conditionalCommitments: CommitmentItem[];
  totalCommitments: number;
  totalFixedCommitments: number;
  totalRevenueShareEstimate: number;

  /* ── Position ── */
  forecastPosition: ForecastPosition;

  /* ── Readiness ── */
  cashReadiness: CashReadiness;

  /* ── Risks ── */
  commercialRisks: CommercialRisk[];

  /* ── Overall ── */
  overallConfidence: ForecastConfidence;

  currency: string;
};

/* ─── Engine ────────────────────────────────────────────────────────────────── */

/**
 * The canonical Commercial Forecast engine.
 *
 * Feed it funding sources, obligations, and release confidence — receive the
 * complete forecast view consumed by every UI surface.
 *
 * This is the only function permitted to perform commercial forecast calculations.
 * No component, hook, or page may replicate this logic.
 */
export function deriveCommercialForecast(
  input: CommercialForecastInput
): CommercialForecastResult {
  const { fundingSources, treasury, obligationRows, releaseConfidence, currency } = input;

  /* ── 1. Money Coming In ── */
  const incomingRevenue = deriveIncomingRevenue(fundingSources, treasury, currency);
  const totalExpectedRevenue = incomingRevenue.reduce((s, r) => s + r.amount, 0);
  const confirmedRevenue = incomingRevenue
    .filter((r) => r.status === 'confirmed')
    .reduce((s, r) => s + r.amount, 0);
  const pendingRevenue = incomingRevenue
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + r.amount, 0);
  const forecastRevenue = incomingRevenue
    .filter((r) => r.status === 'forecast')
    .reduce((s, r) => s + r.amount, 0);

  /* ── 2. Money Going Out ── */
  const allCommitments = deriveCommitments(obligationRows, currency);
  const fixedCommitments = allCommitments.filter((c) => c.category === 'fixed');
  const revenueShareCommitments = allCommitments.filter((c) => c.category === 'revenue_share');
  const conditionalCommitments = allCommitments.filter((c) => c.category === 'conditional');

  const totalFixedCommitments = fixedCommitments.reduce((s, c) => s + (c.amount ?? 0), 0);
  const totalRevenueShareEstimate = revenueShareCommitments.reduce((s, c) => s + (c.amount ?? 0), 0);
  const rowsTotalCommitments = totalFixedCommitments + totalRevenueShareEstimate;

  /** Obligations always come from agreement obligation rows — never treasury proxies. */
  const totalCommitments = rowsTotalCommitments;

  /* ── 3. Forecast Position ── */
  const forecastBalance = totalExpectedRevenue - totalCommitments;
  const forecastPosition: ForecastPosition = {
    status:
      totalExpectedRevenue === 0 && totalCommitments === 0
        ? 'insufficient_data'
        : forecastBalance > 0
          ? 'surplus'
          : forecastBalance < 0
            ? 'deficit'
            : 'break_even',
    totalExpectedRevenue,
    reliableRevenue: confirmedRevenue + pendingRevenue,
    totalCommitments,
    forecastBalance,
    forecastSurplus: forecastBalance,
    currency,
  };

  /* ── 4. Cash Readiness ── */
  const cashReadiness = deriveCashReadiness({
    forecastBalance,
    releaseConfidence,
    incomingRevenue,
    currency,
  });

  /* ── 5. Commercial Risks ── */
  const commercialRisks = deriveCommercialRisks({
    incomingRevenue,
    allCommitments,
    releaseConfidence,
    forecastBalance,
    treasury,
  });

  /* ── 6. Overall Confidence ── */
  const overallConfidence = deriveOverallConfidence({
    incomingRevenue,
    forecastBalance,
    commercialRisks,
    releaseConfidence,
  });

  return {
    incomingRevenue,
    totalExpectedRevenue,
    confirmedRevenue,
    pendingRevenue,
    forecastRevenue,
    fixedCommitments,
    revenueShareCommitments,
    conditionalCommitments,
    totalCommitments,
    totalFixedCommitments,
    totalRevenueShareEstimate,
    forecastPosition,
    cashReadiness,
    commercialRisks,
    overallConfidence,
    currency,
  };
}

/* ─── Money Coming In derivation ────────────────────────────────────────────── */

function deriveIncomingRevenue(
  fundingSources: ProjectFundingSourceDto[],
  _treasury: ProjectTreasurySummary | null,
  currency: string
): IncomingRevenueItem[] {
  if (fundingSources.length > 0) {
    return fundingSources.map((source) => ({
      id: source.id,
      sourceName: source.name,
      sourceType: formatSourceType(source.sourceType as string),
      amount: source.amount,
      currency: source.currency || currency,
      statusLabel: formatFundingStatus(source.status as string),
      status: mapFundingStatus(source.status as string),
      expectedDate: source.expectedSettlementDate,
      confidence: deriveSourceConfidence(source),
      hasEvidence: Boolean(source.linkedInvoiceId || source.linkedPaymentId),
    }));
  }

  // Revenue only originates from actual revenue sources — no treasury aggregate fallback.
  return [];
}

function formatSourceType(sourceType: string): string {
  const MAP: Record<string, string> = {
    REVENUE: 'Revenue',
    GRANT: 'Grant',
    SPONSORSHIP: 'Sponsorship',
    INVESTMENT: 'Investment',
    DEPOSIT: 'Deposit',
    CUSTOMER_PAYMENT: 'Customer payment',
    TICKET_SALES: 'Ticket sales',
    SUBSCRIPTION: 'Subscription',
    DONATION: 'Donation',
    OTHER: 'Other',
  };
  return MAP[sourceType] ?? sourceType;
}

function formatFundingStatus(status: string): string {
  const MAP: Record<string, string> = {
    CONFIRMED: 'Confirmed',
    PENDING: 'Awaiting payment',
    RECEIVED: 'Received',
    FORECAST: 'Forecast',
    OVERDUE: 'Overdue',
    CANCELLED: 'Cancelled',
    DRAFT: 'Draft',
    CLEARED: 'Cleared',
  };
  return MAP[status] ?? status;
}

function mapFundingStatus(status: string): IncomingRevenueStatus {
  switch (status) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'CLEARED':
      return 'confirmed';
    case 'OVERDUE':
      return 'overdue';
    case 'FORECAST':
    case 'DRAFT':
      return 'forecast';
    case 'PENDING':
    default:
      return 'pending';
  }
}

function deriveSourceConfidence(source: ProjectFundingSourceDto): IncomingRevenueConfidence {
  const reasons: ConfidenceReason[] = [];
  const level = source.confidenceLevel as string;

  // Evidence signals
  if (source.linkedInvoiceId) {
    reasons.push({ positive: true, label: 'Invoice linked' });
  }
  if (source.linkedPaymentId) {
    reasons.push({ positive: true, label: 'Payment receipt linked' });
  }
  if (source.expectedSettlementDate) {
    reasons.push({ positive: true, label: 'Payment date confirmed' });
  } else {
    reasons.push({ positive: false, label: 'No confirmed payment date' });
  }

  // Status signals
  const status = source.status as string;
  if (status === 'RECEIVED' || status === 'CLEARED' || status === 'CONFIRMED') {
    reasons.push({ positive: true, label: 'Payment confirmed' });
  } else if (status === 'OVERDUE') {
    reasons.push({ positive: false, label: 'Payment is overdue' });
  } else if (status === 'FORECAST') {
    reasons.push({ positive: false, label: 'Revenue expected but not yet invoiced' });
  }

  // Notes signal
  if (source.notes) {
    reasons.push({ positive: true, label: 'Supporting notes on file' });
  }

  // Map Prisma confidence level → score
  let score: number;
  switch (level) {
    case 'HIGH':   score = 90; break;
    case 'MEDIUM': score = 60; break;
    case 'LOW':    score = 30; break;
    default:       score = 50;
  }

  // Adjust by status
  if (status === 'RECEIVED' || status === 'CLEARED') score = Math.max(score, 95);
  else if (status === 'OVERDUE') score = Math.min(score, 40);
  else if (status === 'FORECAST') score = Math.min(score, 45);
  else if (source.linkedInvoiceId || source.linkedPaymentId) score = Math.max(score, 70);

  return {
    score,
    label: `${score}%`,
    reasons,
  };
}

/* ─── Money Going Out derivation ─────────────────────────────────────────────── */

function deriveCommitments(
  obligationRows: BriefingObligationRowInput[],
  currency: string
): CommitmentItem[] {
  return obligationRows.map((row, idx) => {
    const amount = parseObligationAmount(row.amount_owed);
    const category = classifyCommitment(row.obligation_type);
    const participantName = row.participant?.name ?? 'Unknown';
    const participantRole = row.participant?.role ?? '';

    const amountLabel = buildAmountLabel(category, amount, row.obligation_type, currency, row.currency);

    return {
      id: row.id ?? `commitment-${idx}`,
      participantName,
      participantRole,
      amount: category === 'revenue_share' ? null : amount,
      percentage: category === 'revenue_share' ? extractPercentage(row.obligation_type) : null,
      amountLabel,
      category,
      condition: category === 'conditional' ? extractCondition(row.obligation_type) : null,
      currency: row.currency || currency,
      status: row.status,
      funded: row.status === 'FUNDED' || row.status === 'PAID' || row.status === 'RELEASE_READY',
    };
  });
}

function parseObligationAmount(amount_owed: unknown): number {
  if (typeof amount_owed === 'number') return amount_owed;
  if (typeof amount_owed === 'string') return parseFloat(amount_owed) || 0;
  return 0;
}

function classifyCommitment(obligationType: string): CommitmentCategory {
  const type = obligationType?.toLowerCase() ?? '';
  if (type.includes('revenue_share') || type.includes('percentage') || type.includes('commission')) {
    return 'revenue_share';
  }
  if (type.includes('conditional') || type.includes('bonus') || type.includes('milestone')) {
    return 'conditional';
  }
  return 'fixed';
}

function buildAmountLabel(
  category: CommitmentCategory,
  amount: number,
  obligationType: string,
  defaultCurrency: string,
  currency: string
): string {
  const curr = currency || defaultCurrency;
  if (category === 'revenue_share') {
    const pct = extractPercentage(obligationType);
    if (pct) return `${pct}% of revenue`;
    if (amount > 0) return `${curr} ${amount.toLocaleString()}`;
    return 'Revenue share';
  }
  if (category === 'conditional') {
    const cond = extractCondition(obligationType);
    if (amount > 0 && cond) return `+${curr} ${amount.toLocaleString()} ${cond}`;
    if (amount > 0) return `+${curr} ${amount.toLocaleString()} (conditional)`;
    return 'Conditional payment';
  }
  if (amount > 0) return `${curr} ${amount.toLocaleString()}`;
  return 'Amount TBC';
}

function extractPercentage(obligationType: string): number | null {
  const match = obligationType?.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : null;
}

function extractCondition(obligationType: string): string | null {
  const lower = obligationType?.toLowerCase() ?? '';
  if (lower.includes('attendance')) return 'if attendance target met';
  if (lower.includes('milestone')) return 'on milestone completion';
  if (lower.includes('approval')) return 'on approval';
  return null;
}

/* ─── Cash Readiness ─────────────────────────────────────────────────────────── */

function deriveCashReadiness(input: {
  forecastBalance: number;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  incomingRevenue: IncomingRevenueItem[];
  currency: string;
}): CashReadiness {
  const { forecastBalance, releaseConfidence, incomingRevenue, currency } = input;

  const hasRevenueSources = incomingRevenue.length > 0;
  const revenueCoversObligations = forecastBalance >= 0;
  const settlementBlockersCleared =
    (releaseConfidence?.heldBackReasons?.length ?? 0) === 0 &&
    releaseConfidence?.level !== 'BLOCKED';

  const canEveryoneBePaid =
    hasRevenueSources && revenueCoversObligations && settlementBlockersCleared;

  // Derive primary blocker
  let primaryBlocker: string | null = null;

  if (!hasRevenueSources) {
    primaryBlocker = 'No revenue sources connected. Add invoices or payment links to begin collecting revenue.';
  } else if (!revenueCoversObligations) {
    // Identify the biggest unconfirmed revenue item
    const overdueItems = incomingRevenue.filter((r) => r.status === 'overdue');
    const forecastItems = incomingRevenue.filter((r) => r.status === 'forecast');

    if (overdueItems.length > 0) {
      primaryBlocker = `${overdueItems[0].sourceName} payment is overdue.`;
    } else if (forecastItems.length > 0) {
      primaryBlocker = `${forecastItems[0].sourceName} revenue is not yet confirmed.`;
    } else if (releaseConfidence?.heldBackReasons?.[0]) {
      primaryBlocker = releaseConfidence.heldBackReasons[0];
    } else {
      primaryBlocker = 'Insufficient confirmed revenue to cover all commitments.';
    }
  } else if (!settlementBlockersCleared) {
    primaryBlocker =
      releaseConfidence?.heldBackReasons?.[0] ??
      'Settlement blockers must be resolved before payments can be released.';
  }

  return {
    canEveryoneBePaid,
    expectedBalanceAfterSettlement: canEveryoneBePaid ? forecastBalance : null,
    forecastShortfall: !canEveryoneBePaid ? Math.abs(forecastBalance) : null,
    primaryBlocker,
    currency,
  };
}

/* ─── Commercial Risks ─────────────────────────────────────────────────────────── */

function deriveCommercialRisks(input: {
  incomingRevenue: IncomingRevenueItem[];
  allCommitments: CommitmentItem[];
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  forecastBalance: number;
  treasury: ProjectTreasurySummary | null;
}): CommercialRisk[] {
  const { incomingRevenue, allCommitments, releaseConfidence, forecastBalance, treasury } = input;
  const risks: CommercialRisk[] = [];

  // Risk: overdue payment
  const overdueRevenue = incomingRevenue.filter((r) => r.status === 'overdue');
  for (const item of overdueRevenue) {
    risks.push({
      id: `overdue-${item.id}`,
      title: `${item.sourceName} payment overdue`,
      explanation: `Payment of ${item.currency} ${item.amount.toLocaleString()} from ${item.sourceName} has passed its expected date.`,
      consequence: 'Settlement cannot proceed until this payment is received.',
      recommendedAction: `Contact ${item.sourceName} to confirm payment status.`,
      severity: 'high',
    });
  }

  // Risk: low-confidence revenue sources
  const lowConfidenceRevenue = incomingRevenue.filter(
    (r) => r.confidence.score < 50 && r.status !== 'confirmed'
  );
  for (const item of lowConfidenceRevenue) {
    risks.push({
      id: `low-confidence-${item.id}`,
      title: `${item.sourceName} revenue not confirmed`,
      explanation: `This revenue source has low confidence (${item.confidence.label}). ${item.confidence.reasons.filter((r) => !r.positive).map((r) => r.label).join('. ')}.`,
      consequence: 'Settlement could be delayed if this revenue does not arrive on time.',
      recommendedAction: `Upload payment evidence for ${item.sourceName} to increase confidence.`,
      severity: 'medium',
    });
  }

  // Risk: forecast shortfall
  if (forecastBalance < 0) {
    risks.push({
      id: 'forecast-shortfall',
      title: 'Forecast shortfall',
      explanation: `Expected revenue is ${Math.abs(forecastBalance).toLocaleString()} short of total commitments.`,
      consequence: 'Not all commercial commitments can be paid at settlement.',
      recommendedAction: 'Add confirmed revenue sources or review commitment amounts.',
      severity: 'high',
    });
  }

  // Risk: conditional bonuses (make operators aware)
  const conditional = allCommitments.filter((c) => c.category === 'conditional');
  if (conditional.length > 0) {
    const totalConditional = conditional.reduce((s, c) => s + (c.amount ?? 0), 0);
    if (totalConditional > 0) {
      risks.push({
        id: 'conditional-payments',
        title: `${conditional.length} conditional payment${conditional.length > 1 ? 's' : ''} may trigger`,
        explanation: `${conditional.map((c) => c.participantName).join(', ')} ${conditional.length > 1 ? 'have' : 'has'} conditional payments that activate if trigger conditions are met.`,
        consequence: 'Actual commitments may be higher than the current forecast.',
        recommendedAction: 'Confirm whether trigger conditions have been met before releasing settlement.',
        severity: 'medium',
      });
    }
  }

  // Risk: settlement blockers from release confidence
  if (releaseConfidence?.heldBackReasons && releaseConfidence.heldBackReasons.length > 0) {
    for (const reason of releaseConfidence.heldBackReasons.slice(0, 3)) {
      risks.push({
        id: `held-back-${reason.slice(0, 20)}`,
        title: 'Settlement held back',
        explanation: reason,
        consequence: 'Payments cannot be released until this is resolved.',
        recommendedAction: 'Review and resolve the settlement blocker.',
        severity: 'high',
      });
    }
  }

  // Risk: forecast-heavy treasury
  if (treasury?.projectHealth === 'forecast_heavy') {
    risks.push({
      id: 'forecast-heavy',
      title: 'Revenue relies heavily on unconfirmed sources',
      explanation: 'Most expected revenue is based on forecasts rather than confirmed payments.',
      consequence: 'If forecasted revenue does not arrive, settlement may be delayed.',
      recommendedAction: 'Chase outstanding payments and request remittance advice.',
      severity: 'medium',
    });
  }

  // Risk: missing invoices (inferred from unfunded commitments)
  const unfundedCommitments = allCommitments.filter((c) => !c.funded && c.category === 'fixed');
  if (unfundedCommitments.length > 0) {
    const names = unfundedCommitments.map((c) => c.participantName).join(', ');
    risks.push({
      id: 'missing-invoices',
      title: `Invoice${unfundedCommitments.length > 1 ? 's' : ''} outstanding`,
      explanation: `${names} ${unfundedCommitments.length > 1 ? 'have' : 'has'} unfunded obligations awaiting payment.`,
      consequence: 'Payment cannot be released until funding is confirmed.',
      recommendedAction: `Request invoice${unfundedCommitments.length > 1 ? 's' : ''} from ${names}.`,
      severity: 'medium',
    });
  }

  // Sort: high severity first
  return risks.sort((a, b) => {
    const order: Record<CommercialRiskSeverity, number> = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

/* ─── Overall Confidence ─────────────────────────────────────────────────────── */

function deriveOverallConfidence(input: {
  incomingRevenue: IncomingRevenueItem[];
  forecastBalance: number;
  commercialRisks: CommercialRisk[];
  releaseConfidence: ReleaseConfidenceSnapshot | null;
}): ForecastConfidence {
  const { incomingRevenue, forecastBalance, commercialRisks, releaseConfidence } = input;

  if (incomingRevenue.length === 0) {
    return {
      level: 'INSUFFICIENT_DATA',
      score: 0,
      summary: 'No revenue sources have been added yet.',
    };
  }

  const highRisks = commercialRisks.filter((r) => r.severity === 'high').length;
  const avgConfidence =
    incomingRevenue.reduce((s, r) => s + r.confidence.score, 0) / incomingRevenue.length;

  let score = avgConfidence;
  score -= highRisks * 15;
  if (forecastBalance < 0) score -= 20;
  if (releaseConfidence?.level === 'BLOCKED') score -= 25;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level: ForecastConfidenceLevel =
    score >= 80 ? 'HIGH' : score >= 55 ? 'MEDIUM' : score >= 30 ? 'LOW' : 'INSUFFICIENT_DATA';

  const summary =
    forecastBalance < 0
      ? 'Revenue is insufficient to cover all commitments.'
      : highRisks > 0
        ? `${highRisks} high-priority commercial risk${highRisks > 1 ? 's' : ''} require attention.`
        : avgConfidence >= 80
          ? 'Revenue is well-confirmed and commitments are covered.'
          : 'Some revenue sources need confirmation before settlement can proceed.';

  return { level, score, summary };
}

/* ─── Formatting helpers ─────────────────────────────────────────────────────── */

/**
 * Formats a dollar amount with currency symbol for display.
 * Uses operator-friendly formatting (no accounting cents for large amounts).
 */
export function formatForecastAmount(amount: number, currency: string): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount >= 1000
    ? absAmount.toLocaleString('en-AU', { maximumFractionDigits: 0 })
    : absAmount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = amount < 0 ? '-' : '';
  return `${sign}${currency} ${formatted}`;
}

/**
 * Returns "Expected balance: +$39,000" or "Shortfall: -$4,600" label.
 */
export function formatForecastBalance(balance: number, currency: string): string {
  if (balance >= 0) {
    return `+${formatForecastAmount(balance, currency)}`;
  }
  return formatForecastAmount(balance, currency);
}

/**
 * Returns a Provvy-ready narrative for the commercial forecast.
 * Answers "Can we afford to pay everyone?" in plain language.
 */
export function buildForecastProvvyNarrative(result: CommercialForecastResult): string {
  const { cashReadiness, forecastPosition, commercialRisks } = result;
  const curr = result.currency;

  const highRisks = commercialRisks.filter((r) => r.severity === 'high');

  if (forecastPosition.status === 'insufficient_data') {
    return 'No revenue sources have been added yet. Add expected revenue to begin forecasting commercial readiness.';
  }

  const lines: string[] = [];

  if (cashReadiness.canEveryoneBePaid) {
    lines.push('Yes.');
    lines.push('');
    lines.push(`Expected revenue: ${formatForecastAmount(forecastPosition.totalExpectedRevenue, curr)}`);
    lines.push(`Expected commitments: ${formatForecastAmount(forecastPosition.totalCommitments, curr)}`);
    lines.push(`Forecast surplus: ${formatForecastAmount(forecastPosition.forecastSurplus, curr)}`);
    if (highRisks.length > 0) {
      lines.push('');
      lines.push(`The primary commercial risk is: ${highRisks[0].title.toLowerCase()}.`);
    }
  } else {
    lines.push('No.');
    lines.push('');
    lines.push(`Forecast shortfall: ${formatForecastAmount(Math.abs(forecastPosition.forecastBalance), curr)}`);
    if (cashReadiness.primaryBlocker) {
      lines.push('');
      lines.push(cashReadiness.primaryBlocker);
    }
    if (highRisks.length > 0) {
      lines.push('');
      lines.push(`Resolve the highest-priority risk to unblock settlement: ${highRisks[0].recommendedAction.toLowerCase()}`);
    }
  }

  return lines.join('\n');
}
