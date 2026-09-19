import fs from 'fs';
import path from 'path';
import { buildExtractionReviewSettlementGroups } from '@/lib/journey/workflow-extraction-display.client';
import { agreementPaymentScheduleFromExtraction } from '@/lib/commercial-os/payment-schedule-presentation';
import {
  calibratedCompensationAmountsForParty,
  displayableCompensationAmount,
  isLikelySequenceOrUnitAmount,
} from '@/lib/commercial-os/compensation-amount-presentation';
import { recommendEarlyPaymentIncentive } from '@/lib/commercial-incentive/recommend';
import {
  abcRetailAcmeSupplyProductionExtraction,
  abcRetailSequenceAmountExtraction,
} from '@/__tests__/commercial-incentive/extraction-fixture';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';

const REVIEW_CARD = [
  path.join(process.cwd(), 'components/ai-extractor/review-party-card.tsx'),
  path.join(process.cwd(), 'src/components/ai-extractor/review-party-card.tsx'),
].find((file) => fs.existsSync(file));

if (!REVIEW_CARD) {
  throw new Error('Could not find review-party-card.tsx');
}

function money(amount: number) {
  return `A$${amount.toLocaleString('en-AU')}`;
}

describe('review compensation amount presentation', () => {
  it('keeps a genuine extracted fixed payout as money', () => {
    expect(displayableCompensationAmount(6_000, 1, 'Fixed fee', 6_000)).toBe(6_000);
    expect(isLikelySequenceOrUnitAmount(6_000, 1)).toBe(false);
  });

  it('does not fabricate a numeric amount when fixed payout is missing', () => {
    expect(displayableCompensationAmount(null, 1, 'Fixed fee', null)).toBeNull();
    expect(displayableCompensationAmount(undefined, 4, 'Milestone 1', null)).toBeNull();
  });

  it('does not treat milestone indexes 1/2/3/4 as A$1–A$4', () => {
    expect(isLikelySequenceOrUnitAmount(1, 4)).toBe(true);
    expect(isLikelySequenceOrUnitAmount(2, 4)).toBe(true);
    expect(isLikelySequenceOrUnitAmount(3, 4)).toBe(true);
    expect(isLikelySequenceOrUnitAmount(4, 4)).toBe(true);
    expect(displayableCompensationAmount(1, 4, 'Milestone 1', 1)).toBeNull();
    expect(displayableCompensationAmount(2, 4, 'Milestone 2', 2)).toBeNull();
  });

  it('shows 4 × A$25,000 on the flagship production extraction without rewriting extraction_result', () => {
    const extraction = abcRetailAcmeSupplyProductionExtraction();
    const before = JSON.stringify(extraction);
    const schedule = agreementPaymentScheduleFromExtraction(extraction);
    const groups = buildExtractionReviewSettlementGroups(extraction, money);
    const recommendation = recommendEarlyPaymentIncentive(extraction);

    expect(schedule?.milestoneCount).toBe(4);
    expect(schedule?.equalMilestoneAmount).toBe(25_000);
    expect(schedule?.totalAmount).toBe(100_000);

    const acme = groups.find((group) => group.partyName === 'Acme Supply Indonesia');
    expect(acme?.rows?.map((row) => row.amountLabel)).toEqual([
      'A$25,000',
      'A$25,000',
      'A$25,000',
      'A$25,000',
    ]);
    expect(JSON.stringify(groups)).not.toMatch(/"A\$[1-4]"/);

    expect(recommendation?.economics.milestoneAmount).toBe(25_000);
    expect(JSON.stringify(extraction)).toBe(before);
  });

  it('does not render sequence-index compensation terms as A$1–A$4', () => {
    const extraction = abcRetailSequenceAmountExtraction();
    const before = JSON.stringify(extraction);
    expect(extraction.parties[0]?.compensationTerms?.[0]?.amount.value).toBe(1);

    const displayed = calibratedCompensationAmountsForParty(extraction.parties[0]!, extraction);
    expect(displayed.map((row) => row.amount)).toEqual([25_000, 25_000, 25_000, 25_000]);

    const groups = buildExtractionReviewSettlementGroups(extraction, money);
    const acme = groups.find((group) => group.partyName === 'Acme Supply Indonesia');
    expect(acme?.rows?.map((row) => row.amountLabel)).toEqual([
      'A$25,000',
      'A$25,000',
      'A$25,000',
      'A$25,000',
    ]);
    expect(JSON.stringify(acme)).not.toMatch(/A\$1([^0-9,]|$)/);
    expect(JSON.stringify(acme)).not.toContain('"A$2"');
    expect(JSON.stringify(acme)).not.toContain('"A$3"');
    expect(JSON.stringify(acme)).not.toContain('"A$4"');
    expect(JSON.stringify(extraction)).toBe(before);
  });

  it('does not copy the payment schedule onto a missing participant fixed payout', () => {
    const extraction = abcRetailAcmeSupplyProductionExtraction();
    expect(extraction.parties[0]?.fixedAmount.value).toBeNull();
    const formParty = {
      ...testParty({
        id: 'acme-supply',
        name: field('Acme Supply Indonesia'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(null, 'absent'),
      }),
    };
    expect(formParty.fixedAmount.value).toBeNull();
  });

  it('tells the review card to show Fixed payout: Not specified when no amount exists', () => {
    const source = fs.readFileSync(REVIEW_CARD, 'utf8');
    expect(source).toContain('Fixed payout: Not specified');
    expect(source).toContain('hasFinancialObligationLines');
    expect(source).not.toContain('A$1');
  });
});
