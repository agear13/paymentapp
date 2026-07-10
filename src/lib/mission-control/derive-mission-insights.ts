import type { BusinessFinancialSnapshot } from '@/lib/commercial/business-financial-snapshot';

/**
 * Surfaces existing engine outputs as operator recommendations — no new calculations.
 */
export function deriveMissionInsights(business: BusinessFinancialSnapshot | null): string[] {
  if (!business) return [];

  const insights: string[] = [];
  const commercial = business.commercial;
  const forecast = commercial.forecast;

  if (commercial.health.primaryAction) {
    insights.push(commercial.health.primaryAction);
  }

  if (forecast.cashReadiness.primaryBlocker) {
    insights.push(forecast.cashReadiness.primaryBlocker);
  }

  for (const risk of forecast.commercialRisks.slice(0, 2)) {
    if (risk.recommendedAction) {
      insights.push(risk.recommendedAction);
    }
  }

  for (const dim of commercial.health.dimensions) {
    if (dim.requiresAction && dim.recommendedAction) {
      insights.push(dim.recommendedAction);
    }
  }

  for (const record of business.projectRecords) {
    const surplus = record.snapshot.forecast.forecastPosition.forecastSurplus;
    if (surplus < 0 && record.snapshot.health.primaryAction) {
      insights.push(`${record.agreementName}: ${record.snapshot.health.primaryAction}`);
    }
  }

  const seen = new Set<string>();
  return insights.filter((line) => {
    const key = line.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}
