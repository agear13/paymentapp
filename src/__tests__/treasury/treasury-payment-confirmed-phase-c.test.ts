import { createTreasuryEventsFromPaymentConfirmed } from '@/lib/treasury/events/from-payment-confirmed';
import { ingestTreasuryEvent } from '@/lib/treasury/events/ingest-treasury-event';
import { ingestTreasuryEventLink } from '@/lib/treasury/events/treasury-event-links';
import { hookTreasuryFromPaymentConfirmation } from '@/lib/treasury/events/hook-after-payment-confirmed';
import {
  resolveConfirmedPaymentAsset,
  resolveReceiveWalletContext,
} from '@/lib/treasury/events/resolve-confirmed-asset';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    treasury_events: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    treasury_event_links: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    merchant_settings: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    payment: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');
const { loggers } = jest.requireMock('@/lib/logger');

const ORG = 'org-11111111-1111-1111-1111-111111111111';
const LINK = 'link-22222222-2222-2222-2222-222222222222';
const PE = 'pe-33333333-3333-3333-3333-333333333333';

let eventCounter = 0;
let linkCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `evt-${eventCounter}`;
}

function nextLinkId(): string {
  linkCounter += 1;
  return `link-${linkCounter}`;
}

describe('Phase C — treasury from PAYMENT_CONFIRMED', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    eventCounter = 0;
    linkCounter = 0;

    prisma.treasury_events.findUnique.mockResolvedValue(null);
    prisma.treasury_event_links.findUnique.mockResolvedValue(null);
    prisma.treasury_events.create.mockImplementation(() =>
      Promise.resolve({ id: nextEventId() })
    );
    prisma.treasury_event_links.create.mockImplementation(() =>
      Promise.resolve({ id: nextLinkId() })
    );
    prisma.merchant_settings.findFirst.mockResolvedValue({
      evm_wallet_address: '0xMerchantWallet',
      hedera_account_id: '0.0.99999',
    });
  });

  async function expectCustomerAndAsset(input: {
    provider: string;
    currency: string;
    amount: string;
    tokenType?: string;
    metadata?: Record<string, unknown>;
    sourceReference?: string;
    expectedAsset: string;
    expectedAssetProvider: string;
    expectedWallet?: string | null;
  }) {
    const result = await createTreasuryEventsFromPaymentConfirmed({
      organizationId: ORG,
      paymentLinkId: LINK,
      paymentEventId: PE,
      provider: input.provider,
      currency: input.currency,
      amount: input.amount,
      tokenType: input.tokenType,
      metadata: input.metadata,
      sourceReference: input.sourceReference,
      occurredAt: new Date('2026-08-01T10:00:00Z'),
    });

    expect(result.customerPaymentEventId).toBeTruthy();
    expect(result.assetReceivedEventId).toBeTruthy();
    expect(prisma.treasury_events.create).toHaveBeenCalledTimes(2);
    expect(prisma.treasury_event_links.create).toHaveBeenCalledTimes(1);

    const customerCall = prisma.treasury_events.create.mock.calls[0][0].data;
    const assetCall = prisma.treasury_events.create.mock.calls[1][0].data;

    expect(customerCall.event_type).toBe('CUSTOMER_PAYMENT');
    expect(customerCall.provider_reference).toBe(`payment_event:${PE}:customer_payment`);
    expect(customerCall.asset).toBe(input.expectedAsset);
    expect(customerCall.organization_id).toBe(ORG);
    expect(customerCall.payment_link_id).toBe(LINK);
    expect(customerCall.payment_event_id).toBe(PE);

    expect(assetCall.event_type).toBe('ASSET_RECEIVED');
    expect(assetCall.provider_reference).toBe(`payment_event:${PE}:asset_received`);
    expect(assetCall.asset).toBe(input.expectedAsset);
    expect(assetCall.provider).toBe(input.expectedAssetProvider);
    expect(assetCall.destination_address).toBe(input.expectedWallet ?? null);
    expect(assetCall.status).toBe('CONFIRMED');
  }

  it('1. Stripe → CUSTOMER_PAYMENT + ASSET_RECEIVED (AUD)', async () => {
    await expectCustomerAndAsset({
      provider: 'stripe',
      currency: 'AUD',
      amount: '150',
      sourceReference: 'pi_123',
      expectedAsset: 'AUD',
      expectedAssetProvider: 'stripe',
      expectedWallet: null,
    });
  });

  it('2. Wise → CUSTOMER_PAYMENT + ASSET_RECEIVED', async () => {
    await expectCustomerAndAsset({
      provider: 'wise',
      currency: 'EUR',
      amount: '200',
      sourceReference: 'wise-transfer-1',
      expectedAsset: 'EUR',
      expectedAssetProvider: 'wise',
      expectedWallet: null,
    });
  });

  it('3. EVM USDC → USDC ASSET_RECEIVED with wallet', async () => {
    await expectCustomerAndAsset({
      provider: 'evm_wallet',
      currency: 'USDC',
      amount: '1500',
      tokenType: 'USDC',
      metadata: {
        token_type: 'USDC',
        transaction_hash: '0xabc',
        network: 'base',
      },
      expectedAsset: 'USDC',
      expectedAssetProvider: 'blockchain',
      expectedWallet: '0xMerchantWallet',
    });
  });

  it('4. EVM USDT → USDT ASSET_RECEIVED', async () => {
    await expectCustomerAndAsset({
      provider: 'evm_wallet',
      currency: 'USDT',
      amount: '500',
      metadata: { token_type: 'USDT', transaction_hash: '0xdef' },
      expectedAsset: 'USDT',
      expectedAssetProvider: 'blockchain',
      expectedWallet: '0xMerchantWallet',
    });
  });

  it('5. Hedera HBAR → HBAR ASSET_RECEIVED', async () => {
    await expectCustomerAndAsset({
      provider: 'hedera',
      currency: 'HBAR',
      amount: '1000',
      metadata: { token_type: 'HBAR' },
      sourceReference: '0.0.123@1234567890.123456789',
      expectedAsset: 'HBAR',
      expectedAssetProvider: 'blockchain',
      expectedWallet: '0.0.99999',
    });
  });

  it('6. Hedera USDC → USDC ASSET_RECEIVED (uses token_type not invoice)', async () => {
    await expectCustomerAndAsset({
      provider: 'hedera',
      currency: 'HBAR',
      amount: '100',
      tokenType: 'USDC',
      metadata: { token_type: 'USDC', merchant_account_id: '0.0.99999' },
      sourceReference: '0.0.456@1234567890.123456789',
      expectedAsset: 'USDC',
      expectedAssetProvider: 'blockchain',
      expectedWallet: '0.0.99999',
    });
  });

  it('7. duplicate PAYMENT_CONFIRMED → no duplicate treasury events or links', async () => {
    prisma.treasury_events.findUnique
      .mockResolvedValueOnce({ id: 'existing-customer' })
      .mockResolvedValueOnce({ id: 'existing-asset' });
    prisma.treasury_event_links.findUnique.mockResolvedValue({ id: 'existing-link' });

    await createTreasuryEventsFromPaymentConfirmed({
      organizationId: ORG,
      paymentLinkId: LINK,
      paymentEventId: PE,
      provider: 'stripe',
      currency: 'AUD',
      amount: '100',
    });

    expect(prisma.treasury_events.create).not.toHaveBeenCalled();
    expect(prisma.treasury_event_links.create).not.toHaveBeenCalled();
  });

  it('8. enforces org / payment-link / payment-event on ingest', async () => {
    await createTreasuryEventsFromPaymentConfirmed({
      organizationId: ORG,
      paymentLinkId: LINK,
      paymentEventId: PE,
      provider: 'stripe',
      currency: 'AUD',
      amount: '50',
    });

    for (const call of prisma.treasury_events.create.mock.calls) {
      expect(call[0].data.organization_id).toBe(ORG);
      expect(call[0].data.payment_link_id).toBe(LINK);
      expect(call[0].data.payment_event_id).toBe(PE);
    }
  });

  it('9. preserves wallet metadata when available', async () => {
    await createTreasuryEventsFromPaymentConfirmed({
      organizationId: ORG,
      paymentLinkId: LINK,
      paymentEventId: PE,
      provider: 'evm_wallet',
      currency: 'USDC',
      amount: '1',
      metadata: {
        token_type: 'USDC',
        transaction_hash: '0xhash123',
        network: 'polygon',
        merchant_wallet_address: '0xFromMeta',
      },
    });

    const assetCall = prisma.treasury_events.create.mock.calls[1][0].data;
    expect(assetCall.transaction_hash).toBe('0xhash123');
    expect(assetCall.wallet_network).toBe('polygon');
    expect(assetCall.destination_address).toBe('0xMerchantWallet');
  });

  it('10. does not invent wallet when unavailable', async () => {
    prisma.merchant_settings.findFirst.mockResolvedValue({
      evm_wallet_address: null,
      hedera_account_id: null,
    });

    await createTreasuryEventsFromPaymentConfirmed({
      organizationId: ORG,
      paymentLinkId: LINK,
      paymentEventId: PE,
      provider: 'evm_wallet',
      currency: 'USDC',
      amount: '1',
      metadata: { token_type: 'USDC', transaction_hash: '0x1' },
    });

    const assetCall = prisma.treasury_events.create.mock.calls[1][0].data;
    expect(assetCall.destination_address).toBeNull();
  });

  it('11. treasury hook failure does not throw', async () => {
    prisma.merchant_settings.findFirst.mockRejectedValue(new Error('db down'));

    expect(() => {
      hookTreasuryFromPaymentConfirmation({
        organizationId: ORG,
        paymentLinkId: LINK,
        paymentEventId: PE,
        provider: 'stripe',
        currency: 'AUD',
        amount: '10',
      });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 20));
    expect(loggers.payment.error).toHaveBeenCalled();
  });

  it('different payment events cannot collide on provider references', async () => {
    const refs = new Set<string>();
    for (const peId of ['pe-a', 'pe-b']) {
      await ingestTreasuryEvent({
        organizationId: ORG,
        eventType: 'CUSTOMER_PAYMENT',
        provider: 'provvy',
        providerReference: `payment_event:${peId}:customer_payment`,
        asset: 'AUD',
        amount: '1',
        paymentLinkId: LINK,
        paymentEventId: peId,
        occurredAt: new Date(),
      });
      refs.add(`payment_event:${peId}:customer_payment`);
    }
    expect(refs.size).toBe(2);
    expect(prisma.treasury_events.create).toHaveBeenCalledTimes(2);
  });

  it('different organizations cannot share idempotency keys', async () => {
    await ingestTreasuryEvent({
      organizationId: 'org-a',
      eventType: 'CUSTOMER_PAYMENT',
      provider: 'provvy',
      providerReference: `payment_event:${PE}:customer_payment`,
      asset: 'AUD',
      amount: '1',
      paymentLinkId: LINK,
      paymentEventId: PE,
      occurredAt: new Date(),
    });
    await ingestTreasuryEvent({
      organizationId: 'org-b',
      eventType: 'CUSTOMER_PAYMENT',
      provider: 'provvy',
      providerReference: `payment_event:${PE}:customer_payment`,
      asset: 'AUD',
      amount: '1',
      paymentLinkId: LINK,
      paymentEventId: PE,
      occurredAt: new Date(),
    });
    expect(prisma.treasury_events.create).toHaveBeenCalledTimes(2);
  });

  it('events remain CONFIRMED — not RECONCILED', async () => {
    await createTreasuryEventsFromPaymentConfirmed({
      organizationId: ORG,
      paymentLinkId: LINK,
      paymentEventId: PE,
      provider: 'stripe',
      currency: 'AUD',
      amount: '10',
    });

    for (const call of prisma.treasury_events.create.mock.calls) {
      expect(call[0].data.status).toBe('CONFIRMED');
      expect(call[0].data.event_type).not.toBe('BANK_SETTLEMENT');
    }
  });
});

describe('resolveConfirmedPaymentAsset', () => {
  it('prefers metadata token_type over currency', () => {
    expect(
      resolveConfirmedPaymentAsset({
        provider: 'hedera',
        currency: 'HBAR',
        metadata: { token_type: 'USDC' },
      })
    ).toBe('USDC');
  });
});

describe('resolveReceiveWalletContext', () => {
  it('does not invent EVM wallet without settings or metadata', () => {
    const ctx = resolveReceiveWalletContext('evm_wallet', { token_type: 'USDC' }, null, null);
    expect(ctx.destinationAddress).toBeNull();
  });
});

describe('ingestTreasuryEventLink idempotency', () => {
  it('returns existing link without duplicate create', async () => {
    jest.clearAllMocks();
    prisma.treasury_event_links.findUnique.mockResolvedValue({ id: 'existing-link' });

    const result = await ingestTreasuryEventLink({
      organizationId: ORG,
      sourceEventId: 'src-1',
      targetEventId: 'tgt-1',
      linkType: 'PARENT_CHILD',
    });
    expect(result.created).toBe(false);
    expect(result.linkId).toBe('existing-link');
    expect(prisma.treasury_event_links.create).not.toHaveBeenCalled();
  });
});
