import { deriveFundingCoordinationStage } from '@/lib/operations/truth/funding-coordination-semantics';

describe('funding coordination semantics (1C / 1D)', () => {
  it('labels no funding source when nothing is connected', () => {
    const stage = deriveFundingCoordinationStage({
      fundingSourceConnected: false,
      confirmedFunding: 0,
      obligationsTotal: 500,
      obligationsFunded: 0,
    });
    expect(stage.primaryLabel).toBe('No funding source added');
    expect(stage.blockerLabel).toContain('Add a funding source');
  });

  it('distinguishes source added from confirmed funding', () => {
    const added = deriveFundingCoordinationStage({
      hasFundingSourceRows: true,
      fundingSourceConnected: false,
      confirmedFunding: 0,
      obligationsTotal: 500,
      obligationsFunded: 0,
    });
    expect(added.primaryLabel).toContain('Funding source added');
    expect(added.fundingReserved).toBe(false);
  });

  it('uses Option C copy when treasury settled but obligations not allocated', () => {
    const stage = deriveFundingCoordinationStage({
      fundingSourceConnected: true,
      confirmedFunding: 500,
      obligationsTotal: 500,
      obligationsFunded: 0,
    });
    expect(stage.fundingSettled).toBe(true);
    expect(stage.releaseFunded).toBe(false);
    expect(stage.blockerLabel).toBe(
      'Funding secured. Allocation to payout obligations pending.'
    );
    expect(stage.primaryLabel).toContain('allocation pending');
  });

  it('marks release funded when obligations are covered', () => {
    const stage = deriveFundingCoordinationStage({
      fundingSourceConnected: true,
      confirmedFunding: 500,
      obligationsTotal: 500,
      obligationsFunded: 500,
    });
    expect(stage.releaseFunded).toBe(true);
    expect(stage.blockerLabel).toBeNull();
  });
});
