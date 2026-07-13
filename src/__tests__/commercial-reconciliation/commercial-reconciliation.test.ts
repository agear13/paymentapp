/**
 * Commercial Reconciliation Engine tests.
 */

import {
  CommercialReconciliationStatus,
  deriveClearingAccount,
  deriveCommercialReconciliation,
  derivePaymentAllocation,
  deriveReconciliationStatus,
  isSettlementEligibleAfterReconciliation,
  normalizeCommercialPaymentEvents,
  StripeReconciliationAdapter,
  WiseReconciliationAdapter,
  ManualBankReconciliationAdapter,
  CryptoReconciliationAdapter,
} from '@/lib/commercial-reconciliation';

const BASE_CONTEXT = {
  paymentLinkId: 'inv-001',
  organizationId: 'org-001',
  agreementId: 'agreement-001',
};

function confirmedEvent(
  overrides: Partial<{
    id: string;
    amount: number;
    payment_method: string;
    stripe_payment_intent_id: string | null;
    wise_transfer_id: string | null;
    hedera_transaction_id: string | null;
  }> = {}
) {
  return {
    id: overrides.id ?? 'evt-1',
    payment_link_id: BASE_CONTEXT.paymentLinkId,
    event_type: 'PAYMENT_CONFIRMED',
    payment_method: overrides.payment_method ?? 'STRIPE',
    amount_received: overrides.amount ?? 1000,
    currency_received: 'AUD',
    stripe_payment_intent_id:
      overrides.stripe_payment_intent_id !== undefined
        ? overrides.stripe_payment_intent_id
        : 'pi_123',
    wise_transfer_id:
      overrides.wise_transfer_id !== undefined ? overrides.wise_transfer_id : null,
    hedera_transaction_id: overrides.hedera_transaction_id ?? null,
    source_reference: null,
    correlation_id: null,
    received_at: '2026-03-01T10:00:00.000Z',
    created_at: '2026-03-01T10:00:00.000Z',
    metadata: {},
    pilot_deal_id: BASE_CONTEXT.agreementId,
  };
}

describe('clearing account mapping', () => {
  it('maps Stripe to Stripe Clearing config', () => {
    const account = deriveClearingAccount('stripe');
    expect(account.configKey).toBe('stripe_clearing');
    expect(account.defaultAccountName).toBe('Stripe Clearing');
    expect(account.mappingField).toBe('xero_stripe_clearing_account_id');
  });

  it('maps Wise to Wise Clearing config', () => {
    const account = deriveClearingAccount('wise');
    expect(account.configKey).toBe('wise_clearing');
    expect(account.defaultAccountName).toBe('Wise Clearing');
  });

  it('maps manual bank to Bank Clearing config', () => {
    const account = deriveClearingAccount('manual_bank');
    expect(account.configKey).toBe('bank_clearing');
    expect(account.defaultAccountName).toBe('Bank Clearing');
  });

  it('maps crypto rails to Crypto Clearing config', () => {
    expect(deriveClearingAccount('hedera').label).toBe('HBAR');
    expect(deriveClearingAccount('evm_wallet').configKey).toBe('crypto_clearing');
    expect(deriveClearingAccount('crypto').defaultAccountName).toBe('Crypto Clearing');
  });

  it('applies merchant-configured account code overrides', () => {
    const account = deriveClearingAccount('stripe', {
      xero_stripe_clearing_account_id: '1050',
    });
    expect(account.configuredAccountCode).toBe('1050');
  });
});

