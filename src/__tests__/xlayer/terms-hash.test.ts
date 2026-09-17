import {
  computeCommitmentId,
  computeTermsHash,
  type CanonicalCommitmentTerms,
} from '@/lib/xlayer/terms-hash';

const baseTerms = (): CanonicalCommitmentTerms => ({
  sourceAgreementId: '11111111-1111-4111-8111-111111111111',
  amountMinorUnits: 10_000_000,
  sourceCurrency: 'AUD',
  settlementCurrency: 'AUD',
  dueDateUnix: 1_800_000_000,
  purpose: 'Inventory purchase',
  incentive: {
    status: 'approved',
    policyId: 'early_payment_discount_v1',
    acceleratedDays: 7,
    incentivePercent: 2,
    compensationType: 'conditional_bonus',
  },
});

describe('xlayer terms hashing', () => {
  it('computes a deterministic commitment ID from org + agreement + domain', () => {
    const first = computeCommitmentId('org-a', 'agr-a');
    const second = computeCommitmentId('org-a', 'agr-a');
    expect(first).toBe(second);
    expect(first).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('changes commitment ID when the organization changes', () => {
    expect(computeCommitmentId('org-a', 'agr-a')).not.toBe(computeCommitmentId('org-b', 'agr-a'));
  });

  it('computes a deterministic terms hash regardless of object insertion order', () => {
    const a = computeTermsHash(baseTerms());
    const reordered: CanonicalCommitmentTerms = {
      incentive: baseTerms().incentive,
      purpose: 'Inventory purchase',
      dueDateUnix: 1_800_000_000,
      settlementCurrency: 'AUD',
      sourceCurrency: 'AUD',
      amountMinorUnits: 10_000_000,
      sourceAgreementId: '11111111-1111-4111-8111-111111111111',
    };
    expect(computeTermsHash(reordered)).toBe(a);
  });

  it('changes hash when amount changes', () => {
    expect(computeTermsHash({ ...baseTerms(), amountMinorUnits: 9_999_900 })).not.toBe(
      computeTermsHash(baseTerms())
    );
  });

  it('changes hash when due date changes', () => {
    expect(computeTermsHash({ ...baseTerms(), dueDateUnix: 1_800_000_001 })).not.toBe(
      computeTermsHash(baseTerms())
    );
  });

  it('changes hash when incentive changes', () => {
    expect(computeTermsHash({ ...baseTerms(), incentive: null })).not.toBe(computeTermsHash(baseTerms()));
  });

  it('same terms produce the same hash', () => {
    expect(computeTermsHash(baseTerms())).toBe(computeTermsHash(baseTerms()));
  });
});
