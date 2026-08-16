import { buildInvoiceTreasuryReconciliation } from '@/lib/treasury/reconciliation/chain';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    payment_links: { findFirst: jest.fn() },
    treasury_events: { findMany: jest.fn(), findFirst: jest.fn() },
    treasury_event_links: { findMany: jest.fn() },
    payment_events: { findFirst: jest.fn() },
    xero_syncs: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/treasury/integration/connection-service', () => ({
  getDigitalSurgeSyncMetadata: jest.fn().mockResolvedValue(null),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');

describe('invoice treasury reconciliation chain (Phase C)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payment_links.findFirst.mockResolvedValue({
      id: 'link-1',
      invoice_reference: 'INV-00485',
      short_code: 'Ab12Cd34',
      status: 'PAID',
    });
    prisma.payment_events.findFirst.mockResolvedValue({ id: 'pe-1' });
    prisma.xero_syncs.findFirst.mockResolvedValue({ id: 'xs-1' });
    prisma.treasury_event_links.findMany.mockResolvedValue([]);
    prisma.treasury_events.findFirst.mockResolvedValue(null);
  });

  it('shows customer payment and asset received with awaiting treasury', async () => {
    prisma.treasury_events.findMany.mockResolvedValue([
      {
        id: 'e1',
        event_type: 'CUSTOMER_PAYMENT',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '1500' },
        provider: 'provvy',
        occurred_at: new Date(),
        destination_address: null,
      },
      {
        id: 'e2',
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '1500' },
        provider: 'blockchain',
        occurred_at: new Date(),
        destination_address: '0xABC',
      },
    ]);

    const result = await buildInvoiceTreasuryReconciliation('org-1', 'link-1');
    expect(result?.steps.find((s) => s.stage === 'payment')?.status).toBe('CONFIRMED');
    expect(result?.steps.find((s) => s.stage === 'crypto_received')?.status).toBe('CONFIRMED');
    expect(result?.steps.find((s) => s.stage === 'awaiting_treasury')?.status).toBe('UNKNOWN');
    expect(result?.steps.find((s) => s.stage === 'wallet')?.detail).toBe('0xABC');
    expect(result?.walletAddress).toBe('0xABC');
  });

  it('does not mark awaiting treasury as RECONCILED', async () => {
    prisma.treasury_events.findMany.mockResolvedValue([
      {
        id: 'e1',
        event_type: 'CUSTOMER_PAYMENT',
        status: 'CONFIRMED',
        asset: 'AUD',
        amount: { toString: () => '100' },
        provider: 'provvy',
        occurred_at: new Date(),
        destination_address: null,
      },
      {
        id: 'e2',
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        asset: 'AUD',
        amount: { toString: () => '100' },
        provider: 'stripe',
        occurred_at: new Date(),
        destination_address: null,
      },
    ]);

    const result = await buildInvoiceTreasuryReconciliation('org-1', 'link-1');
    const awaiting = result?.steps.find((s) => s.stage === 'awaiting_treasury');
    expect(awaiting?.status).toBe('UNKNOWN');
    expect(awaiting?.label).toBe('Awaiting treasury activity');
  });
});

