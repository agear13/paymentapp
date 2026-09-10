import {
  hederaPayoutProviderReference,
  selectHederaPreparePayees,
} from '@/lib/payouts/rails/hedera.adapter';
import type { CanonicalPayoutInstruction } from '@/lib/payouts/rails/types';

function instruction(
  overrides: Partial<CanonicalPayoutInstruction> & Pick<CanonicalPayoutInstruction, 'payoutId' | 'railId'>
): CanonicalPayoutInstruction {
  return {
    organizationId: 'org-1',
    batchId: 'batch-1',
    payeeUserId: `user-${overrides.payoutId}`,
    amount: '100',
    currency: 'USD',
    destinationKind: 'WALLET',
    idempotencyKey: `payout:org-1:${overrides.payoutId}`,
    providerReference: null,
    status: 'SUBMITTED',
    destination: {
      kind: 'WALLET',
      payoutMethodId: 'method-1',
      methodType: 'HEDERA',
      handle: null,
    },
    ...overrides,
  };
}

describe('Hedera payout adapter grouping', () => {
  it('groups only hedera-rail payouts and reports missing destinations', () => {
    const { payees, missingPayeeUserIds } = selectHederaPreparePayees(
      [
        instruction({ payoutId: 'p-hedera', railId: 'hedera' }),
        instruction({
          payoutId: 'p-manual',
          railId: 'manual',
          destinationKind: 'BANK_ACCOUNT',
          destination: {
            kind: 'BANK_ACCOUNT',
            payoutMethodId: 'method-2',
            methodType: 'BANK_TRANSFER',
            handle: 'acct',
          },
        }),
        instruction({ payoutId: 'p-missing', railId: 'hedera', payeeUserId: 'rachel' }),
      ],
      {
        'p-hedera': '0.0.1001',
        'p-manual': '0.0.9999',
        'p-missing': null,
      }
    );

    expect(payees).toEqual([
      {
        payoutId: 'p-hedera',
        userId: 'user-p-hedera',
        hederaAccountId: '0.0.1001',
        netAmount: '100',
      },
    ]);
    expect(missingPayeeUserIds).toEqual(['rachel']);
  });

  it('skips already terminal payouts', () => {
    const { payees } = selectHederaPreparePayees(
      [
        instruction({ payoutId: 'paid', railId: 'hedera', status: 'PAID' }),
        instruction({ payoutId: 'failed', railId: 'hedera', status: 'FAILED' }),
        instruction({ payoutId: 'open', railId: 'hedera', status: 'PROCESSING' }),
      ],
      {
        paid: '0.0.1',
        failed: '0.0.2',
        open: '0.0.3',
      }
    );
    expect(payees.map((row) => row.payoutId)).toEqual(['open']);
  });

  it('stores an opaque hedera: provider reference, not a domain column', () => {
    expect(hederaPayoutProviderReference('0.0.5363033@1769582713.055549545')).toBe(
      'hedera:0.0.5363033-1769582713.055549545'
    );
  });
});
