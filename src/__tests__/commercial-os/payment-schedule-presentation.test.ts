import fs from 'fs';
import path from 'path';
import {
  agreementPaymentScheduleFromTerms,
  formatScheduleMoney,
} from '@/lib/commercial-os/payment-schedule-presentation';

const CARD = [
  path.join(process.cwd(), 'components/commercial-os/agreement-payment-schedule-card.tsx'),
  path.join(process.cwd(), 'src/components/commercial-os/agreement-payment-schedule-card.tsx'),
].find((file) => fs.existsSync(file));

if (!CARD) {
  throw new Error('Could not find agreement-payment-schedule-card.tsx');
}

describe('agreement payment schedule presentation', () => {
  it('shows 4 × A$25,000 as A$100,000 with next and remaining', () => {
    const schedule = agreementPaymentScheduleFromTerms(
      [1, 2, 3, 4].map((batch) => ({
        description: `Batch ${batch} delivery`,
        amount: 25_000,
        currency: 'AUD',
        dueCondition: 'Net 30 from invoice date',
      })),
      100_000,
      'AUD'
    );

    expect(schedule).not.toBeNull();
    expect(schedule?.milestoneCount).toBe(4);
    expect(schedule?.equalMilestoneAmount).toBe(25_000);
    expect(schedule?.totalAmount).toBe(100_000);
    expect(schedule?.next?.index).toBe(1);
    expect(schedule?.next?.amount).toBe(25_000);
    expect(schedule?.next?.dueLabel).toBe('Net 30 from invoice date');
    expect(schedule?.remainingCount).toBe(3);
    expect(schedule?.remainingAmount).toBe(75_000);
    expect(formatScheduleMoney(25_000, 'AUD')).toBe('A$25,000');
    expect(formatScheduleMoney(100_000, 'AUD')).toBe('A$100,000');
  });

  it('does not invent equal milestone amounts when extracted amounts are missing', () => {
    const schedule = agreementPaymentScheduleFromTerms(
      [
        {
          description: 'Delivery',
          amount: null,
          currency: 'AUD',
          dueCondition: 'Net 30',
        },
      ],
      100_000,
      'AUD'
    );
    expect(schedule?.equalMilestoneAmount).toBeNull();
    expect(schedule?.totalAmount).toBe(100_000);
  });

  it('keeps the extracted due label unchanged', () => {
    const schedule = agreementPaymentScheduleFromTerms([
      {
        description: 'Milestone 1',
        amount: 25_000,
        currency: 'AUD',
        dueCondition: 'Net 30',
      },
    ]);
    expect(schedule?.next?.dueLabel).toBe('Net 30');
  });

  it('presents the full schedule separately from the next obligation', () => {
    const source = fs.readFileSync(CARD, 'utf8');
    expect(source).toContain('Payment schedule');
    expect(source).toContain('Total commitment');
    expect(source).toContain('Next obligation');
    expect(source).toContain('Remaining');
    expect(source).not.toContain('sendErc20Payment');
  });
});
