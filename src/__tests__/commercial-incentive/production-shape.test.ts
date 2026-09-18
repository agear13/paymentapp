import { recommendEarlyPaymentIncentive } from '@/lib/commercial-incentive/recommend';
import { originalDueLabelsFromExtraction } from '@/lib/commercial-incentive/canonical-payment-terms';
import { daysEarlier, incentiveDiscountAmount } from '@/lib/commercial-incentive/economics';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import {
  abcRetailAcmeSupplyProductionExtraction,
  incentiveExtraction,
} from '@/__tests__/commercial-incentive/extraction-fixture';

describe('production extraction shape → commercial incentive', () => {
  it('returns a recommendation for within 30 days of invoice date on compensationTerms.trigger', () => {
    const result = abcRetailAcmeSupplyProductionExtraction();
    const before = JSON.stringify(result);
    const recommendation = recommendEarlyPaymentIncentive(result);

    expect(result.paymentTerms).toEqual([]);
    expect(result.parties[0]?.compensationTerms?.[0]?.trigger.value).toBe(
      'Within 30 days of invoice date'
    );
    expect(originalDueLabelsFromExtraction(result)).toContain('Within 30 days of invoice date');
    expect(recommendation).not.toBeNull();
    expect(recommendation?.standardDays).toBe(30);
    expect(recommendation?.sourceDueLabel).toBe('Net 30');
    expect(recommendation?.acceleratedDays).toBe(7);
    expect(recommendation?.incentivePercent).toBe(2);
    expect(recommendation?.status).toBe('proposed');
    expect(recommendation?.origin).toBe('provvy_recommendation');
    expect(recommendation?.economics.milestoneAmount).toBe(25_000);
    expect(recommendation?.economics.earlyPaymentAmount).toBe(24_500);
    expect(recommendation?.economics.milestoneDiscountAmount).toBe(500);
    expect(recommendation?.economics.daysEarlier).toBe(23);
    expect(recommendation?.economics.milestoneCount).toBe(4);
    expect(recommendation?.economics.totalIllustrativeDiscount).toBe(2_000);
    expect(incentiveDiscountAmount(25_000, 2)).toBe(500);
    expect(daysEarlier(30, 7)).toBe(23);
    expect(JSON.stringify(result)).toBe(before);
    expect(result.parties[0]?.notes.value).toMatch(/No early-payment discount included/);
  });

  it('returns a recommendation for Net 30 on paymentTerms.dueCondition', () => {
    const recommendation = recommendEarlyPaymentIncentive(
      incentiveExtraction({
        paymentTerms: [
          {
            description: field('Milestone 1'),
            amount: field(25_000),
            currency: field('AUD'),
            dueCondition: field('Net 30'),
          },
        ],
      })
    );
    expect(recommendation?.standardDays).toBe(30);
    expect(recommendation?.sourceDueLabel).toBe('Net 30');
  });

  it('returns a recommendation for Net 45', () => {
    expect(
      recommendEarlyPaymentIncentive(
        incentiveExtraction({
          paymentTerms: [
            {
              description: field('Delivery payment'),
              amount: field(25_000),
              currency: field('AUD'),
              dueCondition: field('Net 45'),
            },
          ],
        })
      )?.standardDays
    ).toBe(45);
  });

  it('returns a recommendation for Net 60', () => {
    expect(
      recommendEarlyPaymentIncentive(
        incentiveExtraction({
          paymentTerms: [
            {
              description: field('Delivery payment'),
              amount: field(25_000),
              currency: field('AUD'),
              dueCondition: field('Net 60'),
            },
          ],
        })
      )?.standardDays
    ).toBe(60);
  });

  it('does not recommend when timing is missing', () => {
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
  });

  it('does not recommend when timing is ambiguous', () => {
    expect(
      recommendEarlyPaymentIncentive(
        incentiveExtraction({
          paymentTerms: [
            {
              description: field('Payment'),
              amount: field(25_000),
              currency: field('AUD'),
              dueCondition: field('as agreed'),
            },
          ],
        })
      )
    ).toBeNull();
  });

  it('does not recommend when an early-payment discount is already extracted', () => {
    expect(
      recommendEarlyPaymentIncentive(
        incentiveExtraction({
          paymentTerms: [
            {
              description: field('2% discount if paid within 7 days'),
              amount: field(25_000),
              currency: field('AUD'),
              dueCondition: field('Net 30'),
            },
          ],
        })
      )
    ).toBeNull();
  });

  it('returns a recommendation when notes say no early-payment discount is included', () => {
    const result = incentiveExtraction({
      paymentTerms: [
        {
          description: field('Milestone payment'),
          amount: field(25_000),
          currency: field('AUD'),
          dueCondition: field('Net 30'),
        },
      ],
      parties: [
        testParty({
          notes: field('No early-payment discount included.'),
        }),
      ],
    });
    expect(recommendEarlyPaymentIncentive(result)).not.toBeNull();
  });

  it('does not imply supplier acceptance or execute payment', () => {
    const recommendation = recommendEarlyPaymentIncentive(
      abcRetailAcmeSupplyProductionExtraction()
    );
    expect(recommendation?.status).toBe('proposed');
    expect(recommendation?.origin).toBe('provvy_recommendation');
    expect(JSON.stringify(recommendation)).not.toMatch(/supplier accepted/i);
    expect(JSON.stringify(recommendation)).not.toContain('sendErc20Payment');
    expect(JSON.stringify(recommendation)).not.toContain('createTransfer');
  });

  it('returns a recommendation when paymentTerms.dueCondition is within 30 days of invoice date', () => {
    const recommendation = recommendEarlyPaymentIncentive(
      incentiveExtraction({
        paymentTerms: [1, 2, 3, 4].map((index) => ({
          description: field(`Milestone ${index}`),
          amount: field(25_000),
          currency: field('AUD'),
          dueCondition: field('Within 30 days of invoice date'),
        })),
      })
    );
    expect(recommendation?.standardDays).toBe(30);
    expect(recommendation?.economics.milestoneCount).toBe(4);
    expect(recommendation?.sourceDueLabel).toBe('Net 30');
  });

  it('uses settlementRules.trigger when milestone compensation terms omit their own timing', () => {
    const recommendation = recommendEarlyPaymentIncentive(
      incentiveExtraction({
        paymentTerms: [],
        settlementRules: [
          {
            trigger: field('Each milestone invoice payable within 30 days of invoice date'),
            basis: field(null, 'absent'),
          },
        ],
        parties: [
          testParty({
            compensationTerms: [
              {
                id: 'ms-1',
                type: 'milestone',
                label: field('Milestone 1'),
                amount: field(25_000),
                percentage: field(null, 'absent'),
                trigger: field(null, 'absent'),
                deadline: field(null, 'absent'),
                revenueBasis: field(null, 'absent'),
                sequenceIndex: 1,
                confidence: 'high',
              },
            ],
          }),
        ],
      })
    );
    expect(recommendation?.standardDays).toBe(30);
    expect(recommendation?.economics.milestoneAmount).toBe(25_000);
  });
});
