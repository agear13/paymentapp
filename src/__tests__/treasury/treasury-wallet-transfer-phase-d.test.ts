import {
  buildEvmOutboundProviderReference,
  parseAlchemyOutboundAddressActivity,
} from '@/lib/evm/alchemy-outbound.server';
import { getTokenAddress } from '@/lib/evm/tokens';
import { ingestTreasuryEvent } from '@/lib/treasury/events/ingest-treasury-event';
import { ingestTreasuryEventLink } from '@/lib/treasury/events/treasury-event-links';
import {
  correlateWalletTransferToAssetReceived,
  isAmountOnlyWalletCorrelation,
} from '@/lib/treasury/observers/wallet-transfer/correlate-wallet-transfer';
import {
  buildHederaOutboundProviderReference,
  parseHederaOutboundTransfer,
} from '@/lib/treasury/observers/wallet-transfer/hedera-outbound';
import { ingestObservedOutboundTransfer } from '@/lib/treasury/observers/wallet-transfer/ingest-observed-transfer';
import { TOKEN_CONFIG } from '@/lib/hedera/constants';
import { buildInvoiceTreasuryReconciliation } from '@/lib/treasury/reconciliation/chain';

jest.mock('@/lib/treasury/integration/connection-service', () => ({
  getDigitalSurgeSyncMetadata: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    treasury_events: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    treasury_event_links: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    merchant_settings: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    payment_links: { findFirst: jest.fn() },
    payment_events: { findFirst: jest.fn() },
    xero_syncs: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    payment: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    jobs: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  },
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');

const ORG_A = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const LINK = 'link-cccccccc-cccc-cccc-cccc-cccccccccccc';
const MERCHANT_EVM = '0xMerchantWallet1111111111111111111111111111';
const DEST_EVM = '0xExchangeDeposit2222222222222222222222222222';
const MERCHANT_HEDERA = '0.0.12345';
const DEST_HEDERA = '0.0.67890';

let eventCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `evt-${eventCounter}`;
}

function evmTransfer(params: {
  asset: 'USDC' | 'USDT';
  amount?: string;
  txHash?: string;
  network?: 'base' | 'ethereum' | 'polygon';
}) {
  const network = params.network ?? 'base';
  const txHash = params.txHash ?? `0xoutbound${params.asset}${Date.now()}`;
  const contract = getTokenAddress(params.asset, network);
  const rawValue = BigInt(Math.round(Number(params.amount ?? '1500') * 1_000_000)).toString(16);

  return {
    providerReference: buildEvmOutboundProviderReference({
      networkId: network,
      transactionHash: txHash,
      asset: params.asset,
      sourceAddress: MERCHANT_EVM,
      destinationAddress: DEST_EVM,
    }),
    transactionHash: txHash.toLowerCase(),
    asset: params.asset,
    amount: params.amount ?? '1500',
    sourceAddress: MERCHANT_EVM,
    destinationAddress: DEST_EVM,
    walletNetwork: network,
    occurredAt: new Date('2026-08-02T10:00:00Z'),
    confirmationStatus: 'CONFIRMED' as const,
    observationSource: 'alchemy_rpc' as const,
    rawProviderPayload: {
      hash: txHash,
      from: MERCHANT_EVM,
      to: DEST_EVM,
      rawContract: { address: contract, value: `0x${rawValue}` },
    },
  };
}

describe('Phase D — wallet treasury observation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    eventCounter = 0;

    prisma.treasury_events.findUnique.mockResolvedValue(null);
    prisma.treasury_event_links.findUnique.mockResolvedValue(null);
    prisma.treasury_event_links.findFirst.mockResolvedValue(null);
    prisma.treasury_events.create.mockImplementation(() =>
      Promise.resolve({ id: nextEventId() })
    );
    prisma.treasury_event_links.create.mockImplementation(() =>
      Promise.resolve({ id: `link-${nextEventId()}` })
    );
    prisma.treasury_events.update.mockResolvedValue({});
  });

  describe('EVM outbound parsing and ingest', () => {
    it('creates WALLET_TRANSFER for EVM USDC outbound', async () => {
      const transfer = evmTransfer({ asset: 'USDC' });
      const result = await ingestObservedOutboundTransfer(ORG_A, transfer);

      expect(result.created).toBe(true);
      expect(prisma.treasury_events.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organization_id: ORG_A,
          event_type: 'WALLET_TRANSFER',
          status: 'CONFIRMED',
          provider: 'blockchain',
          provider_reference: transfer.providerReference,
          asset: 'USDC',
          amount: expect.anything(),
          source_address: MERCHANT_EVM,
          destination_address: DEST_EVM,
          wallet_network: 'base',
          transaction_hash: transfer.transactionHash,
        }),
      });
    });

    it('creates WALLET_TRANSFER for EVM USDT outbound', async () => {
      const transfer = evmTransfer({ asset: 'USDT', txHash: '0xusdtoutbound' });
      await ingestObservedOutboundTransfer(ORG_A, transfer);

      expect(prisma.treasury_events.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event_type: 'WALLET_TRANSFER',
          asset: 'USDT',
          provider_reference: expect.stringContaining(':USDT:'),
        }),
      });
    });

    it('records negative amount for outbound transfer', async () => {
      const transfer = evmTransfer({ asset: 'USDC', amount: '2500' });
      await ingestObservedOutboundTransfer(ORG_A, transfer);

      const createData = prisma.treasury_events.create.mock.calls[0][0].data;
      expect(createData.amount.toString()).toBe('-2500');
    });

    it('parses Alchemy webhook outbound USDC activity', () => {
      const contract = getTokenAddress('USDC', 'base');
      const parsed = parseAlchemyOutboundAddressActivity(
        {
          event: {
            network: 'BASE_MAINNET',
            activity: [
              {
                category: 'token',
                hash: '0xWebhookHash',
                fromAddress: MERCHANT_EVM,
                toAddress: DEST_EVM,
                asset: 'USDC',
                rawContract: {
                  address: contract,
                  rawValue: '0x5f5e100',
                  decimals: 6,
                },
              },
            ],
          },
        },
        MERCHANT_EVM
      );

      expect(parsed).toMatchObject({
        asset: 'USDC',
        amount: '100',
        sourceAddress: MERCHANT_EVM,
        destinationAddress: DEST_EVM,
        observationSource: 'alchemy_webhook',
      });
    });
  });

  describe('Hedera outbound parsing and ingest', () => {
    it('creates WALLET_TRANSFER for Hedera HBAR outbound', async () => {
      const tx = {
        transaction_id: '0.0.12345@1700000000.123456789',
        result: 'SUCCESS',
        consensus_timestamp: '1700000000.123456789',
        transfers: [
          { account: MERCHANT_HEDERA, amount: -100_000_000 },
          { account: DEST_HEDERA, amount: 100_000_000 },
        ],
      };

      const parsed = parseHederaOutboundTransfer(tx, MERCHANT_HEDERA);
      expect(parsed).toMatchObject({
        asset: 'HBAR',
        amount: '1',
        sourceAddress: MERCHANT_HEDERA,
        destinationAddress: DEST_HEDERA,
        walletNetwork: 'hedera',
      });

      prisma.treasury_events.findFirst.mockResolvedValueOnce({
        id: 'wt-1',
        organization_id: ORG_A,
        event_type: 'WALLET_TRANSFER',
        source_address: MERCHANT_HEDERA,
        asset: 'HBAR',
        payment_link_id: null,
      });
      prisma.treasury_events.findMany.mockResolvedValueOnce([]);

      await ingestObservedOutboundTransfer(ORG_A, parsed!);
      expect(prisma.treasury_events.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          event_type: 'WALLET_TRANSFER',
          asset: 'HBAR',
          wallet_network: 'hedera',
        }),
      });
    });

    it('creates WALLET_TRANSFER for Hedera USDC outbound', async () => {
      const usdcId = TOKEN_CONFIG.USDC.id!;
      const tx = {
        transaction_id: '0.0.12345@1700000001.123456789',
        result: 'SUCCESS',
        consensus_timestamp: '1700000001.123456789',
        token_transfers: [
          { token_id: usdcId, account: MERCHANT_HEDERA, amount: -1_500_000_000 },
          { token_id: usdcId, account: DEST_HEDERA, amount: 1_500_000_000 },
        ],
      };

      const parsed = parseHederaOutboundTransfer(tx, MERCHANT_HEDERA);
      expect(parsed).toMatchObject({
        asset: 'USDC',
        amount: '1500',
        providerReference: buildHederaOutboundProviderReference({
          transactionId: tx.transaction_id,
          asset: 'USDC',
          sourceAccount: MERCHANT_HEDERA,
          destinationAccount: DEST_HEDERA,
        }),
      });
    });
  });

  describe('idempotency', () => {
    it('deduplicates by provider reference on repeated ingest', async () => {
      const transfer = evmTransfer({ asset: 'USDC', txHash: '0xidempotent' });
      prisma.treasury_events.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-wt' });

      const first = await ingestObservedOutboundTransfer(ORG_A, transfer);
      expect(first.created).toBe(true);

      const second = await ingestObservedOutboundTransfer(ORG_A, transfer);
      expect(second.created).toBe(false);
      expect(second.eventId).toBe('existing-wt');
      expect(prisma.treasury_events.create).toHaveBeenCalledTimes(1);
    });

    it('deduplicates duplicate Alchemy webhook observation', async () => {
      const transfer = evmTransfer({ asset: 'USDC', txHash: '0xalchemydup' });
      transfer.observationSource = 'alchemy_webhook';

      prisma.treasury_events.findUnique.mockResolvedValue({ id: 'wt-alchemy' });
      const result = await ingestObservedOutboundTransfer(ORG_A, transfer);
      expect(result.created).toBe(false);
      expect(prisma.treasury_events.create).not.toHaveBeenCalled();
    });

    it('deduplicates duplicate Hedera mirror observation', async () => {
      const transfer = evmTransfer({ asset: 'USDC', txHash: '0xhederamirror' });
      transfer.observationSource = 'hedera_mirror';
      transfer.walletNetwork = 'hedera';
      transfer.providerReference = buildHederaOutboundProviderReference({
        transactionId: '0.0.12345@1700000002.123456789',
        asset: 'USDC',
        sourceAccount: MERCHANT_HEDERA,
        destinationAccount: DEST_HEDERA,
      });

      prisma.treasury_events.findUnique.mockResolvedValue({ id: 'wt-hedera' });
      const result = await ingestObservedOutboundTransfer(ORG_A, transfer);
      expect(result.created).toBe(false);
    });

    it('uses stable provider reference from transaction hash', () => {
      const ref = buildEvmOutboundProviderReference({
        networkId: 'base',
        transactionHash: '0xABC',
        asset: 'USDC',
        sourceAddress: MERCHANT_EVM,
        destinationAddress: DEST_EVM,
      });
      expect(ref).toBe(
        `evm:outbound:base:0xabc:USDC:${MERCHANT_EVM.toLowerCase()}:${DEST_EVM.toLowerCase()}`
      );
    });
  });

  describe('deterministic correlation', () => {
    it('links ASSET_RECEIVED to WALLET_TRANSFER when exactly one unmatched candidate exists', async () => {
      const walletTransferId = 'wt-linked';
      prisma.treasury_events.findFirst.mockResolvedValueOnce({
        id: walletTransferId,
        organization_id: ORG_A,
        event_type: 'WALLET_TRANSFER',
        source_address: MERCHANT_EVM,
        asset: 'USDC',
        payment_link_id: null,
      });
      prisma.treasury_events.findMany.mockResolvedValueOnce([
        {
          id: 'ar-1',
          payment_link_id: LINK,
          payment_event_id: 'pe-1',
          asset: 'USDC',
          destination_address: MERCHANT_EVM,
        },
      ]);
      prisma.treasury_event_links.findFirst.mockResolvedValueOnce(null);

      const result = await correlateWalletTransferToAssetReceived(ORG_A, walletTransferId);

      expect(result.linked).toBe(true);
      expect(result.linkStatus).toBe('CONFIRMED');
      expect(result.paymentLinkId).toBe(LINK);
      expect(prisma.treasury_event_links.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source_event_id: 'ar-1',
          target_event_id: walletTransferId,
          link_type: 'PARENT_CHILD',
          link_status: 'CONFIRMED',
          evidence: expect.objectContaining({
            strategy: 'unique_unmatched_asset_received_same_wallet_asset',
          }),
        }),
      });
      expect(prisma.treasury_events.update).toHaveBeenCalledWith({
        where: { id: walletTransferId },
        data: { payment_link_id: LINK },
      });
    });

    it('leaves outbound UNKNOWN when multiple ASSET_RECEIVED candidates exist (no amount matching)', async () => {
      prisma.treasury_events.findFirst.mockResolvedValueOnce({
        id: 'wt-ambiguous',
        organization_id: ORG_A,
        event_type: 'WALLET_TRANSFER',
        source_address: MERCHANT_EVM,
        asset: 'USDC',
        payment_link_id: null,
      });
      prisma.treasury_events.findMany.mockResolvedValueOnce([
        {
          id: 'ar-1',
          payment_link_id: 'link-1',
          asset: 'USDC',
          destination_address: MERCHANT_EVM,
        },
        {
          id: 'ar-2',
          payment_link_id: 'link-2',
          asset: 'USDC',
          destination_address: MERCHANT_EVM,
        },
      ]);
      prisma.treasury_event_links.findFirst.mockResolvedValue(null);

      const result = await correlateWalletTransferToAssetReceived(ORG_A, 'wt-ambiguous');

      expect(result.linked).toBe(false);
      expect(result.linkStatus).toBe('UNKNOWN');
      expect(result.reason).toBe('ambiguous_multiple_asset_received_candidates');
      expect(prisma.treasury_event_links.create).not.toHaveBeenCalled();
    });

    it('rejects amount-only correlation explicitly', () => {
      expect(
        isAmountOnlyWalletCorrelation({ matchOnAmountOnly: true })
      ).toBe(true);
      expect(
        isAmountOnlyWalletCorrelation({ matchOnTimestampOnly: true })
      ).toBe(true);
      expect(isAmountOnlyWalletCorrelation({})).toBe(false);
    });
  });

  describe('cross-organization isolation', () => {
    it('stores treasury events under the requesting organization only', async () => {
      const transfer = evmTransfer({ asset: 'USDC', txHash: '0xorgisolation' });
      await ingestObservedOutboundTransfer(ORG_B, transfer);

      expect(prisma.treasury_events.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ organization_id: ORG_B }),
      });
    });

    it('correlates only within the same organization', async () => {
      prisma.treasury_events.findFirst.mockResolvedValueOnce({
        id: 'wt-org-a',
        organization_id: ORG_A,
        event_type: 'WALLET_TRANSFER',
        source_address: MERCHANT_EVM,
        asset: 'USDC',
        payment_link_id: null,
      });
      prisma.treasury_events.findMany.mockResolvedValueOnce([]);

      const result = await correlateWalletTransferToAssetReceived(ORG_A, 'wt-org-a');
      expect(result.reason).toBe('no_unmatched_asset_received');
      expect(prisma.treasury_events.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organization_id: ORG_A }),
        })
      );
    });
  });

  describe('existing payment and Xero behaviour unchanged', () => {
    it('does not modify payment_events or xero_syncs during wallet transfer ingest', async () => {
      const transfer = evmTransfer({ asset: 'USDC', txHash: '0xno-payment-touch' });
      prisma.treasury_events.findFirst.mockResolvedValue({
        id: 'wt-1',
        organization_id: ORG_A,
        event_type: 'WALLET_TRANSFER',
        source_address: MERCHANT_EVM,
        asset: 'USDC',
        payment_link_id: null,
      });
      prisma.treasury_events.findMany.mockResolvedValue([]);

      await ingestObservedOutboundTransfer(ORG_A, transfer);

      expect(prisma.payment_events).toBeDefined();
      expect(prisma.xero_syncs).toBeDefined();
      expect(prisma.payment_events.create).toBeUndefined();
      expect(prisma.xero_syncs.create).toBeUndefined();
    });

    it('ingestTreasuryEvent idempotency keys remain scoped per event type', async () => {
      await ingestTreasuryEvent({
        organizationId: ORG_A,
        eventType: 'CUSTOMER_PAYMENT',
        provider: 'provvy',
        providerReference: 'payment_event:pe-1:customer_payment',
        occurredAt: new Date(),
      });
      await ingestTreasuryEvent({
        organizationId: ORG_A,
        eventType: 'ASSET_RECEIVED',
        provider: 'blockchain',
        providerReference: 'payment_event:pe-1:asset_received',
        occurredAt: new Date(),
      });

      expect(prisma.treasury_events.create).toHaveBeenCalledTimes(2);
      const types = prisma.treasury_events.create.mock.calls.map(
        (call: [{ data: { event_type: string } }]) => call[0].data.event_type
      );
      expect(types).toEqual(['CUSTOMER_PAYMENT', 'ASSET_RECEIVED']);
    });
  });
});

