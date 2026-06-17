import { buildInsightsFromExtraction } from '@/lib/onboarding/agreement-intelligence-insights';
import { onboardingDraftsFromExtraction } from '@/lib/onboarding/onboarding-participant-persist';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';
import { agreementTypeDisplayLabel } from '@/lib/ai-extractor/classify-agreement-type';
import { buildSettlementSchedule } from '@/lib/ai-extractor/settlement-schedule';
import { deliverableDescriptions } from '@/lib/ai-extractor/parse-deliverables';
import { inferServiceCategoriesForParty } from '@/lib/ai-extractor/service-category-detection';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import { isHallucinatedSettlementTrigger } from '@/lib/ai-extractor/parse-settlement-rules';
import { estimateFixedCommitment } from '@/lib/ai-extractor/migrate-extraction-schema';
import type { ExtractedParty } from '@/lib/ai-extractor/extraction-types';
import {
  SUNSET_SESSIONS_EXPECTATIONS,
  sunsetSessionsGenericRolePayload,
  sunsetSessionsIdealExtractionPayload,
  sunsetSessionsLegacyV4Payload,
} from '@/fixtures/sunset-sessions-conversation';

function findParty(parties: ExtractedParty[], name: string): ExtractedParty {
  const party = parties.find((p) => p.name.value === name);
  if (!party) throw new Error(`Expected participant ${name}`);
  return party;
}

function sunsetDeal(): RecentDeal {
  return {
    id: 'onb-sunset',
    dealName: 'Sunset Sessions',
    partner: 'James',
    value: 8000,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
  };
}

