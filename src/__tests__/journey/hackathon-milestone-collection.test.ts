import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import {
  deriveHackathonMilestoneCollection,
  deriveHackathonMilestonePaymentDueLabel,
  formatHackathonMilestoneDisplayLabel,
  formatMilestoneConditionSatisfiedLabel,
} from '@/lib/journey/hackathon-milestone-collection.client';

function field<T>(value: T) {
  return { value, confidence: 'high' as const };
}

describe('deriveHackathonMilestoneCollection', () => {
  it('uses an explicit payment term amount when the trigger mentions ticket sales', () => {
    const result = {
      projectValue: field(10000),
      paymentTerms: [
        {
          description: field('Deposit'),
          amount: field(3000),
          currency: field('AUD'),
          dueCondition: field('On agreement approval'),
        },
        {
          description: field('Milestone tranche'),
          amount: field(4000),
          currency: field('AUD'),
          dueCondition: field('Once 2,000 validated ticket sales are reached'),
        },
      ],
    } as unknown as ExtractionResult;

    const milestone = deriveHackathonMilestoneCollection(result, 48600, 'AUD');
    expect(milestone.amount).toBe(4000);
    expect(milestone.source).toBe('payment_term');
  });

  it('falls back to 40% of project value when no milestone term is available', () => {
    const result = {
      projectValue: field(10000),
      paymentTerms: [],
    } as unknown as ExtractionResult;

    const milestone = deriveHackathonMilestoneCollection(result, 10000, 'AUD');
    expect(milestone.amount).toBe(4000);
    expect(milestone.source).toBe('fixed_fallback');
    expect(deriveHackathonMilestonePaymentDueLabel(milestone, 10000)).toBe(
      '40% Milestone Payment Now Due',
    );
  });

  it('formats duplicated milestone copy into one concise sentence', () => {
    const label = formatHackathonMilestoneDisplayLabel(
      '40% instalment for all suppliers upon reaching 2,000 paid and validated ticket sales',
      '2,000 paid and validated ticket sales reached',
    );
    expect(label).toBe('40% milestone payment when 2,000 validated ticket sales are reached');
    expect(label).not.toMatch(/2,000.*2,000/);
  });

  it('formats contractual condition copy in past tense', () => {
    expect(
      formatMilestoneConditionSatisfiedLabel(
        'Once 2,000 paid and validated ticket sales have been reached',
      ),
    ).toBe('2,000 paid and validated ticket sales reached.');
  });

  it('derives milestone amount from percentage payment terms', () => {
    const result = {
      projectValue: field(3300),
      paymentTerms: [
        {
          description: field('40% instalment for all suppliers upon reaching 2,000 paid and validated ticket sales'),
          amount: field(40),
          currency: field('AUD'),
          dueCondition: field('2,000 paid and validated ticket sales reached'),
        },
      ],
    } as unknown as ExtractionResult;

    const milestone = deriveHackathonMilestoneCollection(result, 3300, 'AUD');
    expect(milestone.amount).toBe(1320);
    expect(milestone.milestoneLabel).toBe(
      '40% milestone payment when 2,000 validated ticket sales are reached',
    );
    expect(milestone.milestoneConditionLabel).toBe(
      '2,000 paid and validated ticket sales reached.',
    );
  });
});