describe('Phase D — invoice treasury lifecycle UI chain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payment_links.findFirst.mockResolvedValue({
      id: LINK,
      invoice_reference: 'INV-00485',
      short_code: 'Ab12Cd34',
      status: 'PAID',
    });
    prisma.payment_events.findFirst.mockResolvedValue({ id: 'pe-1' });
    prisma.xero_syncs.findFirst.mockResolvedValue({ id: 'xs-1' });
    prisma.treasury_event_links.findMany.mockResolvedValue([]);
    prisma.treasury_events.findFirst.mockResolvedValue(null);
  });

  it('shows confirmed outbound wallet transfer lifecycle steps', async () => {
    prisma.treasury_events.findMany.mockResolvedValue([
      {
        id: 'e1',
        event_type: 'CUSTOMER_PAYMENT',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '1500' },
        provider: 'provvy',
        occurred_at: new Date('2026-08-01T10:00:00Z'),
        destination_address: null,
      },
      {
        id: 'e2',
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '1500' },
        provider: 'blockchain',
        occurred_at: new Date('2026-08-01T10:05:00Z'),
        destination_address: MERCHANT_EVM,
      },
      {
        id: 'e3',
        event_type: 'WALLET_TRANSFER',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '-1500' },
        provider: 'blockchain',
        occurred_at: new Date('2026-08-02T10:00:00Z'),
        destination_address: DEST_EVM,
        source_address: MERCHANT_EVM,
      },
    ]);
    prisma.treasury_event_links.findMany.mockResolvedValue([
      {
        target_event: {
          id: 'e3',
          status: 'CONFIRMED',
          asset: 'USDC',
          amount: { toString: () => '-1500' },
          destination_address: DEST_EVM,
          occurred_at: new Date('2026-08-02T10:00:00Z'),
        },
      },
    ]);

    const result = await buildInvoiceTreasuryReconciliation(ORG_A, LINK);
    expect(result?.steps.find((s) => s.stage === 'wallet_sent')?.label).toBe('USDC sent');
    expect(result?.steps.find((s) => s.stage === 'wallet_destination')?.detail).toBe(DEST_EVM);
    expect(result?.steps.find((s) => s.stage === 'awaiting_exchange')?.label).toBe(
      'Awaiting exchange activity'
    );
  });

  it('shows unknown wallet movement when unlinked outbound exists', async () => {
    prisma.treasury_events.findMany.mockResolvedValue([
      {
        id: 'e2',
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        asset: 'USDC',
        amount: { toString: () => '1500' },
        provider: 'blockchain',
        occurred_at: new Date('2026-08-01T10:05:00Z'),
        destination_address: MERCHANT_EVM,
      },
    ]);
    prisma.treasury_event_links.findMany.mockResolvedValue([]);
    prisma.treasury_events.findFirst.mockResolvedValue({ id: 'unlinked-wt' });

    const result = await buildInvoiceTreasuryReconciliation(ORG_A, LINK);
    expect(result?.steps.find((s) => s.stage === 'unknown_wallet_movement')?.label).toContain(
      'Unknown wallet movement'
    );
  });
});
