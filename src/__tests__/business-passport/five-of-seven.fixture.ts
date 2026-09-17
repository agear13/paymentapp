/**
 * TEST FIXTURE ONLY.
 *
 * Demonstrates a 5/7 information-readiness state without touching organisation
 * production data. Do not import this from production collectors, APIs, or UI.
 */
import { AIRWALLEX_ONBOARDING_REQUIREMENTS } from '@/lib/business-passport/requirement-catalog';
import { matchRequirements } from '@/lib/business-passport/match-requirements';
import type { OrganizationEvidenceSnapshot, RequirementMatch } from '@/lib/business-passport/types';

export const FIVE_OF_SEVEN_EVIDENCE_SNAPSHOT: OrganizationEvidenceSnapshot = {
  organizationId: 'fixture-org',
  organizationName: 'Acme Supply Pty Ltd',
  displayName: 'Acme Supply',
  industry: 'Wholesale trade',
  defaultCurrency: 'AUD',
  enabledCurrencies: ['AUD'],
  airwallexConfigured: false,
  wiseProfileId: null,
  stripeAccountId: null,
  xeroConnected: false,
  registrationNumber: '51 824 753 556',
  businessAddress: '1 Example Street, Sydney NSW 2000',
};

export function buildFiveOfSevenMatches(): RequirementMatch[] {
  return matchRequirements(AIRWALLEX_ONBOARDING_REQUIREMENTS, FIVE_OF_SEVEN_EVIDENCE_SNAPSHOT);
}