describe('invoice treasury reconciliation chain (Phase E exchange steps)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payment_links.findFirst.mockResolvedValue({
      id: 'link-1',
      invoice_reference: 'INV-00485',
      short_code: 'Ab12Cd34',
      status: 'PAID',
    });
    prisma.payment_events.findFirst.mockResolvedValue({ id: 'pe-1' });
    prisma.xero_syncs.findFirst.mockResolvedValue({ id: 'xs-1' });
    prisma.treasury_event_links.findMany.mockResolvedValue([]);
    prisma.treasury_events.findFirst.mockResolvedValue(null);
  });

  it('shows Digital Surge deposit, conversion, and AUD balance steps', async () => {
    prisma.treasury_events.findMany.mockResolvedValue([
      {
        id: 'e2',
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '1500' },
        provider: 'blockchain',
        occurred_at: new Date('2026-08-01T10:05:00Z'),
        destination_address: '0xMerchant',
      },
      {
        id: 'e3',
        event_type: 'WALLET_TRANSFER',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '-1500' },
        provider: 'blockchain',
        occurred_at: new Date('2026-08-02T10:00:00Z'),
        destination_address: '0xDS',
        source_address: '0xMerchant',
      },
      {
        id: 'e4',
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '1500' },
        provider: 'digital_surge',
        occurred_at: new Date('2026-08-03T10:00:00Z'),
        destination_address: null,
      },
      {
        id: 'e5',
        event_type: 'CONVERSION',
        status: 'CONFIRMED',
        asset: 'USDC',
        destination_asset: 'AUD',
        amount: { toString: () => '1500' },
        destination_amount: { toString: () => '2245' },
        exchange_rate: { toString: () => '1.496666' },
        provider: 'digital_surge',
        occurred_at: new Date('2026-08-03T10:05:00Z'),
        destination_address: null,
        metadata: {},
      },
      {
        id: 'e6',
        event_type: 'FIAT_CREDIT',
        status: 'CONFIRMED',
        asset: 'AUD',
        amount: { toString: () => '2245' },
        provider: 'digital_surge',
        occurred_at: new Date('2026-08-03T10:05:00Z'),
        destination_address: null,
        metadata: { display_as: 'aud_balance_credit' },
      },
    ]);
    prisma.treasury_event_links.findMany.mockResolvedValue([
      {
        target_event: {
          id: 'e3',
          status: 'CONFIRMED',
          asset: 'USDC',
          amount: { toString: () => '-1500' },
          destination_address: '0xDS',
          occurred_at: new Date('2026-08-02T10:00:00Z'),
        },
      },
    ]);

    const result = await buildInvoiceTreasuryReconciliation('org-1', 'link-1');
    expect(result?.steps.find((s) => s.stage === 'exchange_deposit')?.label).toContain(
      'Digital Surge'
    );
    expect(result?.steps.find((s) => s.stage === 'conversion')?.label).toBe('USDC → AUD');
    expect(result?.steps.find((s) => s.stage === 'aud_balance')?.label).toContain('AUD');
  });

  it('shows AUD withdrawal and awaiting bank confirmation without bank settled', async () => {
    prisma.treasury_events.findMany.mockResolvedValue([
      {
        id: 'e4',
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '1500' },
        provider: 'digital_surge',
        occurred_at: new Date('2026-08-03T10:00:00Z'),
        destination_address: null,
      },
      {
        id: 'e5',
        event_type: 'CONVERSION',
        status: 'CONFIRMED',
        asset: 'USDC',
        destination_asset: 'AUD',
        amount: { toString: () => '1500' },
        provider: 'digital_surge',
        occurred_at: new Date('2026-08-03T10:05:00Z'),
        destination_address: null,
        metadata: {},
      },
      {
        id: 'e6',
        event_type: 'FIAT_CREDIT',
        status: 'CONFIRMED',
        asset: 'AUD',
        amount: { toString: () => '2245' },
        provider: 'digital_surge',
        occurred_at: new Date('2026-08-03T10:05:00Z'),
        destination_address: null,
        metadata: { display_as: 'aud_balance_credit' },
      },
      {
        id: 'e7',
        event_type: 'FIAT_CREDIT',
        status: 'CONFIRMED',
        asset: 'AUD',
        amount: { toString: () => '-2240' },
        provider: 'digital_surge',
        occurred_at: new Date('2026-08-04T09:00:00Z'),
        destination_address: null,
        metadata: {
          display_as: 'aud_withdrawal',
          digital_surge: { provider_withdrawal_status: 'completed' },
        },
      },
    ]);

    const result = await buildInvoiceTreasuryReconciliation('org-1', 'link-1');
    expect(result?.steps.find((s) => s.stage === 'aud_withdrawal')?.label).toBe('AUD withdrawal');
    expect(result?.steps.find((s) => s.stage === 'awaiting_bank_confirmation')?.label).toBe(
      'Awaiting bank confirmation'
    );
    expect(result?.steps.find((s) => s.stage === 'bank_settlement')).toBeUndefined();
  });

  it('shows bank settlement only when BANK_SETTLEMENT is CONFIRMED', async () => {
    prisma.treasury_events.findMany.mockResolvedValue([
      {
        id: 'e7',
        event_type: 'FIAT_CREDIT',
        status: 'CONFIRMED',
        asset: 'AUD',
        amount: { toString: () => '-2240' },
        provider: 'digital_surge',
        occurred_at: new Date('2026-08-04T09:00:00Z'),
        destination_address: null,
        metadata: { display_as: 'aud_withdrawal' },
      },
      {
        id: 'e8',
        event_type: 'BANK_SETTLEMENT',
        status: 'CONFIRMED',
        asset: 'AUD',
        amount: { toString: () => '2240' },
        provider: 'bank_feed',
        occurred_at: new Date('2026-08-05T09:00:00Z'),
        destination_address: null,
        metadata: { bank_receipt_confirmed: true },
      },
    ]);

    const result = await buildInvoiceTreasuryReconciliation('org-1', 'link-1');
    expect(result?.steps.find((s) => s.stage === 'bank_settlement')?.status).toBe('CONFIRMED');
    expect(result?.steps.find((s) => s.stage === 'awaiting_bank_confirmation')).toBeUndefined();
  });
});
