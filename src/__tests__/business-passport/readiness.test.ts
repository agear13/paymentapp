import { AIRWALLEX_ONBOARDING_REQUIREMENTS } from '@/lib/business-passport/requirement-catalog';
import { matchRequirements } from '@/lib/business-passport/match-requirements';
import { calculateReadiness } from '@/lib/business-passport/readiness';
import { INFORMATION_READINESS_DISCLAIMER } from '@/lib/business-passport/types';
import type { OrganizationEvidenceSnapshot, RequirementMatch } from '@/lib/business-passport/types';
import { buildFiveOfSevenMatches } from '@/__tests__/business-passport/five-of-seven.fixture';

const TYPICAL_ORG_SNAPSHOT: OrganizationEvidenceSnapshot = {
  organizationId: 'org-actual',
  organizationName: 'Demo Workspace',
  displayName: 'Demo Workspace',
  industry: 'Professional services',
  defaultCurrency: 'AUD',
  enabledCurrencies: ['USD', 'AUD'],
  airwallexConfigured: false,
  wiseProfileId: null,
  stripeAccountId: null,
  xeroConnected: false,
};

describe('business passport readiness', () => {
  it('reports 3/7 for typical organisation-scoped evidence without fabricating missing fields', () => {
    const rows = matchRequirements(AIRWALLEX_ONBOARDING_REQUIREMENTS, TYPICAL_ORG_SNAPSHOT);
    const result = calculateReadiness({
      organizationId: TYPICAL_ORG_SNAPSHOT.organizationId,
      offeringId: 'airwallex-international',
      offeringLabel: 'Business international transfer',
      providerName: 'Airwallex',
      rows,
    });

    expect(result.presentCount).toBe(3);
    expect(result.applicableCount).toBe(7);
    expect(result.percent).toBe(43);
    expect(result.complete.map((row) => row.requirementId)).toEqual([
      'business_identity',
      'business_activity',
      'settlement_information',
    ]);
    expect(result.stillRequired.map((row) => row.requirementId)).toEqual([
      'business_registration',
      'business_address',
      'director_verification',
      'proof_of_business_address',
    ]);
    expect(result.disclaimer).toBe(INFORMATION_READINESS_DISCLAIMER);
  });

  it('does not treat organisation name as a registration number or address', () => {
    const rows = matchRequirements(AIRWALLEX_ONBOARDING_REQUIREMENTS, {
      ...TYPICAL_ORG_SNAPSHOT,
      organizationName: 'Acme Supply Pty Ltd',
      displayName: 'Acme Supply Pty Ltd',
    });
    const byId = Object.fromEntries(rows.map((row) => [row.requirementId, row]));
    expect(byId.business_identity.status).toBe('available');
    expect(byId.business_registration.status).toBe('missing');
    expect(byId.business_address.status).toBe('missing');
  });

  it('counts stale evidence as present and unknown as excluded from the denominator', () => {
    const rows: RequirementMatch[] = matchRequirements(
      AIRWALLEX_ONBOARDING_REQUIREMENTS,
      TYPICAL_ORG_SNAPSHOT
    ).map((row) =>
      row.requirementId === 'business_identity'
        ? { ...row, status: 'stale' as const }
        : row.requirementId === 'business_activity'
          ? { ...row, status: 'unknown' as const, explanation: 'Cannot evaluate' }
          : row
    );

    const result = calculateReadiness({
      organizationId: 'org-actual',
      offeringId: 'airwallex-international',
      offeringLabel: 'Business international transfer',
      providerName: 'Airwallex',
      rows,
    });

    expect(result.applicableCount).toBe(6);
    expect(result.presentCount).toBe(2);
    expect(result.unknownCount).toBe(1);
    expect(result.percent).toBe(33);
    expect(result.complete.some((row) => row.requirementId === 'business_identity')).toBe(true);
    expect(result.notAssessed.map((row) => row.requirementId)).toEqual(['business_activity']);
  });

  it('uses a separate 5/7 fixture and does not apply it to typical org evidence', () => {
    const fixtureRows = buildFiveOfSevenMatches();
    const fixture = calculateReadiness({
      organizationId: 'fixture-org',
      offeringId: 'airwallex-international',
      offeringLabel: 'Business international transfer',
      providerName: 'Airwallex',
      rows: fixtureRows,
    });

    expect(fixture.presentCount).toBe(5);
    expect(fixture.applicableCount).toBe(7);
    expect(fixture.percent).toBe(71);
    expect(fixture.complete.map((row) => row.requirementId)).toEqual([
      'business_registration',
      'business_identity',
      'business_address',
      'business_activity',
      'settlement_information',
    ]);
    expect(fixture.stillRequired.map((row) => row.requirementId)).toEqual([
      'director_verification',
      'proof_of_business_address',
    ]);

    const typical = calculateReadiness({
      organizationId: TYPICAL_ORG_SNAPSHOT.organizationId,
      offeringId: 'airwallex-international',
      offeringLabel: 'Business international transfer',
      providerName: 'Airwallex',
      rows: matchRequirements(AIRWALLEX_ONBOARDING_REQUIREMENTS, TYPICAL_ORG_SNAPSHOT),
    });
    expect(typical.presentCount).not.toBe(5);
  });
});
