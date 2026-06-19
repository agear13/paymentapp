/**
 * Commercial Health
 *
 * A single `CommercialHealthScore` that combines all Commercial OS signals:
 *   - Forecast confidence (are we funded?)
 *   - Workflow completeness (how far through the lifecycle?)
 *   - Agreement completeness (participants, earnings, approvals)
 *   - Settlement readiness (can we release payments?)
 *   - Revenue certainty (how confirmed is our income?)
 *
 * Design rules:
 *   - Reads ONLY from `CommercialForecastResult` and `CommercialDecisionResult`.
 *   - No independent calculations — consumes existing engine outputs.
 *   - Deterministic: same inputs → same score.
 *   - One score. No duplication across components.
 */

import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';
import type { CommercialDecisionResult } from '@/components/workflow/commercial-decision-engine';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export type CommercialHealthLevel = 'excellent' | 'good' | 'attention' | 'at_risk' | 'blocked';

export type CommercialHealthDimension = {
  name: string;
  /** 0–100 score for this dimension. */
  score: number;
  /** Human-readable status. */
  status: string;
  /** True when this dimension requires operator action. */
  requiresAction: boolean;
  /** One recommended action if this dimension is weak. */
  recommendedAction: string | null;
};

export type CommercialHealthScore = {
  /** Overall 0–100 health score. */
  score: number;
  /** Human-readable health level. */
  level: CommercialHealthLevel;
  /** Short summary for operators. e.g. "Agreement is on track for settlement." */
  summary: string;
  /** Individual health dimension scores. */
  dimensions: CommercialHealthDimension[];
  /** True when the agreement is commercially operational (all settled). */
  isOperational: boolean;
  /** The single most important action the operator should take. */
  primaryAction: string | null;
};

/* ─── Main function ─────────────────────────────────────────────────────────── */

/**
 * Derive the Commercial Health Score from all active Commercial OS engines.
 *
 * This is the only function permitted to aggregate cross-module health signals.
 * No component or page may construct its own composite health score.
 *
 * @param forecast  Output of `deriveCommercialForecast()`. Pass null when not yet loaded.
 * @param decision  Output of `analyseWorkspace()`. Pass null when not yet loaded.
 * @param kpis      KPIs from `useOperationalCoordinationState()`. Pass null when not yet loaded.
 */
export function deriveCommercialHealth(
  forecast: CommercialForecastResult | null,
  decision: CommercialDecisionResult | null,
  kpis: OperationalKPIs | null
): CommercialHealthScore {
  if (!forecast && !decision && !kpis) {
    return {
      score: 0,
      level: 'blocked',
      summary: 'Commercial data is loading.',
      dimensions: [],
      isOperational: false,
      primaryAction: null,
    };
  }

  const dimensions: CommercialHealthDimension[] = [
    deriveForecastDimension(forecast),
    deriveRevenueCertaintyDimension(forecast),
    deriveAgreementCompletenessDimension(kpis, decision),
    deriveWorkflowDimension(decision),
    deriveSettlementReadinessDimension(decision, forecast),
  ];

  const score = weightedScore(dimensions);
  const level = scoreToLevel(score, dimensions);
  const isOperational = decision?.workflowStage === 'operational' || false;
  const primaryAction = derivePrimaryAction(dimensions, decision);
  const summary = buildSummary(level, isOperational, forecast, decision, kpis);

  return {
    score,
    level,
    summary,
    dimensions,
    isOperational,
    primaryAction,
  };
}

/* ─── Dimension derivations ─────────────────────────────────────────────────── */

function deriveForecastDimension(forecast: CommercialForecastResult | null): CommercialHealthDimension {
  if (!forecast || forecast.totalExpectedRevenue === 0) {
    return {
      name: 'Forecast',
      score: 0,
      status: 'No revenue sources added',
      requiresAction: true,
      recommendedAction: 'Add expected revenue sources to the commercial forecast.',
    };
  }

  const isPositive = forecast.forecastPosition.status === 'surplus';
  const isBreakEven = forecast.forecastPosition.status === 'break_even';
  const isDeficit = forecast.forecastPosition.status === 'deficit';
  const confidenceScore = forecast.overallConfidence.score;

  let score = confidenceScore;
  if (isDeficit) score = Math.min(score, 30);
  else if (isBreakEven) score = Math.min(score, 60);
  else if (isPositive) score = Math.max(score, 50);

  const status = isDeficit
    ? `Shortfall: ${forecast.currency} ${Math.abs(forecast.forecastPosition.forecastBalance).toLocaleString()}`
    : isBreakEven
      ? 'Revenue exactly covers commitments'
      : `Surplus: ${forecast.currency} ${forecast.forecastPosition.forecastSurplus.toLocaleString()}`;

  return {
    name: 'Forecast',
    score,
    status,
    requiresAction: isDeficit || score < 50,
    recommendedAction:
      isDeficit
        ? 'Add confirmed revenue sources or review commitment amounts.'
        : score < 50
          ? 'Confirm pending revenue sources to improve forecast confidence.'
          : null,
  };
}

