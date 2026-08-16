import fs from 'node:fs';
import path from 'node:path';
import {
  buildTreasuryAccountingView,
  listTreasuryAccountingSummaries,
} from '@/lib/treasury/accounting/build-treasury-accounting-view';
import {
  accountingStatusForTreasuryEvent,
  xeroSyncToAccountingStatus,
} from '@/lib/treasury/accounting/accounting-status';
import { computeTreasuryAccountingMetrics } from '@/lib/treasury/accounting/metrics';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    payment_links: { findFirst: jest.fn(), findMany: jest.fn() },
    merchant_settings: { findFirst: jest.fn() },
    xero_syncs: { findFirst: jest.fn() },
    payment_events: { findFirst: jest.fn() },
    treasury_events: { findMany: jest.fn(), findFirst: jest.fn() },
    treasury_event_links: { findMany: jest.fn() },
    treasury_manual_reconciliations: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/treasury/integration/connection-service', () => ({
  getDigitalSurgeSyncMetadata: jest.fn().mockResolvedValue({
    deposit_addresses: { USDC: ['0xdigitalsurge deposit000000000000000000001'] },
  }),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');

const ORG = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const LINK = 'link-11111111-1111-1111-1111-111111111111';
const DS_ADDR = '0xdigitalsurge deposit000000000000000000001';

function evt(overrides: Record<string, unknown> & { id: string; event_type: string }) {
  return {
    organization_id: ORG,
    status: 'CONFIRMED',
    transaction_hash: null,
    provider_reference: `ref:${overrides.id}`,
    payment_link_id: LINK,
    source_address: null,
    destination_address: null,
    amount: { toString: () => '1500' },
    destination_amount: null,
    destination_asset: null,
    exchange_rate: null,
    fee_amount: null,
    fee_currency: null,
    asset: 'USDC',
    provider: 'blockchain',
    occurred_at: new Date('2026-08-01T10:00:00Z'),
    metadata: {},
    ...overrides,
  };
}

function linkRow(sourceId: string, targetId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `link-${sourceId}-${targetId}`,
    organization_id: ORG,
    source_event_id: sourceId,
    target_event_id: targetId,
    link_type: 'CORRELATION',
    link_status: 'CONFIRMED',
    evidence: { strategy: 'transaction_hash' },
    ...overrides,
  };
}

function mockPaidLink(overrides: Record<string, unknown> = {}) {
  return {
    id: LINK,
    invoice_reference: 'INV-1500',
    short_code: 'Ab12Cd34',
    status: 'PAID',
    amount: { toString: () => '1500' },
    currency: 'AUD',
    accounting_amount: { toString: () => '1500' },
    accounting_currency: 'AUD',
    payment_method: 'CRYPTO',
    token_type: 'USDC',
    ...overrides,
  };
}

function mockSettings(overrides: Record<string, unknown> = {}) {
  return {
    xero_revenue_account_id: '200',
    xero_stripe_clearing_account_id: '1051',
    xero_wise_clearing_account_id: '1052',
    xero_hbar_clearing_account_id: '1053',
    xero_usdc_clearing_account_id: '1054-USDC',
    xero_usdt_clearing_account_id: '1055-USDT',
    xero_audd_clearing_account_id: '1056-AUDD',
    crypto_settlement_strategy: 'per_asset',
    ...overrides,
  };
}

function mockXeroSyncs() {
  let call = 0;
  prisma.xero_syncs.findFirst.mockImplementation(async (args: { where: { sync_type: string } }) => {
    call += 1;
    if (args.where.sync_type === 'INVOICE') {
      return { status: 'SUCCESS', xero_invoice_id: 'xero-inv-1500', error_message: null };
    }
    if (args.where.sync_type === 'PAYMENT') {
      return { status: 'SUCCESS', xero_payment_id: 'xero-pay-usdc', error_message: null };
    }
    return null;
  });
}

