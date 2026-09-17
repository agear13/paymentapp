import { offeringHasPassportCatalog } from '@/lib/business-passport/requirement-catalog';
import type { AdvisorOfferingRef } from '@/lib/business-passport/types';

/**
 * Pick the alternative rail the passport should assess.
 * Prefers an explicit scenario offering (e.g. Airwallex comparison), then a
 * catalogued alternative. Does not change route ranking.
 */
export function selectPassportOffering(input: {
  scenarioOffering?: AdvisorOfferingRef | null;
  alternatives?: AdvisorOfferingRef[];
}): AdvisorOfferingRef | null {
  if (input.scenarioOffering && offeringHasPassportCatalog(input.scenarioOffering.offeringId)) {
    return input.scenarioOffering;
  }

  const alternatives = input.alternatives ?? [];
  const catalogued = alternatives.find((item) => offeringHasPassportCatalog(item.offeringId));
  if (catalogued) return catalogued;

  return null;
}