describe('Sunset Sessions extraction regression (v5)', () => {
  const deal = sunsetDeal();
  const idealNormalized = normalizeExtractionResult(
    validateExtractionResult(sunsetSessionsIdealExtractionPayload())
  );

  it('extracts 5 participants with correct service categories', () => {
    expect(idealNormalized.parties).toHaveLength(SUNSET_SESSIONS_EXPECTATIONS.participantCount);
    expect(idealNormalized.schemaVersion).toBe('v5');

    for (const [name, category] of Object.entries(SUNSET_SESSIONS_EXPECTATIONS.categories)) {
      const party = findParty(idealNormalized.parties, name);
      expect(inferServiceCategoriesForParty(party)).toContain(category);
    }
  });

  it('detects agreement owner James', () => {
    expect(idealNormalized.agreementOwner?.name.value).toBe(SUNSET_SESSIONS_EXPECTATIONS.agreementOwner);
    expect(idealNormalized.commercialGraph?.agreementOwner).toBe('James');
    expect(idealNormalized.commercialGraph?.agreementOwnerResponsibilities.length).toBeGreaterThan(0);
  });

  it('generates commercial summary from structured data', () => {
    expect(idealNormalized.commercialGraph?.commercialSummary).toMatch(/Sunset Sessions engages 5 independent suppliers/i);
    expect(idealNormalized.commercialGraph?.commercialSummary).toMatch(/fixed payments/i);
  });

  it('preserves Alex fixed fee and conditional bonus as separate compensation terms', () => {
    const alex = findParty(idealNormalized.parties, 'Alex');
    const terms = alex.compensationTerms ?? [];
    expect(terms.some((t) => t.type === 'fixed_fee' && t.amount.value === 600)).toBe(true);
    expect(terms.some((t) => t.type === 'conditional_bonus' && t.amount.value === 150)).toBe(true);
    expect(terms.filter((t) => t.type === 'fixed_fee')).toHaveLength(1);
  });

  it('preserves Mia instalments and revenue share as separate compensation terms', () => {
    const mia = findParty(idealNormalized.parties, 'Mia');
    const terms = mia.compensationTerms ?? [];
    const instalments = terms.filter((t) => t.type === 'instalment');
    expect(instalments).toHaveLength(2);
    expect(instalments[0]?.amount.value).toBe(500);
    expect(instalments[1]?.amount.value).toBe(500);
    expect(terms.some((t) => t.type === 'revenue_share' && t.percentage.value === 5)).toBe(true);
    expect(mia.fixedAmount.value).not.toBe(1000);
  });

  it('preserves Chris milestone payments without collapsing to single fixed fee', () => {
    const chris = findParty(idealNormalized.parties, 'Chris');
    const milestones = (chris.compensationTerms ?? []).filter((t) => t.type === 'milestone');
    expect(milestones).toHaveLength(2);
    expect(milestones[0]?.amount.value).toBe(250);
    expect(milestones[1]?.amount.value).toBe(250);
    expect(chris.fixedAmount.value).toBeNull();
  });

  it('preserves Sarah hybrid compensation and revenue share', () => {
    const sarah = findParty(idealNormalized.parties, 'Sarah');
    const terms = sarah.compensationTerms ?? [];
    expect(terms.some((t) => t.type === 'fixed_fee' && t.amount.value === 300)).toBe(true);
    expect(terms.some((t) => t.type === 'revenue_share' && t.percentage.value === 10)).toBe(true);
  });

  it('extracts commercial dependencies', () => {
    const alex = findParty(idealNormalized.parties, 'Alex');
    const mia = findParty(idealNormalized.parties, 'Mia');
    const chris = findParty(idealNormalized.parties, 'Chris');

    expect(alex.commercialDependencies?.some((d) => /attendance exceeds 500/i.test(d.description.value ?? ''))).toBe(true);
    expect(mia.commercialDependencies?.some((d) => /sponsor funds/i.test(d.description.value ?? ''))).toBe(true);
    expect(chris.commercialDependencies?.some((d) => /final asset/i.test(d.description.value ?? ''))).toBe(true);
  });

  it('separates operational obligations from compensation in intelligence insight', () => {
    const drafts = onboardingDraftsFromExtraction(idealNormalized, deal, 'whatsapp', 'AUD');
    const insight = buildInsightsFromExtraction(idealNormalized, drafts);

    expect(insight.obligationsIdentified.some((o) => /fixed fee/i.test(o))).toBe(false);
    expect(insight.obligationsIdentified.some((o) => /revenue share/i.test(o))).toBe(false);
    expect(insight.obligationsIdentified.some((o) => /Sarah:.*outreach/i.test(o))).toBe(true);
    expect(insight.compensationTermsFound?.some((c) => c.participant === 'Sarah')).toBe(true);
  });

  it('does not duplicate settlement sections — uses unified settlement schedule', () => {
    const insight = buildInsightsFromExtraction(
      idealNormalized,
      onboardingDraftsFromExtraction(idealNormalized, deal, 'whatsapp', 'AUD')
    );

    expect(insight.settlementSchedule?.length).toBeGreaterThan(0);
    expect(insight.obligationsIdentified.some((o) => /Settlement rule:/i.test(o))).toBe(false);
    expect(insight.obligationsIdentified.some((o) => /Payment term:/i.test(o))).toBe(false);
  });

  it('computes estimated fixed commitment correctly', () => {
    const total = idealNormalized.parties.reduce(
      (sum, party) => sum + estimateFixedCommitment(party.compensationTerms ?? []),
      0
    );
    expect(total).toBe(SUNSET_SESSIONS_EXPECTATIONS.estimatedFixedCommitment);
    expect(idealNormalized.commercialGraph?.commercialStructure.estimatedFixedCommitment).toBe(
      SUNSET_SESSIONS_EXPECTATIONS.estimatedFixedCommitment
    );
  });

  it('reports correct commercial structure metrics', () => {
    const structure = idealNormalized.commercialGraph?.commercialStructure;
    expect(structure?.participantCount).toBe(5);
    expect(structure?.hybridCompensationCount).toBeGreaterThanOrEqual(2);
    expect(structure?.milestonePaymentCount).toBeGreaterThanOrEqual(2);
    expect(structure?.instalmentPaymentCount).toBeGreaterThanOrEqual(2);
    expect(structure?.conditionalPaymentCount).toBeGreaterThanOrEqual(1);
    expect(structure?.revenueShareAgreementCount).toBeGreaterThanOrEqual(3);
  });

  it('builds participant cards with deliverables, compensation and settlement', () => {
    const cards = idealNormalized.commercialGraph?.participantCards ?? [];
    const sarah = cards.find((c) => c.name === 'Sarah');
    expect(sarah?.operationalObligations.length).toBeGreaterThan(0);
    expect(sarah?.compensationTerms.some((t) => /fixed/i.test(t))).toBe(true);
    expect(sarah?.compensationTerms.some((t) => /10%/i.test(t))).toBe(true);
  });

  it('scores readiness below 90% with settlement blockers', () => {
    const readiness = idealNormalized.readinessAssessment;
    expect(readiness).toBeDefined();
    expect(readiness!.score).toBeLessThanOrEqual(SUNSET_SESSIONS_EXPECTATIONS.maxReadinessScore);
    expect(readiness!.settlementBlockers.length).toBeGreaterThan(0);
    expect(readiness!.summary).toMatch(/Settlement not ready today/i);
  });

  it('does not include hallucinated settlement triggers in schedule output', () => {
    const schedule = buildSettlementSchedule(idealNormalized);
    const allLines = schedule.flatMap((group) => group.lines.map((line) => line.value));
    for (const line of allLines) {
      expect(isHallucinatedSettlementTrigger(line)).toBe(false);
    }
  });

  it('classifies agreement as multi-party event coordination', () => {
    expect(idealNormalized.agreementType?.value).toBe(SUNSET_SESSIONS_EXPECTATIONS.agreementType);
    expect(agreementTypeDisplayLabel(idealNormalized.agreementType!.value!)).toBe(
      'Multi-Party Event Coordination Agreement'
    );
  });

  it('infers service categories from deliverables when generic roles are returned', () => {
    const normalized = normalizeExtractionResult(
      validateExtractionResult(sunsetSessionsGenericRolePayload())
    );

    expect(inferServiceCategoriesForParty(findParty(normalized.parties, 'Sarah'))).toContain('MARKETING');
    expect(inferServiceCategoriesForParty(findParty(normalized.parties, 'Alex'))).toContain('PHOTOGRAPHY');
    expect(normalized.schemaVersion).toBe('v5');
  });

  it('migrates legacy v4 payload to v5 commercial graph without losing milestone or instalment detail', () => {
    const normalized = normalizeExtractionResult(
      validateExtractionResult(sunsetSessionsLegacyV4Payload())
    );

    const mia = findParty(normalized.parties, 'Mia');
    const chris = findParty(normalized.parties, 'Chris');
    expect((mia.compensationTerms ?? []).filter((t) => t.type === 'instalment').length).toBeGreaterThanOrEqual(2);
    expect((chris.compensationTerms ?? []).filter((t) => t.type === 'milestone').length).toBeGreaterThanOrEqual(2);
    expect(normalized.commercialGraph?.schemaVersion).toBe('v5');
  });

  it('extracts deliverables for all service participants', () => {
    for (const [name, expectedDeliverables] of Object.entries(
      SUNSET_SESSIONS_EXPECTATIONS.deliverables
    )) {
      const party = findParty(idealNormalized.parties, name);
      expect(deliverableDescriptions(party)).toEqual(
        expect.arrayContaining(expectedDeliverables)
      );
    }
  });
});