function mockWorkedExampleChain(includeBank = false) {
  const events = [
    evt({ id: 'cp', event_type: 'CUSTOMER_PAYMENT', provider: 'provvy' }),
    evt({
      id: 'ar',
      event_type: 'ASSET_RECEIVED',
      destination_address: '0xMerchant',
      transaction_hash: '0xin',
    }),
    evt({
      id: 'wt',
      event_type: 'WALLET_TRANSFER',
      source_address: '0xMerchant',
      destination_address: DS_ADDR,
      transaction_hash: '0xout',
      amount: { toString: () => '-1498' },
      fee_amount: { toString: () => '2' },
    }),
    evt({
      id: 'ed',
      event_type: 'EXCHANGE_DEPOSIT',
      provider: 'digital_surge',
      transaction_hash: '0xout',
      provider_reference: 'ds:501:601',
    }),
    evt({
      id: 'cv',
      event_type: 'CONVERSION',
      provider: 'digital_surge',
      destination_asset: 'AUD',
      destination_amount: { toString: () => '1485' },
      exchange_rate: { toString: () => '0.99' },
      metadata: { digital_surge: { object_id: 701 } },
    }),
    evt({
      id: 'fee',
      event_type: 'UNKNOWN',
      asset: 'AUD',
      amount: { toString: () => '15' },
      provider: 'digital_surge',
      metadata: { display_as: 'fee' },
      fee_currency: 'AUD',
      fee_amount: { toString: () => '15' },
    }),
    evt({
      id: 'ab',
      event_type: 'FIAT_CREDIT',
      asset: 'AUD',
      amount: { toString: () => '1485' },
      provider: 'digital_surge',
      metadata: { display_as: 'aud_balance_credit' },
    }),
    evt({
      id: 'aw',
      event_type: 'FIAT_CREDIT',
      asset: 'AUD',
      amount: { toString: () => '-1485' },
      metadata: { display_as: 'aud_withdrawal' },
      provider: 'digital_surge',
    }),
  ];

  if (includeBank) {
    events.push(
      evt({
        id: 'bs',
        event_type: 'BANK_SETTLEMENT',
        asset: 'AUD',
        provider: 'bank_feed',
        status: 'CONFIRMED',
      })
    );
  }

  prisma.treasury_events.findMany.mockResolvedValue(events);
  prisma.treasury_event_links.findMany.mockResolvedValue([
    linkRow('cp', 'ar', { link_type: 'PARENT_CHILD', evidence: { strategy: 'payment_link' } }),
    linkRow('ar', 'wt', { link_type: 'PARENT_CHILD', evidence: { strategy: 'wallet_continuity' } }),
    linkRow('wt', 'ed', { evidence: { strategy: 'transaction_hash' } }),
    linkRow('ed', 'cv', { link_type: 'PARENT_CHILD', evidence: { strategy: 'provider_object_id' } }),
  ]);
}

