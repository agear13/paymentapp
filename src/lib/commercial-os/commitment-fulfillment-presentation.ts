/**
 * Presentation rules for composing existing Payment Intelligence onto a commitment.
 * Does not rank routes. Does not invent a cheaper/better winner.
 */

import type {
  AdvisorOfferingSnapshot,
  PaymentAdvisorResponse,
} from '@/lib/advisor/payment-advisor-types';

export function shouldDisplayRouteWinner(
  explanation: PaymentAdvisorResponse['explanation'] | null | undefined
): boolean {
  if (!explanation || explanation.status !== 'explained') return false;
  return explanation.confidence?.label === 'High' || explanation.confidence?.label === 'Moderate';
}

export function collectComparedRoutes(
  response: Pick<
    PaymentAdvisorResponse,
    'recommendation' | 'alternatives' | 'scenarioComparison'
  >
): AdvisorOfferingSnapshot[] {
  const rows = [
    response.recommendation,
    ...(response.alternatives ?? []),
    response.scenarioComparison?.scenarioOffering ?? null,
    ...(response.scenarioComparison?.comparedOfferings ?? []),
  ].filter((row): row is AdvisorOfferingSnapshot => Boolean(row));

  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.offeringId)) return false;
    seen.add(row.offeringId);
    return true;
  });
}
