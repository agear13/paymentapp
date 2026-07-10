/**
 * Commercial Financial Snapshot
 *
 * Single source of truth for every financial widget across the application.
 * Dashboard and Agreement Overview must both consume this service — no surface
 * may synthesize its own treasury, revenue, or obligation figures.
 *
 * Rules enforced here:
 *   - Revenue only from actual revenue sources (invoices, payment links, rails).
 *   - No treasury-aggregate revenue fallback.
 *   - Obligations only from agreement obligation rows.
 *   - Net Forecast = Revenue − Obligations.
 *   - Cash Readiness = revenue covers obligations AND settlement blockers cleared.
 *   - Settlement widgets derive from the same forecast + release confidence inputs.
 */

import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type { CommercialDecisionResult } from '@/components/workflow/commercial-decision-engine';
import {
  deriveCommercialForecast,
  type CommercialForecastInput,
  type CommercialForecastResult,
} from '@/lib/commercial/commercial-forecast';
import {
  deriveCommercialHealth,
  type CommercialHealthScore,
} from '@/lib/commercial/commercial-health';
import type { ProjectFundingSourceDto, ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';

/* ─── Settlement metrics ─────────────────────────────────────────────────────── */

export type CommercialSettlementMetrics = {
  /** Total expected revenue from actual revenue sources. */
  availableRevenue: number;
  /** Revenue expected but not yet collected (pending + forecast sources). */
  waitingToCollect: number;
  /** Collected funds held back from release. */
  moneyUnderReview: number;
  /** Funds cleared and ready to release to participants. */
  readyToRelease: number;
  /** Obligations awaiting approval or funding. */
  waitingForApprovals: number;
  /** Whether settlement prerequisites are met (no blockers, funding aligned). */
  settlementReadiness: boolean;
  currency: string;
};

/* ─── Snapshot ───────────────────────────────────────────────────────────────── */

export type CommercialFinancialSnapshot = {
  forecast: CommercialForecastResult;
  health: CommercialHealthScore;
  settlement: CommercialSettlementMetrics;
  currency: string;
  projectId: string | null;
  dealId: string | null;
  hasRevenueSources: boolean;
};

export type DeriveCommercialFinancialSnapshotInput = {
  projectId?: string | null;
  dealId?: string | null;
  fundingSources: ProjectFundingSourceDto[];
  treasury: ProjectTreasurySummary | null;
  obligationRows: BriefingObligationRowInput[];
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  currency: string;
  kpis?: OperationalKPIs | null;
  decision?: CommercialDecisionResult | null;
};

/**
 * Derives the unified commercial financial snapshot consumed by every UI surface.
 */
export function deriveCommercialFinancialSnapshot(
  input: DeriveCommercialFinancialSnapshotInput
): CommercialFinancialSnapshot {
  const forecastInput: CommercialForecastInput = {
    fundingSources: input.fundingSources,
    treasury: input.treasury,
    obligationRows: input.obligationRows,
    releaseConfidence: input.releaseConfidence,
    currency: input.currency,
  };

  const forecast = deriveCommercialForecast(forecastInput);
  const health = deriveCommercialHealth(
    forecast,
    input.decision ?? null,
    input.kpis ?? null
  );
  const settlement = deriveSettlementMetrics(forecast, input.releaseConfidence);

  return {
    forecast,
    health,
    settlement,
    currency: input.currency,
    projectId: input.projectId ?? null,
    dealId: input.dealId ?? null,
    hasRevenueSources: forecast.incomingRevenue.length > 0,
  };
}

/**
 * Aggregates per-agreement snapshots into a workspace-level view.
 * Used when the dashboard spans multiple agreements.
 */
export function aggregateCommercialFinancialSnapshots(
  snapshots: CommercialFinancialSnapshot[],
  currency: string
): CommercialFinancialSnapshot | null {
  if (snapshots.length === 0) return null;
  if (snapshots.length === 1) return snapshots[0];

  const emptyForecast = deriveCommercialForecast({
    fundingSources: [],
    treasury: null,
    obligationRows: [],
    releaseConfidence: null,
    currency,
  });

  const aggregatedForecast: CommercialForecastResult = {
    ...emptyForecast,
    incomingRevenue: snapshots.flatMap((s) => s.forecast.incomingRevenue),
    fixedCommitments: snapshots.flatMap((s) => s.forecast.fixedCommitments),
    revenueShareCommitments: snapshots.flatMap((s) => s.forecast.revenueShareCommitments),
    conditionalCommitments: snapshots.flatMap((s) => s.forecast.conditionalCommitments),
    commercialRisks: snapshots.flatMap((s) => s.forecast.commercialRisks),
    totalExpectedRevenue: snapshots.reduce((sum, s) => sum + s.forecast.totalExpectedRevenue, 0),
    confirmedRevenue: snapshots.reduce((sum, s) => sum + s.forecast.confirmedRevenue, 0),
    pendingRevenue: snapshots.reduce((sum, s) => sum + s.forecast.pendingRevenue, 0),
    forecastRevenue: snapshots.reduce((sum, s) => sum + s.forecast.forecastRevenue, 0),
    totalCommitments: snapshots.reduce((sum, s) => sum + s.forecast.totalCommitments, 0),
    totalFixedCommitments: snapshots.reduce((sum, s) => sum + s.forecast.totalFixedCommitments, 0),
    totalRevenueShareEstimate: snapshots.reduce(
      (sum, s) => sum + s.forecast.totalRevenueShareEstimate,
      0
    ),
    forecastPosition: {
      ...emptyForecast.forecastPosition,
      totalExpectedRevenue: snapshots.reduce(
        (sum, s) => sum + s.forecast.forecastPosition.totalExpectedRevenue,
        0
      ),
      totalCommitments: snapshots.reduce(
        (sum, s) => sum + s.forecast.forecastPosition.totalCommitments,
        0
      ),
      forecastBalance: snapshots.reduce(
        (sum, s) => sum + s.forecast.forecastPosition.forecastBalance,
        0
      ),
      forecastSurplus: snapshots.reduce(
        (sum, s) => sum + s.forecast.forecastPosition.forecastSurplus,
        0
      ),
      reliableRevenue: snapshots.reduce(
        (sum, s) => sum + s.forecast.forecastPosition.reliableRevenue,
        0
      ),
      status: resolveAggregatedPositionStatus(snapshots),
      currency,
    },
    cashReadiness: deriveAggregatedCashReadiness(snapshots, currency),
    overallConfidence: deriveAggregatedConfidence(snapshots),
    currency,
  };

  const settlement: CommercialSettlementMetrics = {
    availableRevenue: snapshots.reduce((sum, s) => sum + s.settlement.availableRevenue, 0),
    waitingToCollect: snapshots.reduce((sum, s) => sum + s.settlement.waitingToCollect, 0),
    moneyUnderReview: snapshots.reduce((sum, s) => sum + s.settlement.moneyUnderReview, 0),
    readyToRelease: snapshots.reduce((sum, s) => sum + s.settlement.readyToRelease, 0),
    waitingForApprovals: snapshots.reduce((sum, s) => sum + s.settlement.waitingForApprovals, 0),
    settlementReadiness: snapshots.every((s) => s.settlement.settlementReadiness),
    currency,
  };

  const health = deriveCommercialHealth(aggregatedForecast, null, null);

  return {
    forecast: aggregatedForecast,
    health,
    settlement,
    currency,
    projectId: null,
    dealId: null,
    hasRevenueSources: snapshots.some((s) => s.hasRevenueSources),
  };
}

/* ─── Settlement derivation ────────────────────────────────────────────────────── */

function deriveSettlementMetrics(
  forecast: CommercialForecastResult,
  releaseConfidence: ReleaseConfidenceSnapshot | null
): CommercialSettlementMetrics {
  const currency = forecast.currency;
  const hasRevenueSources = forecast.incomingRevenue.length > 0;

  const availableRevenue = hasRevenueSources ? forecast.totalExpectedRevenue : 0;
  const waitingToCollect = hasRevenueSources
    ? forecast.pendingRevenue + forecast.forecastRevenue
    : 0;

  const moneyUnderReview = hasRevenueSources ? (releaseConfidence?.heldBack ?? 0) : 0;
  const readyToRelease = hasRevenueSources ? (releaseConfidence?.readyToRelease ?? 0) : 0;
  const waitingForApprovals = forecast.totalCommitments;

  const settlementBlockersCleared =
    (releaseConfidence?.heldBackReasons?.length ?? 0) === 0 &&
    releaseConfidence?.level !== 'BLOCKED';

  const settlementReadiness =
    hasRevenueSources &&
    forecast.cashReadiness.canEveryoneBePaid &&
    settlementBlockersCleared;

  return {
    availableRevenue,
    waitingToCollect,
    moneyUnderReview,
    readyToRelease,
    waitingForApprovals,
    settlementReadiness,
    currency,
  };
}

function resolveAggregatedPositionStatus(
  snapshots: CommercialFinancialSnapshot[]
): CommercialForecastResult['forecastPosition']['status'] {
  const totalRevenue = snapshots.reduce((sum, s) => sum + s.forecast.totalExpectedRevenue, 0);
  const totalCommitments = snapshots.reduce((sum, s) => sum + s.forecast.totalCommitments, 0);

  if (totalRevenue === 0 && totalCommitments === 0) return 'insufficient_data';
  const balance = totalRevenue - totalCommitments;
  if (balance > 0) return 'surplus';
  if (balance < 0) return 'deficit';
  return 'break_even';
}

function deriveAggregatedCashReadiness(
  snapshots: CommercialFinancialSnapshot[],
  currency: string
): CommercialForecastResult['cashReadiness'] {
  const canEveryoneBePaid = snapshots.every((s) => s.forecast.cashReadiness.canEveryoneBePaid);
  const totalBalance = snapshots.reduce(
    (sum, s) => sum + s.forecast.forecastPosition.forecastBalance,
    0
  );

  return {
    canEveryoneBePaid,
    expectedBalanceAfterSettlement: canEveryoneBePaid ? totalBalance : null,
    forecastShortfall: !canEveryoneBePaid ? Math.abs(Math.min(0, totalBalance)) : null,
    primaryBlocker: canEveryoneBePaid
      ? null
      : snapshots.find((s) => s.forecast.cashReadiness.primaryBlocker)?.forecast.cashReadiness
          .primaryBlocker ?? 'One or more agreements have insufficient revenue.',
    currency,
  };
}

function deriveAggregatedConfidence(
  snapshots: CommercialFinancialSnapshot[]
): CommercialForecastResult['overallConfidence'] {
  if (snapshots.length === 0) {
    return { level: 'INSUFFICIENT_DATA', score: 0, summary: 'No commercial data available.' };
  }

  const avgScore = Math.round(
    snapshots.reduce((sum, s) => sum + s.forecast.overallConfidence.score, 0) / snapshots.length
  );

  const level =
    avgScore >= 80
      ? 'HIGH'
      : avgScore >= 55
        ? 'MEDIUM'
        : avgScore >= 30
          ? 'LOW'
          : 'INSUFFICIENT_DATA';

  return {
    level,
    score: avgScore,
    summary: `Aggregated confidence across ${snapshots.length} agreement${snapshots.length !== 1 ? 's' : ''}.`,
  };
}
