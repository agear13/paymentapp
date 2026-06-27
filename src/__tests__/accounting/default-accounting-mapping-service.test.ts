import { DefaultAccountingMappingService } from '@/lib/accounting/default-accounting-mapping-service';

describe('DefaultAccountingMappingService', () => {
  it('maps standard business defaults by active account type and preferred name', () => {
    const result = new DefaultAccountingMappingService().resolve([
      { code: '400', name: 'Sales', type: 'REVENUE', status: 'ACTIVE' },
      { code: '610', name: 'Bank Fees', type: 'EXPENSE', status: 'ACTIVE' },
      { code: '120', name: 'Accounts Receivable', type: 'CURRENT', status: 'ACTIVE' },
      { code: '105', name: 'Stripe Clearing', type: 'BANK', status: 'ACTIVE' },
    ]);

    expect(result.mappings).toEqual({
      revenueAccountCode: '400',
      receivableAccountCode: '120',
      processorFeeExpenseAccountCode: '610',
      stripeClearingAccountCode: '105',
    });
    expect(result.recommendations).toHaveLength(0);
  });

  it('ignores inactive accounts and leaves Stripe Clearing unmapped with a recommendation', () => {
    const result = new DefaultAccountingMappingService().resolve([
      { code: '401', name: 'Sales', type: 'REVENUE', status: 'ACTIVE' },
      { code: '121', name: 'Trade Debtors', type: 'CURRENT', status: 'ACTIVE' },
      { code: '611', name: 'Merchant Fees', type: 'OVERHEADS', status: 'ACTIVE' },
      { code: '999', name: 'Stripe Clearing', type: 'BANK', status: 'ARCHIVED' },
    ]);

    expect(result.mappings.stripeClearingAccountCode).toBeUndefined();
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'stripeClearingAccountCode' }),
      ])
    );
  });
});
