import {
  buildBalanceStatementInterval,
  findStatementTransactionForTransferId,
  wiseStatementReferenceNumberForTransfer,
} from '@/lib/wise/wise-balance-statement';

describe('wise balance statement helpers', () => {
  it('builds interval around occurred_at', () => {
    const interval = buildBalanceStatementInterval('2026-08-14T10:00:00.000Z');
    expect(interval.intervalStart).toBe('2026-08-13T10:00:00.000Z');
    expect(new Date(interval.intervalEnd).getTime()).toBeGreaterThan(
      new Date('2026-08-14T10:00:00.000Z').getTime()
    );
  });

  it('does not conflate Wise transfer id with customer payment reference', () => {
    const statement = {
      transactions: [
        {
          type: 'CREDIT' as const,
          date: '2026-08-14T10:00:00.000Z',
          amount: { value: 150, currency: 'AUD' },
          referenceNumber: wiseStatementReferenceNumberForTransfer(36454),
          details: {
            paymentReference: 'PROVVY-Ab12Cd34',
            type: 'DEPOSIT',
          },
        },
      ],
    };

    const tx = findStatementTransactionForTransferId(statement, 36454);
    expect(tx?.referenceNumber).toBe('TRANSFER-36454');
    expect(tx?.referenceNumber).not.toContain('PROVVY');
    expect(tx?.details?.paymentReference).toBe('PROVVY-Ab12Cd34');
  });

  it('returns null when multiple ambiguous matches exist', () => {
    const statement = {
      transactions: [
        {
          type: 'CREDIT' as const,
          date: '2026-08-14T10:00:00.000Z',
          amount: { value: 150, currency: 'AUD' },
          referenceNumber: 'OTHER-36454',
        },
        {
          type: 'CREDIT' as const,
          date: '2026-08-14T11:00:00.000Z',
          amount: { value: 150, currency: 'AUD' },
          referenceNumber: 'ALT-36454',
        },
      ],
    };

    expect(findStatementTransactionForTransferId(statement, 36454)).toBeNull();
  });
});