describe('rail adapters', () => {
  it('StripeReconciliationAdapter normalizes Stripe events', () => {
    const raw = confirmedEvent({ payment_method: 'STRIPE' });
    expect(StripeReconciliationAdapter.supports(raw)).toBe(true);
    const normalized = StripeReconciliationAdapter.normalize(raw, BASE_CONTEXT);
    expect(normalized?.paymentRail).toBe('stripe');
    expect(normalized?.amount).toBe(1000);
    expect(normalized?.agreementId).toBe('agreement-001');
  });

  it('WiseReconciliationAdapter normalizes Wise events', () => {
    const raw = confirmedEvent({
      payment_method: 'WISE',
      wise_transfer_id: 'wise-tx-1',
      stripe_payment_intent_id: null,
    });
    expect(WiseReconciliationAdapter.supports(raw)).toBe(true);
    const normalized = WiseReconciliationAdapter.normalize(raw, BASE_CONTEXT);
    expect(normalized?.paymentRail).toBe('wise');
  });

  it('ManualBankReconciliationAdapter normalizes manual bank events', () => {
    const raw = confirmedEvent({
      payment_method: 'MANUAL_BANK',
      stripe_payment_intent_id: null,
    });
    expect(ManualBankReconciliationAdapter.supports(raw)).toBe(true);
    const normalized = ManualBankReconciliationAdapter.normalize(raw, BASE_CONTEXT);
    expect(normalized?.paymentRail).toBe('manual_bank');
  });

  it('CryptoReconciliationAdapter normalizes Hedera and EVM events', () => {
    const hedera = confirmedEvent({
      payment_method: 'HEDERA',
      hedera_transaction_id: '0.0.123@123',
      stripe_payment_intent_id: null,
    });
    expect(CryptoReconciliationAdapter.normalize(hedera, BASE_CONTEXT)?.paymentRail).toBe(
      'hedera'
    );

    const evm = confirmedEvent({
      payment_method: 'EVM_WALLET',
      stripe_payment_intent_id: null,
    });
    expect(CryptoReconciliationAdapter.normalize(evm, BASE_CONTEXT)?.paymentRail).toBe(
      'evm_wallet'
    );
  });
});

describe('payment allocation', () => {
  it('allocates full payment', () => {
    const events = normalizeCommercialPaymentEvents(
      [confirmedEvent({ amount: 1000 })],
      BASE_CONTEXT
    );
    const allocation = derivePaymentAllocation(1000, events);
    expect(allocation.isFullyAllocated).toBe(true);
    expect(allocation.remainingAmount).toBe(0);
  });

  it('supports partial payment allocation', () => {
    const events = normalizeCommercialPaymentEvents(
      [confirmedEvent({ id: 'evt-1', amount: 400 })],
      BASE_CONTEXT
    );
    const allocation = derivePaymentAllocation(1000, events);
    expect(allocation.isPartiallyAllocated).toBe(true);
    expect(allocation.remainingAmount).toBe(600);
  });

  it('supports multiple payment allocation', () => {
    const events = normalizeCommercialPaymentEvents(
      [
        confirmedEvent({ id: 'evt-1', amount: 400 }),
        confirmedEvent({ id: 'evt-2', amount: 600 }),
      ],
      BASE_CONTEXT
    );
    const allocation = derivePaymentAllocation(1000, events);
    expect(allocation.isFullyAllocated).toBe(true);
    expect(allocation.allocations).toHaveLength(2);
  });

  it('detects overpayment', () => {
    const events = normalizeCommercialPaymentEvents(
      [confirmedEvent({ amount: 1200 })],
      BASE_CONTEXT
    );
    const allocation = derivePaymentAllocation(1000, events);
    expect(allocation.isOverpaid).toBe(true);
  });
});

