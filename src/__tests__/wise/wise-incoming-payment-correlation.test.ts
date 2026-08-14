import {
  buildWiseTransferSettlementKey,
  correlateAccountDetailsPaymentStateChange,
  correlateSwiftInCreditEvent,
  correlateWiseBalanceCreditEvent,
  buildWiseWebhookDedupKey,
} from '@/lib/wise/wise-incoming-payment-correlation';
import {
  buildProvvyWiseReference,
  parseProvvyPaymentReference,
} from '@/lib/wise/wise-payment-reference';
import {
  findStatementTransactionForTransferId,
  wiseStatementReferenceNumberForTransfer,
} from '@/lib/wise/wise-balance-statement';

const sampleLink = (overrides: Record<string, unknown> = {}) => ({
  id: 'link-1',
  short_code: 'Ab12Cd34',
  status: 'OPEN',
  amount: 150,
  currency: 'AUD',
  invoice_currency: 'AUD',
  payment_method: 'WISE',
  organization_id: 'org-1',
  wise_status: 'INSTRUCTIONS_READY',
  ...overrides,
});

const merchantProfile = { wise_profile_id: '999', wise_enabled: true };

describe('parseProvvyPaymentReference', () => {
  it('extracts short code from PROVVY reference', () => {
    expect(parseProvvyPaymentReference('PROVVY-Ab12Cd34')).toBe('Ab12Cd34');
    expect(parseProvvyPaymentReference('payment PROVVY-Ab12Cd34 extra')).toBe('Ab12Cd34');
  });

  it('rejects invalid references', () => {
    expect(parseProvvyPaymentReference('INV-123')).toBeNull();
    expect(parseProvvyPaymentReference('PROVVY-short')).toBeNull();
    expect(parseProvvyPaymentReference('BNK-1234567')).toBeNull();
  });
});

describe('correlateWiseBalanceCreditEvent', () => {
  it('C: ignores balances#update — does not treat BNK-1234567 as Provvy reference', () => {
    const result = correlateWiseBalanceCreditEvent({
      payload: {
        event_type: 'balances#update',
        delivery_id: 'delivery-1',
        data: {
          resource: { profile_id: 999, type: 'balance-account' },
          amount: 150,
          currency: 'AUD',
          transaction_type: 'credit',
          transfer_reference: 'BNK-1234567',
          step_id: 12345,
        },
      },
    });

    expect(result.status).toBe('ignored');
    if (result.status === 'ignored') {
      expect(result.reason).toContain('account-details-payment');
    }
  });
});

describe('correlateAccountDetailsPaymentStateChange', () => {
  const completedPayload = {
    event_type: 'account-details-payment#state-change',
    delivery_id: 'delivery-ad-1',
    data: {
      resource: { id: 64, profile_id: 999, type: 'balance-account' },
      transfer: { id: 36454, amount: 150, currency: 'AUD' },
      current_state: 'COMPLETED',
      occurred_at: '2026-08-14T10:00:00.000Z',
    },
  };

  it('A/D: correlates COMPLETED pay-in when statement has PROVVY reference', () => {
    const result = correlateAccountDetailsPaymentStateChange({
      payload: completedPayload,
      customerPaymentReference: 'PROVVY-Ab12Cd34',
      paymentLink: sampleLink(),
      merchantProfile,
      statementFound: true,
    });

    expect(result.status).toBe('correlated');
    if (result.status === 'correlated') {
      expect(result.paymentLinkId).toBe('link-1');
      expect(result.reference).toBe('PROVVY-Ab12Cd34');
      expect(result.wiseTransferId).toBe('36454');
      expect(result.providerRef).toBe(buildWiseTransferSettlementKey('36454'));
    }
  });

  it('B: ignores PROCESSING state', () => {
    const result = correlateAccountDetailsPaymentStateChange({
      payload: {
        ...completedPayload,
        data: { ...completedPayload.data, current_state: 'PROCESSING' },
      },
      customerPaymentReference: 'PROVVY-Ab12Cd34',
      paymentLink: sampleLink(),
      merchantProfile,
      statementFound: true,
    });

    expect(result.status).toBe('ignored');
  });

  it('E: rejects missing customer reference', () => {
    const result = correlateAccountDetailsPaymentStateChange({
      payload: completedPayload,
      customerPaymentReference: null,
      paymentLink: null,
      merchantProfile: null,
      statementFound: true,
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'rejected', reason: 'missing_customer_reference' })
    );
  });

  it('F: rejects malformed reference', () => {
    const result = correlateAccountDetailsPaymentStateChange({
      payload: completedPayload,
      customerPaymentReference: 'BNK-1234567',
      paymentLink: sampleLink(),
      merchantProfile,
      statementFound: true,
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'rejected', reason: 'invalid_provvvy_reference' })
    );
  });

  it('G: rejects wrong amount', () => {
    const result = correlateAccountDetailsPaymentStateChange({
      payload: {
        ...completedPayload,
        data: {
          ...completedPayload.data,
          transfer: { id: 36454, amount: 149.5, currency: 'AUD' },
        },
      },
      customerPaymentReference: 'PROVVY-Ab12Cd34',
      paymentLink: sampleLink({ amount: 150 }),
      merchantProfile,
      statementFound: true,
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'rejected', reason: 'amount_mismatch' })
    );
  });

  it('H: rejects wrong currency', () => {
    const result = correlateAccountDetailsPaymentStateChange({
      payload: {
        ...completedPayload,
        data: {
          ...completedPayload.data,
          transfer: { id: 36454, amount: 150, currency: 'USD' },
        },
      },
      customerPaymentReference: 'PROVVY-Ab12Cd34',
      paymentLink: sampleLink(),
      merchantProfile,
      statementFound: true,
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'rejected', reason: 'currency_mismatch' })
    );
  });

  it('I: rejects wrong Wise profile', () => {
    const result = correlateAccountDetailsPaymentStateChange({
      payload: completedPayload,
      customerPaymentReference: 'PROVVY-Ab12Cd34',
      paymentLink: sampleLink(),
      merchantProfile: { wise_profile_id: '111', wise_enabled: true },
      statementFound: true,
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'rejected', reason: 'profile_mismatch' })
    );
  });

  it('K: same amount two invoices — reference selects correct link', () => {
    const result = correlateAccountDetailsPaymentStateChange({
      payload: completedPayload,
      customerPaymentReference: 'PROVVY-Xy99Zz88',
      paymentLink: sampleLink({ id: 'link-2', short_code: 'Xy99Zz88', amount: 150 }),
      merchantProfile,
      statementFound: true,
    });

    expect(result.status).toBe('correlated');
    if (result.status === 'correlated') {
      expect(result.paymentLinkId).toBe('link-2');
      expect(result.shortCode).toBe('Xy99Zz88');
    }
  });
});

