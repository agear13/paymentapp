import { recommendEarlyPaymentIncentive } from '@/lib/commercial-incentive/recommend';
import { buildIncentiveDecisionRecord } from '@/lib/commercial-incentive/decision';
import {
  calculateEarlyPaymentEconomics,
  daysEarlier,
  incentiveDiscountAmount,
} from '@/lib/commercial-incentive/economics';
import { parseDelayedPaymentDays } from '@/lib/commercial-incentive/detect-delayed-terms';
import { EARLY_PAYMENT_ORIGIN } from '@/lib/commercial-incentive/types';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import {
  incentiveExtraction,
  net30FourMilestones,
} from '@/__tests__/commercial-incentive/extraction-fixture';

describe('commercial incentive recommendation', () => {
  it('produces an opportunity for Net 30', () => {
    const recommendation = recommendEarlyPaymentIncentive(net30FourMilestones());
    expect(recommendation).not.toBeNull();
    expect(recommendation?.standardDays).toBe(30);
    expect(recommendation?.acceleratedDays).toBe(7);
    expect(recommendation?.incentivePercent).toBe(2);
    expect(recommendation?.status).toBe('proposed');
    expect(recommendation?.origin).toBe(EARLY_PAYMENT_ORIGIN);
    expect(recommendation?.compensationType).toBe('conditional_bonus');
  });

  it('produces an opportunity for Net 60', () => {
    const result = incentiveExtraction({
      paymentTerms: [
        {
          description: field('Delivery payment'),
          amount: field(25_000),
          currency: field('AUD'),
          dueCondition: field('Net 60'),
        },
      ],
    });
    expect(recommendEarlyPaymentIncentive(result)?.standardDays).toBe(60);
    expect(recommendEarlyPaymentIncentive(result)?.economics.daysEarlier).toBe(53);
  });

  it('does not recommend when there is no delayed-payment condition', () => {
    const result = incentiveExtraction({
      paymentTerms: [
        {
          description: field('Due on delivery'),
          amount: field(25_000),
          currency: field('AUD'),
          dueCondition: field('Due on delivery'),
        },
      ],
    });
    expect(recommendEarlyPaymentIncentive(result)).toBeNull();
  });

  it('does not fabricate a recommendation from missing or ambiguous timing', () => {
    expect(
      recommendEarlyPaymentIncentive(
        incentiveExtraction({
          paymentTerms: [
            {
              description: field('Payment'),
              amount: field(25_000),
              currency: field('AUD'),
              dueCondition: field(null, 'absent'),
            },
          ],
        })
      )
    ).toBeNull();
    expect(recommendEarlyPaymentIncentive(incentiveExtraction({ paymentTerms: [] }))).toBeNull();
    expect(parseDelayedPaymentDays('as agreed')).toBeNull();
  });

  it('does not recommend when an early-payment discount is already extracted', () => {
    const result = incentiveExtraction({
      paymentTerms: [
        {
          description: field('2% discount if paid within 7 days'),
          amount: field(25_000),
          currency: field('AUD'),
          dueCondition: field('Net 30'),
        },
      ],
    });
    expect(recommendEarlyPaymentIncentive(result)).toBeNull();

    const withBonus = incentiveExtraction({
      paymentTerms: [
        {
          description: field('Inventory batch'),
          amount: field(25_000),
          currency: field('AUD'),
          dueCondition: field('Net 30'),
        },
      ],
      parties: [
        testParty({
          conditionalPayments: [
            { trigger: field('Early pay 2% if paid within 7 days'), amount: field(500) },
          ],
        }),
      ],
    });
    expect(recommendEarlyPaymentIncentive(withBonus)).toBeNull();
  });

  it('calculates A$25,000 × 2% = A$500 and 30 → 7 = 23 days earlier', () => {
    expect(incentiveDiscountAmount(25_000, 2)).toBe(500);
    expect(daysEarlier(30, 7)).toBe(23);
    const economics = calculateEarlyPaymentEconomics({
      milestoneAmounts: [25_000],
      currency: 'AUD',
      standardDays: 30,
    });
    expect(economics.milestoneDiscountAmount).toBe(500);
    expect(economics.earlyPaymentAmount).toBe(24_500);
    expect(economics.daysEarlier).toBe(23);
  });

  it('treats four × A$25,000 as A$2,000 illustrative total, not guaranteed savings', () => {
    const recommendation = recommendEarlyPaymentIncentive(net30FourMilestones());
    expect(recommendation?.economics.milestoneCount).toBe(4);
    expect(recommendation?.economics.totalIllustrativeDiscount).toBe(2_000);
    expect(recommendation?.economics.amountsReliable).toBe(true);
  });

  it('does not invent milestone amounts when extracted terms omit them', () => {
    const result = incentiveExtraction({
      paymentTerms: [
        {
          description: field('Payment 30 days after each delivery'),
          amount: field(null, 'absent'),
          currency: field('AUD'),
          dueCondition: field('30 days after each delivery'),
        },
      ],
    });
    const recommendation = recommendEarlyPaymentIncentive(result);
    expect(recommendation).not.toBeNull();
    expect(recommendation?.economics.amountsReliable).toBe(false);
    expect(recommendation?.economics.milestoneAmount).toBeNull();
    expect(recommendation?.economics.totalIllustrativeDiscount).toBeNull();
  });

  it('marks the recommendation as proposed, not extracted, and leaves source terms untouched', () => {
    const result = net30FourMilestones();
    const before = JSON.stringify(result.paymentTerms);
    const recommendation = recommendEarlyPaymentIncentive(result);
    expect(recommendation?.origin).toBe('provvy_recommendation');
    expect(recommendation?.status).toBe('proposed');
    expect(JSON.stringify(result.paymentTerms)).toBe(before);
    expect(result.paymentTerms[0].dueCondition.value).toBe('Net 30');
  });
});

