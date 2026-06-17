import { describe, expect, it } from '@jest/globals';
import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import { isHallucinatedSettlementTrigger } from '@/lib/ai-extractor/parse-settlement-rules';
import { buildConversationImportAuditRecord } from '@/lib/operations/audit/conversation-import-audit';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';
import { buildInsightsFromExtraction } from '@/lib/onboarding/agreement-intelligence-insights';
import {
  onboardingDraftsFromExtraction,
  participantsFromOnboardingDrafts,
} from '@/lib/onboarding/onboarding-participant-persist';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  SUNSET_SESSIONS_EXPECTATIONS,
  sunsetSessionsIdealExtractionPayload,
} from '@/fixtures/sunset-sessions-conversation';

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

describe('onboarding v4 integration (Sunset Sessions)', () => {
  const normalized = normalizeExtractionResult(
    validateExtractionResult(sunsetSessionsIdealExtractionPayload())
  );
  const deal = sunsetDeal();
  const drafts = onboardingDraftsFromExtraction(normalized, deal, 'whatsapp', 'AUD');
  const insight = buildInsightsFromExtraction(normalized, drafts);
  const persisted = participantsFromOnboardingDrafts(drafts, deal);
  const form = reviewFormFromExtraction(normalized, 'onboarding', 'whatsapp', undefined, {
    project: deal,
    workspaceCurrency: 'AUD',
  });
  const audit = buildConversationImportAuditRecord({
    form,
    result: normalized,
    entryPoint: 'onboarding',
    sourceType: 'whatsapp',
  });

  it('maps five onboarding drafts with v4 service categories', () => {
    expect(drafts).toHaveLength(SUNSET_SESSIONS_EXPECTATIONS.participantCount);

    for (const [name, category] of Object.entries(SUNSET_SESSIONS_EXPECTATIONS.categories)) {
      const draft = drafts.find((d) => d.name === name);
      expect(draft?.extractedObligations?.serviceCategories).toContain(category);
    }
  });

  it('shows service categories in Agreement Intelligence participant roles', () => {
    const rolesByName = Object.fromEntries(
      insight.participantsFound.map((p) => [p.name, p.role?.toLowerCase()])
    );

    expect(rolesByName.Sarah).toBe('marketing');
    expect(rolesByName.Alex).toBe('photography');
    expect(rolesByName.Mia).toBe('videography');
    expect(rolesByName.Chris).toBe('graphic design');
    expect(rolesByName.Ben).toBe('venue');
  });

  it('preserves Alex conditional bonus in participant obligation graph', () => {
    const alexDraft = drafts.find((d) => d.name === 'Alex');
    const alexPersisted = persisted.find((p) => p.name === 'Alex');

    expect(alexDraft?.extractedObligations?.conditionalPayments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: SUNSET_SESSIONS_EXPECTATIONS.compensation.Alex.conditionalAmount,
          trigger: expect.stringMatching(/attendance exceeds 500/i),
        }),
      ])
    );
    expect(alexPersisted?.extractedObligations?.conditionalPayments).toHaveLength(1);
  });

  it('does not surface hallucinated settlement terms in commercial terms', () => {
    const joined = insight.commercialTermsFound.join(' ').toLowerCase();
    expect(joined).not.toMatch(/net sales basis/);
    expect(joined).not.toMatch(/monthly settlement/);
    expect(joined).not.toMatch(/processing fees/);

    for (const term of insight.commercialTermsFound) {
      expect(isHallucinatedSettlementTrigger(term)).toBe(false);
    }
  });

  it('uses extracted agreement type and readiness assessment in insight', () => {
    expect(insight.agreementType).toBe('Multi-Party Event Coordination Agreement');
    expect(insight.readinessScore).toBeLessThanOrEqual(SUNSET_SESSIONS_EXPECTATIONS.maxReadinessScore);
    expect(insight.readinessExplanation).toMatch(/Settlement not ready today/i);
    expect(insight.serviceCategoriesFound).toEqual(
      expect.arrayContaining(['marketing', 'photography', 'videography', 'graphic design', 'venue'])
    );
  });

  it('builds participant obligation graph with deliverables and settlement events', () => {
    const mia = persisted.find((p) => p.name === 'Mia');
    expect(mia?.extractedObligations?.deliverables.length).toBeGreaterThan(0);
    expect(mia?.extractedObligations?.revenueShareObligations[0]?.percentage).toBe(5);

    const alex = persisted.find((p) => p.name === 'Alex');
    expect(alex?.extractedObligations?.fixedObligations[0]?.amount).toBe(600);
    expect(alex?.extractedObligations?.settlementEvents.some((e) => e.type === 'bonus')).toBe(true);
  });

  it('persists v4 obligation snapshot on conversation import audit record', () => {
    expect(audit.extractionSummary.obligationSnapshot?.schemaVersion).toBe('v4');
    expect(audit.extractionSummary.obligationSnapshot?.agreementType).toBe(
      SUNSET_SESSIONS_EXPECTATIONS.agreementType
    );
    expect(audit.extractionSummary.obligationSnapshot?.settlementRules).toEqual([]);
    expect(audit.extractionSummary.agreementTypeLabel).toBe(
      'Multi-Party Event Coordination Agreement'
    );

    const alexParty = audit.parties.find((p) => p.name === 'Alex');
    expect(alexParty?.extractedObligations?.conditionalPayments).toHaveLength(1);
    expect(alexParty?.extractedObligations?.serviceCategories).toContain('PHOTOGRAPHY');
  });
});