describe('Phase G1 — Treasury Accounting Intelligence / Read Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payment_links.findFirst.mockResolvedValue(mockPaidLink());
    prisma.payment_links.findMany.mockResolvedValue([]);
    prisma.merchant_settings.findFirst.mockResolvedValue(mockSettings());
    mockXeroSyncs();
    prisma.payment_events.findFirst.mockResolvedValue({
      id: 'pe-1',
      received_at: new Date('2026-08-01T09:55:00Z'),
      amount_received: { toString: () => '1500' },
      currency_received: 'USDC',
      hedera_transaction_id: '0xpayhash',
      metadata: {},
    });
    prisma.treasury_manual_reconciliations.findMany.mockResolvedValue([]);
    prisma.treasury_events.findFirst.mockResolvedValue(null);
  });

  describe('worked example — AUD 1500 USDC chain awaiting bank', () => {
    beforeEach(() => {
      mockWorkedExampleChain(false);
    });

    it('shows revenue separate from conversion and correct aggregate status', async () => {
      const view = await buildTreasuryAccountingView(ORG, LINK);
      expect(view).not.toBeNull();

      expect(view!.revenue.invoiceAmount).toBe('1500');
      expect(view!.revenue.invoiceCurrency).toBe('AUD');
      expect(view!.revenue.accountingStatus).toBe('posted_to_xero');
      expect(view!.revenue.xeroInvoiceId).toBe('xero-inv-1500');

      const conversion = view!.lifecycleStages.find((s) => s.stage === 'conversion');
      expect(conversion).toBeDefined();
      expect(conversion!.destinationAmount).toBe('1485');
      expect(conversion!.accountingStatus).toBe('observed');
      expect(view!.revenue.invoiceAmount).not.toBe(conversion!.destinationAmount);

      expect(view!.chainStatus).toBe('AWAITING_BANK_CONFIRMATION');
      expect(view!.metricsHint.awaitingBankConfirmation).toBe(true);
    });

    it('shows Xero customer payment posted to USDC holding', async () => {
      const view = await buildTreasuryAccountingView(ORG, LINK);
      expect(view!.customerPayment.asset).toBe('USDC');
      expect(view!.customerPayment.accountingStatus).toBe('posted_to_xero');
      expect(view!.customerPayment.xeroPaymentId).toBe('xero-pay-usdc');
      expect(view!.customerPayment.holdingAccountCode).toBe('1054-USDC');
      expect(view!.customerPayment.treasuryStatus).toBe('CONFIRMED');
    });

    it('shows wallet transfer and exchange deposit as confirmed observed events', async () => {
      const view = await buildTreasuryAccountingView(ORG, LINK);
      const wallet = view!.lifecycleStages.find((s) => s.stage === 'wallet_transfer');
      const deposit = view!.lifecycleStages.find((s) => s.stage === 'exchange_deposit');
      expect(wallet?.treasuryStatus).toBe('CONFIRMED');
      expect(wallet?.accountingStatus).toBe('observed');
      expect(deposit?.treasuryStatus).toBe('CONFIRMED');
      expect(deposit?.provider).toBe('digital_surge');
    });

    it('shows conversion fee separately with requires review', async () => {
      const view = await buildTreasuryAccountingView(ORG, LINK);
      const fee = view!.lifecycleStages.find((s) => s.stage === 'exchange_fee');
      expect(fee).toBeDefined();
      expect(fee!.amount).toBe('15');
      expect(fee!.asset).toBe('AUD');
      expect(fee!.accountingStatus).toBe('requires_review');
    });

    it('does not treat AUD withdrawal as bank settlement', async () => {
      const view = await buildTreasuryAccountingView(ORG, LINK);
      const withdrawal = view!.lifecycleStages.find((s) => s.stage === 'fiat_withdrawal');
      const bank = view!.lifecycleStages.find((s) => s.stage === 'bank_settlement');
      const awaitingBank = view!.lifecycleStages.find(
        (s) => s.stage === 'awaiting_bank_confirmation'
      );

      expect(withdrawal).toBeDefined();
      expect(withdrawal!.accountingStatus).toBe('awaiting_bank_confirmation');
      expect(bank).toBeUndefined();
      expect(awaitingBank).toBeDefined();
      expect(awaitingBank!.accountingStatus).toBe('awaiting_bank_confirmation');
    });

    it('includes accountant explanations without tax advice', async () => {
      const view = await buildTreasuryAccountingView(ORG, LINK);
      expect(view!.explanations.some((e) => e.includes('Revenue is recognised'))).toBe(true);
      expect(view!.explanations.some((e) => e.includes('does not create additional revenue'))).toBe(
        true
      );
      expect(view!.explanations.some((e) => e.includes('does not prove bank receipt'))).toBe(true);
      expect(view!.explanations.some((e) => e.includes('does not apply these automatically'))).toBe(
        true
      );
    });
  });

  describe('uncertainty preserved', () => {
    it('never upgrades INFERRED or UNKNOWN treasury status in lifecycle', async () => {
      prisma.treasury_events.findMany.mockResolvedValue([
        evt({ id: 'ar', event_type: 'ASSET_RECEIVED', status: 'INFERRED' }),
        evt({
          id: 'wt',
          event_type: 'WALLET_TRANSFER',
          status: 'UNKNOWN',
          destination_address: DS_ADDR,
        }),
      ]);
      prisma.treasury_event_links.findMany.mockResolvedValue([]);

      const view = await buildTreasuryAccountingView(ORG, LINK);
      const inferred = view!.lifecycleStages.find((s) => s.eventId === 'ar');
      const unknown = view!.lifecycleStages.find((s) => s.eventId === 'wt');

      expect(inferred?.treasuryStatus).toBe('INFERRED');
      expect(inferred?.accountingStatus).toBe('requires_review');
      expect(unknown?.treasuryStatus).toBe('UNKNOWN');
      expect(unknown?.accountingStatus).toBe('requires_review');
    });

    it('accounting status helper does not map INFERRED to observed', () => {
      expect(accountingStatusForTreasuryEvent('INFERRED')).toBe('requires_review');
      expect(accountingStatusForTreasuryEvent('UNKNOWN')).toBe('requires_review');
      expect(accountingStatusForTreasuryEvent('CONFIRMED')).toBe('observed');
    });
  });

  describe('missing treasury events', () => {
    it('injects awaiting stages when chain is incomplete', async () => {
      prisma.treasury_events.findMany.mockResolvedValue([
        evt({ id: 'ar', event_type: 'ASSET_RECEIVED', destination_address: '0xMerchant' }),
      ]);
      prisma.treasury_event_links.findMany.mockResolvedValue([]);

      const view = await buildTreasuryAccountingView(ORG, LINK);
      expect(view!.lifecycleStages.some((s) => s.stage === 'awaiting_wallet')).toBe(true);
      expect(view!.chainStatus).toBe('AWAITING_WALLET_ACTIVITY');
    });
  });

  describe('cross-organization isolation', () => {
    it('returns null when payment link belongs to another organization', async () => {
      prisma.payment_links.findFirst.mockResolvedValue(null);
      const view = await buildTreasuryAccountingView(ORG_B, LINK);
      expect(view).toBeNull();
    });
  });

  describe('multi-rail invoice behaviour', () => {
    it('resolves Wise holding account for WISE payments without treasury crypto chain', async () => {
      prisma.payment_links.findFirst.mockResolvedValue(
        mockPaidLink({ payment_method: 'WISE', token_type: null, currency: 'AUD' })
      );
      prisma.treasury_events.findMany.mockResolvedValue([]);
      prisma.treasury_event_links.findMany.mockResolvedValue([]);
      prisma.payment_events.findFirst.mockResolvedValue({
        id: 'pe-wise',
        received_at: new Date(),
        amount_received: { toString: () => '1500' },
        currency_received: 'AUD',
        hedera_transaction_id: null,
        metadata: {},
      });

      const view = await buildTreasuryAccountingView(ORG, LINK);
      expect(view!.customerPayment.paymentRail).toBe('WISE');
      expect(view!.customerPayment.holdingAccountCode).toBe('1052');
      expect(view!.lifecycleStages).toHaveLength(0);
    });
  });

  describe('manual reconciliation distinguishable', () => {
    it('surfaces manual link audit on lifecycle stage', async () => {
      mockWorkedExampleChain(false);
      prisma.treasury_manual_reconciliations.findMany.mockResolvedValue([
        {
          source_event_id: 'manual-src',
          target_event_id: 'ed',
          linked_at: new Date('2026-08-02T12:00:00Z'),
          linked_by_user_id: 'user-1',
          notes: 'Matched deposit manually',
        },
      ]);

      const view = await buildTreasuryAccountingView(ORG, LINK);
      const deposit = view!.lifecycleStages.find((s) => s.eventId === 'ed');
      expect(deposit?.manualReconciliation).toEqual({
        linkedAt: '2026-08-02T12:00:00.000Z',
        linkedByUserId: 'user-1',
        notes: 'Matched deposit manually',
      });
      expect(deposit?.evidence?.manual).toBeFalsy();
    });
  });

  describe('list summaries and metrics', () => {
    it('lists paid invoice summaries with xero payment flag', async () => {
      prisma.payment_links.findMany.mockResolvedValue([
        {
          id: LINK,
          invoice_reference: 'INV-1500',
          short_code: 'Ab12Cd34',
          amount: { toString: () => '1500' },
          currency: 'AUD',
          token_type: 'USDC',
        },
      ]);
      mockWorkedExampleChain(false);

      const summaries = await listTreasuryAccountingSummaries(ORG);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].xeroPaymentPosted).toBe(true);
      expect(summaries[0].chainStatus).toBe('AWAITING_BANK_CONFIRMATION');
    });

    it('computes observational metrics without labelling as accounting balances', async () => {
      mockWorkedExampleChain(false);
      prisma.payment_links.findMany.mockResolvedValue([
        { id: LINK, invoice_reference: 'INV-1500', short_code: 'x' },
      ]);

      const metrics = await computeTreasuryAccountingMetrics(ORG);
      expect(metrics.audAtExchange).toBe(1485);
      expect(metrics.audAwaitingBankConfirmation).toBe(1485);
      expect(metrics.exchangeFeesTotal).toBe(15);
    });
  });

  describe('Xero read-only contract', () => {
    it('does not import or invoke Xero payment posting from accounting read model', () => {
      const builderPath = path.join(
        process.cwd(),
        'lib/treasury/accounting/build-treasury-accounting-view.ts'
      );
      const source = fs.readFileSync(builderPath, 'utf-8');
      expect(source).not.toMatch(/syncPaymentToXero|ManualJournal|createJournal/);
      expect(source).toContain("sync_type: 'INVOICE'");
      expect(source).toContain("sync_type: 'PAYMENT'");
    });

    it('maps xero sync SUCCESS to posted_to_xero display only', () => {
      expect(xeroSyncToAccountingStatus('SUCCESS')).toBe('posted_to_xero');
      expect(xeroSyncToAccountingStatus('PENDING')).toBe('requires_review');
      expect(xeroSyncToAccountingStatus(null)).toBe('not_applicable');
    });
  });

  describe('full chain RECONCILED', () => {
    it('shows bank settlement as observed not posted when bank confirmed', async () => {
      mockWorkedExampleChain(true);
      const view = await buildTreasuryAccountingView(ORG, LINK);
      expect(view!.chainStatus).toBe('RECONCILED');
      const bank = view!.lifecycleStages.find((s) => s.stage === 'bank_settlement');
      expect(bank?.treasuryStatus).toBe('CONFIRMED');
      expect(bank?.accountingStatus).toBe('observed');
    });
  });
});
