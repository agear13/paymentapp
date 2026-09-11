import { isUnknownNetworkRail } from '@/lib/route-intelligence/network-rail';
import type { DecisionConfidence, RouteDecisionAssessment } from '@/lib/route-intelligence/decision-types';

function knownCount(assessment: RouteDecisionAssessment): number {
  return assessment.factors.filter((factor) => factor.state === 'known').length;
}

/**
 * Decision confidence is separate from economic-route confidence.
 * High requires complete, fresh, route-specific evidence — not merely a winner.
 */
export function evaluateDecisionConfidence(
  recommended: RouteDecisionAssessment | null
): DecisionConfidence {
  if (!recommended) {
    return { level: 'unknown', reasons: ['no_recommendable_route'] };
  }

  const reasons: string[] = [];
  const known = knownCount(recommended);
  const stale = recommended.factors.some((factor) => factor.state === 'stale');
  const capabilitySupported = recommended.coverage.status === 'supported';
  const operationalOk = recommended.operational.overallImpact === 'not_affected';
  const regulatoryAffected = recommended.regulatory.some((item) => item.status === 'affected');
  const economicKnown = recommended.economic.fee.state === 'known' && recommended.totalCost.state === 'known';
  const railKnown = !isUnknownNetworkRail(recommended.route.networkRail);

  if (stale) reasons.push('stale_evidence');
  if (!capabilitySupported) reasons.push('capability_not_supported');
  if (recommended.operational.overallImpact === 'unknown') reasons.push('operational_uncertain');
  if (regulatoryAffected) reasons.push('regulatory_affected');
  if (!economicKnown) reasons.push('economic_incomplete');
  if (!railKnown) reasons.push('unknown_network_rail');
  if (recommended.economic.settlement.state !== 'known') reasons.push('settlement_incomplete');
  if (recommended.economic.availability.state !== 'known') reasons.push('availability_incomplete');

  const high =
    capabilitySupported &&
    operationalOk &&
    !regulatoryAffected &&
    economicKnown &&
    railKnown &&
    !stale &&
    recommended.economic.settlement.state === 'known' &&
    recommended.economic.availability.state === 'known' &&
    recommended.economic.fee.provenance === 'externally_sourced';

  if (high) {
    return { level: 'high', reasons: ['complete_fresh_external_route_specific'] };
  }
  if (stale || regulatoryAffected || known <= 3) {
    reasons.push(`known_factors:${known}`);
    return { level: 'low', reasons };
  }
  reasons.push(`known_factors:${known}`);
  return { level: 'moderate', reasons };
}