function deriveRevenueCertaintyDimension(forecast: CommercialForecastResult | null): CommercialHealthDimension {
  if (!forecast || forecast.incomingRevenue.length === 0) {
    return {
      name: 'Revenue Certainty',
      score: 0,
      status: 'No revenue sources',
      requiresAction: true,
      recommendedAction: 'Add revenue sources to the commercial forecast.',
    };
  }

  const total = forecast.totalExpectedRevenue;
  const confirmed = forecast.confirmedRevenue;
  const pending = forecast.pendingRevenue;

  if (total === 0) {
    return { name: 'Revenue Certainty', score: 0, status: 'No expected revenue', requiresAction: true, recommendedAction: null };
  }

  const confirmedPct = (confirmed / total) * 100;
  const pendingPct = (pending / total) * 100;
  const score = Math.round(confirmedPct * 0.8 + pendingPct * 0.4);

  const highRisks = forecast.commercialRisks.filter((r) => r.severity === 'high').length;

  return {
    name: 'Revenue Certainty',
    score: Math.max(0, Math.min(100, score - highRisks * 10)),
    status:
      confirmedPct >= 80
        ? `${Math.round(confirmedPct)}% confirmed`
        : `${Math.round(confirmedPct)}% confirmed, ${Math.round(pendingPct)}% pending`,
    requiresAction: confirmedPct < 50,
    recommendedAction:
      confirmedPct < 50
        ? 'Upload payment evidence to confirm pending revenue sources.'
        : null,
  };
}

function deriveAgreementCompletenessDimension(
  kpis: OperationalKPIs | null,
  decision: CommercialDecisionResult | null
): CommercialHealthDimension {
  if (!kpis) {
    return {
      name: 'Agreement Completeness',
      score: 50,
      status: 'Not yet assessed',
      requiresAction: false,
      recommendedAction: null,
    };
  }

  const caps = decision?.commercialCapabilities;
  const checks = [
    kpis.participantCount > 0,                    // participants added
    kpis.earningsConfiguredCount >= kpis.participantCount && kpis.participantCount > 0, // earnings configured
    kpis.approvedAgreementCount >= kpis.participantCount && kpis.participantCount > 0,  // all approved
    caps?.paymentProviderConnected === true,       // payment provider
    caps?.revenueCollectionEnabled === true,       // revenue enabled
  ];

  const completed = checks.filter(Boolean).length;
  const score = Math.round((completed / checks.length) * 100);

  const status =
    score === 100
      ? 'All requirements met'
      : `${completed} of ${checks.length} steps complete`;

  const recommendedAction = !checks[0]
    ? 'Add participants to the agreement.'
    : !checks[1]
      ? 'Configure earnings for all participants.'
      : !checks[2]
        ? 'Collect participant approvals.'
        : !checks[3]
          ? 'Connect a payment provider.'
          : !checks[4]
            ? 'Enable revenue collection.'
            : null;

  return {
    name: 'Agreement Completeness',
    score,
    status,
    requiresAction: score < 100,
    recommendedAction,
  };
}

function deriveWorkflowDimension(decision: CommercialDecisionResult | null): CommercialHealthDimension {
  if (!decision) {
    return {
      name: 'Workflow',
      score: 50,
      status: 'Not yet assessed',
      requiresAction: false,
      recommendedAction: null,
    };
  }

  const stageScores: Record<string, number> = {
    not_started: 5,
    extraction_review: 15,
    participants_config: 25,
    earnings_config: 40,
    collecting_approvals: 55,
    payment_provider: 65,
    collecting_revenue: 75,
    settlement_review: 85,
    ready_to_release: 92,
    collecting_revenue_post_approval: 70,
    settlement_blocked: 60,
    ready_to_collect: 75,
    operational: 100,
  };

  const stage = decision.workflowStage ?? 'not_started';
  const score = stageScores[stage] ?? 50;

  return {
    name: 'Workflow',
    score,
    status: decision.nextStep ?? stage.replace(/_/g, ' '),
    requiresAction: score < 100 && Boolean(decision.recommendedAction),
    recommendedAction: decision.recommendedAction
      ? decision.recommendedAction.explanation
      : null,
  };
}

