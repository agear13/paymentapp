import { net30FourMilestones } from '@/__tests__/commercial-incentive/extraction-fixture';
import {
  amountMinorUnitsFromExtraction,
  buyerLabelFromExtraction,
  currencyFromExtraction,
  incentiveSnapshotFromDecision,
  supplierLabelFromExtraction,
} from '@/lib/xlayer/derive-commitment';
import type { EarlyPaymentIncentiveRecord } from '@/lib/commercial-incentive/types';

describe('xlayer commitment derivation', () => {
  it('uses extracted A$100,000 as 10,000,000 minor units', () => {
    expect(amountMinorUnitsFromExtraction(net30FourMilestones())).toBe(10_000_000);
  });

  it('uses AUD from the extraction', () => {
    expect(currencyFromExtraction(net30FourMilestones())).toBe('AUD');
  });

  it('uses counterparty as supplier when no supplier party exists', () => {
    expect(supplierLabelFromExtraction(net30FourMilestones())).toBe('ABC Retail Pty Ltd');
  });

  it('falls back to Buyer when no owner is present', () => {
    expect(buyerLabelFromExtraction(net30FourMilestones())).toBe('Buyer');
  });

  it('includes approved incentive only', () => {
    expect(incentiveSnapshotFromDecision(null)).toBeNull();
    const approved = {
      status: 'approved',
      policyId: 'early_payment_discount_v1',
      acceleratedDays: 7,
      incentivePercent: 2,
      compensationType: 'conditional_bonus',
    } as EarlyPaymentIncentiveRecord;
    expect(incentiveSnapshotFromDecision(approved)).toMatchObject({
      status: 'approved',
      incentivePercent: 2,
    });
    expect(incentiveSnapshotFromDecision({ ...approved, status: 'dismissed' })).toBeNull();
  });
});
