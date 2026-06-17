import { buildSettlementSchedule } from '@/lib/ai-extractor/settlement-schedule';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { field, legacyDeliverables, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';

describe('buildSettlementSchedule', () => {
  it('groups participant settlement lines and conditional bonuses', () => {
    const result = normalizeExtractionResult({
      projectName: field('Sunset Sessions'),
      projectDescription: field(null),
      projectValue: field(null, 'absent'),
      currency: field('AUD'),
      counterparty: field('James'),
      parties: [
        testParty({
          id: 'ep-1',
          name: field('Sarah'),
          role: field('Promoter'),
          participationModel: field('hybrid'),
          fixedAmount: field(300),
          revenueSharePct: field(10),
          serviceCategories: field(['MARKETING']),
          milestones: [
            {
              description: field('Paid 7 days after event'),
              deadline: field('7 days after event'),
              category: field('financial'),
            },
          ],
        }),
        testParty({
          id: 'ep-2',
          name: field('Alex'),
          role: field('Photographer'),
          participationModel: field('fixed_payout'),
          fixedAmount: field(600),
          ...legacyDeliverables(['50 edited images']),
          serviceCategories: field(['PHOTOGRAPHY']),
          milestones: [
            {
              description: field('$150 bonus if attendance exceeds 500'),
              deadline: field(null, 'absent'),
              category: field('financial'),
            },
          ],
        }),
      ],
      settlementRules: [
        {
          trigger: field('7 days after event', 'high'),
          basis: field(null, 'absent'),
          rawSnippet: 'Paid 7 days after event',
        },
      ],
      paymentTerms: [],
      uncertainties: [],
      overallConfidence: 'high',
      sourceHint: null,
      extractedAt: '2026-06-12T00:00:00.000Z',
    } as ExtractionResult);

    const schedule = buildSettlementSchedule(result);
    expect(schedule).toHaveLength(2);
    expect(schedule[0]?.partyName).toBe('Sarah');
    expect(schedule[0]?.lines.some((line) => line.label === 'Fixed Fee')).toBe(true);
    expect(schedule[0]?.lines.some((line) => line.label === 'Revenue Share')).toBe(true);
    expect(schedule[1]?.lines.some((line) => line.label === 'Conditional Bonus')).toBe(true);
  });
});