describe('commercial incentive approval', () => {
  it('requires an explicit approve action before the incentive is added', () => {
    const recommendation = recommendEarlyPaymentIncentive(net30FourMilestones());
    expect(recommendation?.status).toBe('proposed');
    const approved = buildIncentiveDecisionRecord({
      recommendation: recommendation!,
      action: 'approve',
      sourceAgreementId: '11111111-1111-1111-1111-111111111111',
      workflowId: '22222222-2222-2222-2222-222222222222',
      decidedByUserId: 'user-1',
      decidedAt: '2026-09-17T00:00:00.000Z',
    });
    expect(approved.status).toBe('approved');
    expect(approved.origin).toBe('provvy_recommendation');
    expect(approved.sourceAgreementId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('leaves extracted terms unchanged when the operator chooses Not now', () => {
    const result = net30FourMilestones();
    const before = JSON.stringify(result);
    const recommendation = recommendEarlyPaymentIncentive(result);
    const dismissed = buildIncentiveDecisionRecord({
      recommendation: recommendation!,
      action: 'dismiss',
      sourceAgreementId: '11111111-1111-1111-1111-111111111111',
      workflowId: '22222222-2222-2222-2222-222222222222',
      decidedByUserId: 'user-1',
      decidedAt: '2026-09-17T00:00:00.000Z',
    });
    expect(dismissed.status).toBe('dismissed');
    expect(JSON.stringify(result)).toBe(before);
  });

  it('keeps the approved incentive distinguishable from the source agreement', () => {
    const recommendation = recommendEarlyPaymentIncentive(net30FourMilestones())!;
    const approved = buildIncentiveDecisionRecord({
      recommendation,
      action: 'approve',
      sourceAgreementId: '11111111-1111-1111-1111-111111111111',
      workflowId: '22222222-2222-2222-2222-222222222222',
      decidedByUserId: 'user-1',
      decidedAt: '2026-09-17T00:00:00.000Z',
    });
    expect(approved.origin).not.toBe('extracted');
    expect(approved.sourceDueLabel).toMatch(/Net 30|30 days/);
    expect(approved.label).toMatch(/2%/);
    expect(approved.compensationType).toBe('conditional_bonus');
  });
});
