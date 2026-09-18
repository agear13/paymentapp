import fs from 'fs';
import path from 'path';
import { incentiveDiscountAmount, daysEarlier } from '@/lib/commercial-incentive/economics';
import { recommendEarlyPaymentIncentive } from '@/lib/commercial-incentive/recommend';
import { field } from '@/lib/ai-extractor/test-helpers/party-fixture';
import {
  incentiveExtraction,
  net30FourMilestones,
} from '@/__tests__/commercial-incentive/extraction-fixture';

const CARD = [
  path.join(process.cwd(), 'components/commercial-incentive/early-payment-incentive-card.tsx'),
  path.join(process.cwd(), 'src/components/commercial-incentive/early-payment-incentive-card.tsx'),
].find((file) => fs.existsSync(file));

if (!CARD) {
  throw new Error('Could not find early-payment-incentive-card.tsx');
}

describe('early-payment incentive presentation', () => {
  const source = fs.readFileSync(CARD, 'utf8');

  it('keeps original Net 30 separate from the Provvy recommendation', () => {
    expect(source).toContain('Source agreement');
    expect(source).toContain('Provvy recommendation');
    expect(source).toContain('Pay within ${');
    expect(source).toContain('Recommendation — awaiting your approval');
    expect(source).toContain('Awaiting supplier acceptance');
    expect(source).not.toMatch(/supplier accepted/i);
    expect(source).not.toMatch(/payment sent/i);
    expect(source).toContain('not supplier acceptance');
    expect(source).not.toContain('Approved addition');
  });

  it('shows milestone economics without executing payment', () => {
    expect(source).toContain('Standard payment');
    expect(source).toContain('Early payment');
    expect(source).toContain('Potential saving');
    expect(source).toContain('Supplier paid');
    expect(source).not.toContain('sendErc20Payment');
    expect(source).not.toContain('createTransfer');
  });

  it('does not rewrite four A$25,000 terms into a different extracted due date', () => {
    const result = net30FourMilestones();
    const before = JSON.stringify(result.paymentTerms);
    const recommendation = recommendEarlyPaymentIncentive(result);
    expect(recommendation?.economics.milestoneCount).toBe(4);
    expect(recommendation?.economics.milestoneAmount).toBe(25_000);
    expect(incentiveDiscountAmount(25_000, 2)).toBe(500);
    expect(recommendation?.economics.earlyPaymentAmount).toBe(24_500);
    expect(daysEarlier(30, 7)).toBe(23);
    expect(JSON.stringify(result.paymentTerms)).toBe(before);
    expect(result.paymentTerms[0].dueCondition.value).toBe('Net 30');
  });

  it('keeps Net 30 from invoice date as extracted text, separate from the 7-day option', () => {
    const result = incentiveExtraction({
      paymentTerms: [1, 2, 3, 4].map((batch) => ({
        description: field(`Batch ${batch} delivery`),
        amount: field(25_000),
        currency: field('AUD'),
        dueCondition: field('Net 30 from invoice date'),
      })),
    });
    const before = JSON.stringify(result.paymentTerms);
    const recommendation = recommendEarlyPaymentIncentive(result);
    expect(recommendation).not.toBeNull();
    expect(recommendation?.acceleratedDays).toBe(7);
    expect(recommendation?.incentivePercent).toBe(2);
    expect(recommendation?.delayedTerms[0].dueCondition).toBe('Net 30 from invoice date');
    expect(JSON.stringify(result.paymentTerms)).toBe(before);
    expect(
      result.paymentTerms.every((term) => term.dueCondition.value === 'Net 30 from invoice date')
    ).toBe(true);
  });
});
