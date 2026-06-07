import type {
  AgreementComparativeRank,
  AgreementHealthPortfolioSummary,
  AgreementHealthSnapshot,
} from '@/lib/agreements/health/agreement-health.types';
import {
  AGREEMENT_COMPARATIVE_RANK_LABELS,
  AGREEMENT_HEALTH_CATEGORY_LABELS,
} from '@/lib/agreements/health/agreement-health.types';

export { AGREEMENT_COMPARATIVE_RANK_LABELS };

export function summarizeAgreementHealthPortfolio(
  snapshots: AgreementHealthSnapshot[]
): AgreementHealthPortfolioSummary {
  const byCategory = {
    excellent: 0,
    healthy: 0,
    attention_required: 0,
    at_risk: 0,
    critical: 0,
  };

  for (const snapshot of snapshots) {
    byCategory[snapshot.category] += 1;
  }

  const averageScore =
    snapshots.length === 0
      ? 0
      : Math.round(snapshots.reduce((sum, s) => sum + s.score, 0) / snapshots.length);

  return {
    totalAgreements: snapshots.length,
    averageScore,
    byCategory,
    categoryLabels: AGREEMENT_HEALTH_CATEGORY_LABELS,
    snapshots,
  };
}

export function rankAgreementsByComparativeMetric(
  snapshots: AgreementHealthSnapshot[],
  rank: AgreementComparativeRank,
  limit = 5
): AgreementHealthSnapshot[] {
  const copy = [...snapshots];

  switch (rank) {
    case 'highest_risk':
      return copy.sort((a, b) => a.score - b.score).slice(0, limit);
    case 'highest_value':
      return copy.sort((a, b) => b.agreementValue - a.agreementValue).slice(0, limit);
    case 'closest_to_settlement':
      return copy
        .sort((a, b) => {
          if (b.releaseReadyCount !== a.releaseReadyCount) {
            return b.releaseReadyCount - a.releaseReadyCount;
          }
          return b.score - a.score;
        })
        .slice(0, limit);
    case 'most_blocked':
      return copy.sort((a, b) => b.blockerCount - a.blockerCount || a.score - b.score).slice(0, limit);
    case 'recently_improved':
      return copy
        .filter((s) => s.trend.direction === 'improved')
        .sort((a, b) => b.trend.delta - a.trend.delta)
        .slice(0, limit);
    case 'recently_deteriorated':
      return copy
        .filter((s) => s.trend.direction === 'declined')
        .sort((a, b) => a.trend.delta - b.trend.delta)
        .slice(0, limit);
    default:
      return copy.slice(0, limit);
  }
}

export const COMPARATIVE_RANK_ORDER: AgreementComparativeRank[] = [
  'highest_risk',
  'highest_value',
  'closest_to_settlement',
  'most_blocked',
  'recently_improved',
  'recently_deteriorated',
];
