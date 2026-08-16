import { createTreasuryEventsFromPaymentConfirmed } from '@/lib/treasury/events/from-payment-confirmed';
import { ingestTreasuryEvent } from '@/lib/treasury/events/ingest-treasury-event';

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

const { prisma } = jest.requireMock('@/lib/server/prisma');

describe('treasury from payment confirmed (legacy)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.treasury_events.findUnique.mockResolvedValue(null);
    prisma.treasury_event_links.findUnique.mockResolvedValue(null);
    prisma.treasury_events.create.mockImplementation(({ data }: { data: { id?: string } }) =>
      Promise.resolve({ id: data.id ?? `evt-${Math.random()}` })
    );
    prisma.treasury_event_links.create.mockResolvedValue({ id: 'link-1' });
    prisma.merchant_settings.findFirst.mockResolvedValue({
      evm_wallet_address: '0xABC123',
      hedera_account_id: '0.0.12345',
    });
  });

  it('creates CUSTOMER_PAYMENT and ASSET_RECEIVED for evm_wallet', async () => {
    const result = await createTreasuryEventsFromPaymentConfirmed({
      organizationId: 'org-1',
      paymentLinkId: 'link-1',
      paymentEventId: 'pe-1',
      provider: 'evm_wallet',
      currency: 'USDC',
      amount: '1500',
      metadata: {
        token_type: 'USDC',
        transaction_hash: '0xdeadbeef',
        network: 'base',
      },
    });

    expect(result.customerPaymentEventId).toBeTruthy();
    expect(result.assetReceivedEventId).toBeTruthy();
    expect(prisma.treasury_events.create).toHaveBeenCalledTimes(2);
  });

  it('duplicate confirmation does not create duplicate treasury events', async () => {
    prisma.treasury_events.findUnique.mockResolvedValue({ id: 'existing-1' });

    const first = await ingestTreasuryEvent({
      organizationId: 'org-1',
      eventType: 'CUSTOMER_PAYMENT',
      provider: 'provvy',
      providerReference: 'payment_event:pe-1:customer_payment',
      asset: 'USDC',
      amount: '1500',
      paymentLinkId: 'link-1',
      paymentEventId: 'pe-1',
      occurredAt: new Date(),
    });

    const second = await ingestTreasuryEvent({
      organizationId: 'org-1',
      eventType: 'CUSTOMER_PAYMENT',
      provider: 'provvy',
      providerReference: 'payment_event:pe-1:customer_payment',
      asset: 'USDC',
      amount: '1500',
      paymentLinkId: 'link-1',
      paymentEventId: 'pe-1',
      occurredAt: new Date(),
    });

    expect(first.created).toBe(false);
    expect(second.created).toBe(false);
    expect(first.eventId).toBe('existing-1');
    expect(prisma.treasury_events.create).not.toHaveBeenCalled();
  });

  it('stripe payment creates CUSTOMER_PAYMENT and ASSET_RECEIVED', async () => {
    const result = await createTreasuryEventsFromPaymentConfirmed({
      organizationId: 'org-1',
      paymentLinkId: 'link-1',
      paymentEventId: 'pe-2',
      provider: 'stripe',
      currency: 'AUD',
      amount: '100',
    });

    expect(result.customerPaymentEventId).toBeTruthy();
    expect(result.assetReceivedEventId).toBeTruthy();
    expect(prisma.treasury_events.create).toHaveBeenCalledTimes(2);
  });
});