describe('deriveCommercialReconciliation', () => {
  it('automatically matches invoice to payment by commercial identity', () => {
    const reconciliation = deriveCommercialReconciliation({
      paymentLinkId: BASE_CONTEXT.paymentLinkId,
      invoiceAmount: 1000,
      currency: 'AUD',
      organizationId: BASE_CONTEXT.organizationId,
      agreementId: BASE_CONTEXT.agreementId,
      linkStatus: 'PAID',
      paymentEvents: [],
      rawPaymentEvents: [confirmedEvent()],
    });

    expect(reconciliation.reconciliationStatus).toBe(
      CommercialReconciliationStatus.Matched
    );
    expect(reconciliation.paymentLinkId).toBe(BASE_CONTEXT.paymentLinkId);
    expect(reconciliation.invoiceId).toBe(BASE_CONTEXT.paymentLinkId);
    expect(reconciliation.agreementId).toBe(BASE_CONTEXT.agreementId);
    expect(reconciliation.matchedAmount).toBe(1000);
    expect(reconciliation.clearingAccount?.configKey).toBe('stripe_clearing');
  });

  it('preserves invoice identity — same paymentLinkId throughout', () => {
    const reconciliation = deriveCommercialReconciliation({
      paymentLinkId: 'same-invoice-id',
      invoiceAmount: 500,
      currency: 'AUD',
      organizationId: 'org-1',
      linkStatus: 'PAID',
      paymentEvents: [],
      rawPaymentEvents: [
        confirmedEvent({ id: 'e1', amount: 500, payment_method: 'WISE', wise_transfer_id: 'w1', stripe_payment_intent_id: null }),
      ],
    });
    expect(reconciliation.invoiceId).toBe('same-invoice-id');
    expect(reconciliation.paymentLinkId).toBe('same-invoice-id');
    expect(reconciliation.paymentRail).toBe('wise');
  });

  it('settlement becomes eligible after commercial match', () => {
    const reconciliation = deriveCommercialReconciliation({
      paymentLinkId: BASE_CONTEXT.paymentLinkId,
      invoiceAmount: 1000,
      currency: 'AUD',
      organizationId: BASE_CONTEXT.organizationId,
      linkStatus: 'PAID',
      paymentEvents: [],
      rawPaymentEvents: [confirmedEvent()],
    });
    expect(reconciliation.settlementEligible).toBe(true);
    expect(isSettlementEligibleAfterReconciliation(reconciliation.reconciliationStatus)).toBe(
      true
    );
  });

  it('remains pending when no payment events', () => {
    const reconciliation = deriveCommercialReconciliation({
      paymentLinkId: BASE_CONTEXT.paymentLinkId,
      invoiceAmount: 1000,
      currency: 'AUD',
      organizationId: BASE_CONTEXT.organizationId,
      linkStatus: 'OPEN',
      paymentEvents: [],
      rawPaymentEvents: [],
    });
    expect(reconciliation.reconciliationStatus).toBe(
      CommercialReconciliationStatus.Pending
    );
    expect(reconciliation.settlementEligible).toBe(false);
  });

  it('marks RequiresReview for PAID_UNVERIFIED links', () => {
    const status = deriveReconciliationStatus({
      linkStatus: 'PAID_UNVERIFIED',
      allocation: derivePaymentAllocation(1000, []),
      bankSettlement: null,
      hasPaymentEvents: true,
    });
    expect(status).toBe(CommercialReconciliationStatus.RequiresReview);
  });

  it('clears when bank settlement completes', () => {
    const reconciliation = deriveCommercialReconciliation({
      paymentLinkId: BASE_CONTEXT.paymentLinkId,
      invoiceAmount: 1000,
      currency: 'AUD',
      organizationId: BASE_CONTEXT.organizationId,
      linkStatus: 'PAID',
      paymentEvents: [],
      rawPaymentEvents: [confirmedEvent()],
      bankSettlements: [
        {
          status: 'SETTLED',
          settledAt: '2026-03-02T00:00:00.000Z',
          reference: 'settle-ref',
          provider: 'STRIPE',
        },
      ],
    });
    expect(reconciliation.reconciliationStatus).toBe(
      CommercialReconciliationStatus.Cleared
    );
    expect(reconciliation.bankSettlement?.status).toBe('cleared');
  });
});

describe('backwards compatibility', () => {
  it('open invoice without payments stays Pending', () => {
    const reconciliation = deriveCommercialReconciliation({
      paymentLinkId: 'legacy-inv',
      invoiceAmount: 100,
      currency: 'AUD',
      organizationId: 'org',
      linkStatus: 'OPEN',
      paymentEvents: [],
    });
    expect(reconciliation.reconciliationStatus).toBe(
      CommercialReconciliationStatus.Pending
    );
  });
});