function deriveSettlementReadinessDimension(
  decision: CommercialDecisionResult | null,
  forecast: CommercialForecastResult | null
): CommercialHealthDimension {
  if (!decision) {
    return {
      name: 'Settlement Readiness',
      score: 50,
      status: 'Not yet assessed',
      requiresAction: false,
      recommendedAction: null,
    };
  }
  if (!forecast) {
    return {
      name: 'Settlement Readiness',
      score: 30,
      status: 'No revenue data',
      requiresAction: true,
      recommendedAction: 'Add revenue sources to assess settlement readiness.',
    };
  }

  const caps = decision.commercialCapabilities;
  const cashReady = forecast.cashReadiness.canEveryoneBePaid;
  const settlementReady = caps?.settlementReady === true;
  const revenueFlowing = caps?.revenueFlowing === true;

  let score: number;
  let status: string;

  if (settlementReady && cashReady) {
    score = 100;
    status = 'Ready for payment release';
  } else if (revenueFlowing && cashReady) {
    score = 80;
    status = 'Revenue flowing, obligations pending';
  } else if (revenueFlowing && !cashReady) {
    score = 55;
    status = 'Revenue flowing, shortfall detected';
  } else if (caps?.paymentProviderConnected) {
    score = 35;
    status = 'Payment provider connected, revenue not yet flowing';
  } else {
    score = 15;
    status = 'Payment provider not connected';
  }

  const blockers = forecast.commercialRisks.filter((r) => r.severity === 'high');
  if (blockers.length > 0) score = Math.min(score, 65);

  return {
    name: 'Settlement Readiness',
    score,
    status,
    requiresAction: score < 80,
    recommendedAction:
      !settlementReady && cashReady
        ? 'Review obligations and release payments.'
        : !cashReady
          ? 'Resolve the forecast shortfall before releasing settlement.'
          : null,
  };
}

/* ─── Aggregation ────────────────────────────────────────────────────────────── */

const DIMENSION_WEIGHTS: Record<string, number> = {
  'Forecast': 0.25,
  'Revenue Certainty': 0.20,
  'Agreement Completeness': 0.25,
  'Workflow': 0.20,
  'Settlement Readiness': 0.10,
};

function weightedScore(dimensions: CommercialHealthDimension[]): number {
  let total = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    const weight = DIMENSION_WEIGHTS[dim.name] ?? 0.2;
    total += dim.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(total / totalWeight) : 0;
}

function scoreToLevel(
  score: number,
  dimensions: CommercialHealthDimension[]
): CommercialHealthLevel {
  const blockedDimension = dimensions.find((d) => d.score === 0 && d.requiresAction);
  if (blockedDimension) return 'blocked';
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 55) return 'attention';
  if (score >= 35) return 'at_risk';
  return 'blocked';
}

function derivePrimaryAction(
  dimensions: CommercialHealthDimension[],
  decision: CommercialDecisionResult | null
): string | null {
  // Use the decision engine's recommended action if available
  if (decision?.recommendedAction?.explanation) {
    return decision.recommendedAction.explanation;
  }

  // Fall back to the weakest dimension's action
  const weakest = [...dimensions]
    .filter((d) => d.requiresAction && d.recommendedAction)
    .sort((a, b) => a.score - b.score)[0];

  return weakest?.recommendedAction ?? null;
}

function buildSummary(
  level: CommercialHealthLevel,
  isOperational: boolean,
  forecast: CommercialForecastResult | null,
  decision: CommercialDecisionResult | null,
  kpis: OperationalKPIs | null
): string {
  if (isOperational) {
    return 'Agreement is commercially operational. All obligations have been settled.';
  }

  switch (level) {
    case 'excellent':
      return forecast?.cashReadiness.canEveryoneBePaid
        ? 'All commercial commitments can be met. Settlement is ready to proceed.'
        : 'Agreement is in excellent shape. Continue to the next commercial milestone.';

    case 'good':
      return decision?.nextStep
        ? `Agreement is progressing well. Current stage: ${decision.nextStep}.`
        : 'Agreement is progressing well. Continue to the next step.';

    case 'attention': {
      const weakCount = kpis
        ? [kpis.participantCount === 0, kpis.earningsConfiguredCount < kpis.participantCount].filter(Boolean).length
        : 0;
      return weakCount > 0
        ? 'Some configuration is incomplete. Review outstanding items.'
        : 'Attention required on one or more commercial dimensions.';
    }

    case 'at_risk':
      return forecast?.cashReadiness.primaryBlocker
        ? `At risk: ${forecast.cashReadiness.primaryBlocker}`
        : 'Commercial health is at risk. Resolve outstanding issues before proceeding.';

    case 'blocked':
      return decision?.recommendedAction?.explanation
        ? decision.recommendedAction.explanation
        : 'Agreement is blocked. Action is required to continue.';
  }
}