describe('correlateSwiftInCreditEvent', () => {
  const swiftPayload = {
    event_type: 'swift-in#credit',
    delivery_id: 'delivery-swift-1',
    data: {
      action: { type: 'credit', id: 12345, profile_id: 999, account_id: 333 },
      resource: {
        reference: 'PROVVY-Ab12Cd34',
        settled_amount: { value: 150, currency: 'AUD' },
      },
      occurred_at: '2026-08-14T10:00:00.000Z',
    },
  };

  it('L: correlates SWIFT credit with PROVVY reference', () => {
    const result = correlateSwiftInCreditEvent({
      payload: swiftPayload,
      paymentLink: sampleLink(),
      merchantProfile,
    });

    expect(result.status).toBe('correlated');
    if (result.status === 'correlated') {
      expect(result.wiseTransferId).toBe('12345');
    }
  });

  it('M: rejects SWIFT without reference', () => {
    const result = correlateSwiftInCreditEvent({
      payload: {
        ...swiftPayload,
        data: {
          ...swiftPayload.data,
          resource: { settled_amount: { value: 150, currency: 'AUD' } },
        },
      },
      paymentLink: sampleLink(),
      merchantProfile,
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'rejected', reason: 'missing_customer_reference' })
    );
  });
});

describe('balance statement lookup helpers', () => {
  it('maps transfer id to TRANSFER-{id} referenceNumber', () => {
    expect(wiseStatementReferenceNumberForTransfer(36454)).toBe('TRANSFER-36454');
  });

  it('finds statement transaction by TRANSFER-{id} and reads paymentReference separately', () => {
    const statement = {
      transactions: [
        {
          type: 'CREDIT' as const,
          date: '2026-08-14T10:00:00.000Z',
          amount: { value: 150, currency: 'AUD' },
          referenceNumber: 'TRANSFER-36454',
          details: { paymentReference: 'PROVVY-Ab12Cd34' },
        },
        {
          type: 'CREDIT' as const,
          date: '2026-08-14T11:00:00.000Z',
          amount: { value: 150, currency: 'AUD' },
          referenceNumber: 'TRANSFER-99999',
          details: { paymentReference: 'PROVVY-Xy99Zz88' },
        },
      ],
    };

    const match = findStatementTransactionForTransferId(statement, 36454);
    expect(match?.referenceNumber).toBe('TRANSFER-36454');
    expect(match?.details?.paymentReference).toBe('PROVVY-Ab12Cd34');
    expect(parseProvvyPaymentReference(match?.details?.paymentReference)).toBe('Ab12Cd34');
  });
});

describe('buildWiseWebhookDedupKey', () => {
  it('prefers delivery_id', () => {
    expect(
      buildWiseWebhookDedupKey({
        delivery_id: 'abc',
        event_type: 'account-details-payment#state-change',
      })
    ).toBe('wise:delivery:abc');
  });
});

describe('buildProvvyWiseReference', () => {
  it('matches invoice reference format', () => {
    expect(buildProvvyWiseReference('Ab12Cd34')).toBe('PROVVY-Ab12Cd34');
  });
});
