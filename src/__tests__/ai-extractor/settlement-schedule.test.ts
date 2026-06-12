import { buildSettlementSchedule } from '@/lib/ai-extractor/settlement-schedule';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

describe('buildSettlementSchedule', () => {
  it('groups participant settlement lines and conditional bonuses', () => {
    const result = {
      projectName: field('Sunset Sessions'),
      projectDescription: field(null),
      projectValue: field(null, 'absent'),
      currency: field('AUD'),
      counterparty: field('James'),
      parties: [
        {
          id: 'ep-1',
          name: field('Sarah'),
          email: field(null, 'absent'),
          role: field('Promoter'),
          participationModel: field('hybrid'),
          fixedAmount: field(300),
          revenueSharePct: field(10),
          deliverables: field([]),
          milestones: [
            {
              description: field('Paid 7 days after event'),
              deadline: field('7 days after event'),
              category: field('financial'),
            },
          ],
          serviceCategories: field(['Marketing']),
          conditions: [],
          dependencies: [],
          notes: field(null, 'absent'),
        },
        {
          id: 'ep-2',
          name: field('Alex'),
          email: field(null, 'absent'),
          role: field('Photographer'),
          participationModel: field('fixed_payout'),
          fixedAmount: field(600),
          revenueSharePct: field(null, 'absent'),
          deliverables: field(['50 edited images']),
          milestones: [
            {
              description: field('$150 bonus if attendance exceeds 500'),
              deadline: field(null, 'absent'),
              category: field('financial'),
            },
          ],
          serviceCategories: field(['Photography']),
          conditions: [],
          dependencies: [],
          notes: field(null, 'absent'),
        },
      ],
      paymentTerms: [],
      uncertainties: [],
      overallConfidence: 'high',
      sourceHint: null,
      extractedAt: '2026-06-12T00:00:00.000Z',
    } as ExtractionResult;

    const schedule = buildSettlementSchedule(result);
    expect(schedule).toHaveLength(2);
    expect(schedule[0]?.partyName).toBe('Sarah');
    expect(schedule[0]?.lines.some((line) => line.label === 'Fixed Fee')).toBe(true);
    expect(schedule[0]?.lines.some((line) => line.label === 'Revenue Share')).toBe(true);
    expect(schedule[1]?.lines.some((line) => line.label === 'Conditional Bonus')).toBe(true);
  });
});
