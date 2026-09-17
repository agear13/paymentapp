import 'server-only';

import { collectOrganizationEvidence } from '@/lib/business-passport/evidence-sources.server';
import { matchRequirements } from '@/lib/business-passport/match-requirements';
import { calculateReadiness } from '@/lib/business-passport/readiness';
import {
  getOfferingPassportMeta,
  getOnboardingRequirements,
} from '@/lib/business-passport/requirement-catalog';
import type { RailOnboardingReadiness } from '@/lib/business-passport/types';

export type AssessOfferingReadinessResult =
  | { ok: true; assessment: RailOnboardingReadiness }
  | { ok: false; reason: 'organization_not_found' | 'unknown_offering' };

/**
 * Request-scoped assessment. Does not persist. Does not write route intelligence.
 */
export async function assessOfferingReadiness(input: {
  organizationId: string;
  offeringId: string;
}): Promise<AssessOfferingReadinessResult> {
  const meta = getOfferingPassportMeta(input.offeringId);
  const requirements = getOnboardingRequirements(input.offeringId);
  if (!meta || !requirements) {
    return { ok: false, reason: 'unknown_offering' };
  }

  const snapshot = await collectOrganizationEvidence(input.organizationId);
  if (!snapshot) {
    return { ok: false, reason: 'organization_not_found' };
  }

  const notes: string[] = [];
  if (snapshot.airwallexConfigured) {
    notes.push(
      'This organisation already has Airwallex credentials connected. That does not fill missing KYB information requirements.'
    );
  }

  return {
    ok: true,
    assessment: calculateReadiness({
      organizationId: snapshot.organizationId,
      offeringId: meta.offeringId,
      offeringLabel: meta.offeringLabel,
      providerName: meta.providerName,
      rows: matchRequirements(requirements, snapshot),
      notes,
    }),
  };
}
