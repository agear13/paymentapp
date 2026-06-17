import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';
import { agreementTypeDisplayLabel } from '@/lib/ai-extractor/classify-agreement-type';
import { buildSettlementSchedule } from '@/lib/ai-extractor/settlement-schedule';
import { deliverableDescriptions } from '@/lib/ai-extractor/parse-deliverables';
import { inferServiceCategoriesForParty } from '@/lib/ai-extractor/service-category-detection';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import { isHallucinatedSettlementTrigger } from '@/lib/ai-extractor/parse-settlement-rules';
import type { ExtractedParty } from '@/lib/ai-extractor/extraction-types';
import {
  SUNSET_SESSIONS_EXPECTATIONS,
  sunsetSessionsGenericRolePayload,
  sunsetSessionsIdealExtractionPayload,
} from '@/fixtures/sunset-sessions-conversation';

function findParty(parties: ExtractedParty[], name: string): ExtractedParty {
  const party = parties.find((p) => p.name.value === name);
  if (!party) throw new Error(`Expected participant ${name}`);
  return party;
}

describe('Sunset Sessions extraction regression', () => {
  const idealNormalized = normalizeExtractionResult(
    validateExtractionResult(sunsetSessionsIdealExtractionPayload())
  );

  it('extracts 5 participants with correct service categories', () => {
    expect(idealNormalized.parties).toHaveLength(SUNSET_SESSIONS_EXPECTATIONS.participantCount);

    for (const [name, category] of Object.entries(SUNSET_SESSIONS_EXPECTATIONS.categories)) {
      const party = findParty(idealNormalized.parties, name);
      expect(inferServiceCategoriesForParty(party)).toContain(category);
    }
  });

  it('preserves Alex fixed fee and conditional bonus', () => {
    const alex = findParty(idealNormalized.parties, 'Alex');
    expect(alex.fixedAmount.value).toBe(
      SUNSET_SESSIONS_EXPECTATIONS.compensation.Alex.fixedFee
    );
    expect(alex.conditionalPayments[0]?.amount.value).toBe(
      SUNSET_SESSIONS_EXPECTATIONS.compensation.Alex.conditionalAmount
    );
    expect(alex.conditionalPayments[0]?.trigger.value).toMatch(/attendance exceeds 500/i);
  });

  it('preserves revenue share obligations for Sarah, Mia, and Ben', () => {
    const sarah = findParty(idealNormalized.parties, 'Sarah');
    const mia = findParty(idealNormalized.parties, 'Mia');
    const ben = findParty(idealNormalized.parties, 'Ben');

    expect(sarah.revenueSharePct.value).toBe(
      SUNSET_SESSIONS_EXPECTATIONS.compensation.Sarah.revenueSharePct
    );
    expect(mia.revenueSharePct.value).toBe(
      SUNSET_SESSIONS_EXPECTATIONS.compensation.Mia.revenueSharePct
    );
    expect(ben.revenueSharePct.value).toBe(
      SUNSET_SESSIONS_EXPECTATIONS.compensation.Ben.revenueSharePct
    );
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

  it('does not include hallucinated settlement triggers in schedule output', () => {
    const schedule = buildSettlementSchedule(idealNormalized);
    const allLines = schedule.flatMap((group) => group.lines.map((line) => line.value));
    for (const line of allLines) {
      expect(isHallucinatedSettlementTrigger(line)).toBe(false);
    }
    expect(allLines.join(' ')).not.toMatch(/monthly settlement/i);
    expect(allLines.join(' ')).not.toMatch(/processing fees/i);
  });

  it('classifies agreement as multi-party event coordination', () => {
    expect(idealNormalized.agreementType?.value).toBe(SUNSET_SESSIONS_EXPECTATIONS.agreementType);
    expect(agreementTypeDisplayLabel(idealNormalized.agreementType!.value!)).toBe(
      'Multi-Party Event Coordination Agreement'
    );
  });

  it('scores readiness below 90% without payment infrastructure and identity data', () => {
    const readiness = idealNormalized.readinessAssessment;
    expect(readiness).toBeDefined();
    expect(readiness!.score).toBeLessThanOrEqual(SUNSET_SESSIONS_EXPECTATIONS.maxReadinessScore);
    expect(readiness!.settlementBlockers.length).toBeGreaterThan(0);
    expect(readiness!.summary).toMatch(/Settlement not ready today/i);
    expect(readiness!.dimensions.find((d) => d.dimension === 'paymentInfrastructure')?.score).toBe(
      0
    );
  });

  it('infers service categories from deliverables when generic roles are returned', () => {
    const normalized = normalizeExtractionResult(
      validateExtractionResult(sunsetSessionsGenericRolePayload())
    );

    expect(inferServiceCategoriesForParty(findParty(normalized.parties, 'Sarah'))).toContain(
      'MARKETING'
    );
    expect(inferServiceCategoriesForParty(findParty(normalized.parties, 'Alex'))).toContain(
      'PHOTOGRAPHY'
    );
    expect(inferServiceCategoriesForParty(findParty(normalized.parties, 'Mia'))).toContain(
      'VIDEOGRAPHY'
    );
    expect(inferServiceCategoriesForParty(findParty(normalized.parties, 'Chris'))).toContain(
      'GRAPHIC_DESIGN'
    );
    expect(inferServiceCategoriesForParty(findParty(normalized.parties, 'Ben'))).toContain('VENUE');
  });

  it('derives conditional bonus settlement events for Alex', () => {
    const alexEvents = idealNormalized.settlementEvents?.filter(
      (event) => event.partyName.value === 'Alex'
    );
    expect(alexEvents?.some((event) => event.type.value === 'bonus')).toBe(true);
    expect(alexEvents?.some((event) => event.amount.value === 150)).toBe(true);
  });
});
