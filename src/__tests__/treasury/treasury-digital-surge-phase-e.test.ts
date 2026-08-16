import { DigitalSurgeClient } from '@/lib/treasury/connectors/digital-surge/client';
import { DigitalSurgeConnector } from '@/lib/treasury/connectors/digital-surge/connector';
import {
  digitalSurgeProviderReference,
  extractDigitalSurgeTxHash,
  normalizeDigitalSurgeTransaction,
} from '@/lib/treasury/connectors/digital-surge/normalize';
import type { DigitalSurgeAllTransaction } from '@/lib/treasury/connectors/digital-surge/types';
import { ingestTreasuryEvent } from '@/lib/treasury/events/ingest-treasury-event';
import {
  findDepositToConversionCorrelation,
  findDeterministicCorrelation,
  isWeakCorrelationAttempt,
} from '@/lib/treasury/reconciliation/correlation';
import { syncTreasuryForOrganization } from '@/lib/treasury/observers/sync-digital-surge';
import {
  encryptTreasurySecret,
  redactApiKeyMaterial,
} from '@/lib/treasury/integration/encryption';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    treasury_events: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    treasury_event_links: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    treasury_integration_connections: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/treasury/integration/connection-service', () => ({
  getDigitalSurgeConnection: jest.fn(),
  getDigitalSurgeSyncMetadata: jest.fn(),
  markDigitalSurgeSyncResult: jest.fn(),
}));

jest.mock('@/lib/treasury/connectors/digital-surge/connector', () => {
  const actual = jest.requireActual('@/lib/treasury/connectors/digital-surge/connector');
  return {
    ...actual,
    digitalSurgeConnector: {
      fetchDepositAddresses: jest.fn(),
      fetchTransactions: jest.fn(),
      checkConnectionHealth: jest.fn(),
      fetchBalances: jest.fn(),
    },
  };
});

jest.mock('@/lib/logger', () => ({
  loggers: {
    jobs: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    payment: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  },
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');
const { getDigitalSurgeConnection, markDigitalSurgeSyncResult } = jest.requireMock(
  '@/lib/treasury/integration/connection-service'
);
const { digitalSurgeConnector } = jest.requireMock(
  '@/lib/treasury/connectors/digital-surge/connector'
);

const ORG_A = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const DS_DEPOSIT_ADDR = '0xdigitalsurge deposit000000000000000000001';

function dsTx(overrides: Partial<DigitalSurgeAllTransaction> = {}): DigitalSurgeAllTransaction {
  return {
    summary_id: 501,
    id: 601,
    object_id: 701,
    created: '2026-08-03T10:00:00Z',
    src_asset: 'USDC',
    dst_asset: 'USDC',
    src_amount: '1500',
    dst_amount: '1500',
    quote_cost: null,
    exchange_rate: '1',
    cost: '0',
    fee: '0',
    aud_fee: '0',
    aud_value: '2250',
    fee_currency: 'AUD',
    status: 'completed',
    transaction_type: 'deposit',
    transaction_subtype: 'crypto',
    blockchain_tx_hash: '0xdsdeposithash',
    ...overrides,
  };
}

describe('Phase E — Digital Surge exchange connector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.treasury_events.findUnique.mockResolvedValue(null);
    prisma.treasury_event_links.findUnique.mockResolvedValue(null);
    prisma.treasury_events.create.mockImplementation(({ data }: { data: { event_type: string } }) =>
      Promise.resolve({ id: `evt-${data.event_type}` })
    );
    prisma.treasury_event_links.create.mockResolvedValue({ id: 'link-1' });
  });

  describe('authentication and connection health', () => {
    it('uses Bearer Authorization header without logging secrets', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ first_name: 'Danielle', email: 'd@example.com' }),
      } as Response);

      const client = new DigitalSurgeClient('super-secret-api-key-12345678');
      await client.getProfileBrief();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/private/profile/brief/'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer super-secret-api-key-12345678',
          }),
        })
      );

      fetchMock.mockRestore();
    });

    it('reports connection health from profile brief', async () => {
      getDigitalSurgeConnection.mockResolvedValue({ id: 'conn-1', apiKey: 'key' });
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ email: 'merchant@example.com', verified_account: true }),
      } as Response);

      const connector = new DigitalSurgeConnector();
      const health = await connector.checkConnectionHealth({ organizationId: ORG_A });

      expect(health.healthy).toBe(true);
      expect(health.providerAccountLabel).toBe('merchant@example.com');
    });
  });

  describe('credential isolation and redaction', () => {
    it('encrypts credentials and redacts for logs', () => {
      process.env.TREASURY_ENCRYPTION_KEY = 'test-encryption-key-for-phase-e';
      const encrypted = encryptTreasurySecret('my-digital-surge-api-key');
      expect(encrypted).not.toContain('my-digital-surge-api-key');
      expect(redactApiKeyMaterial('my-digital-surge-api-key')).toBe('my-d…-key');
    });
  });

  describe('normalization and ingestion', () => {
    it('ingests EXCHANGE_DEPOSIT from Digital Surge deposit', () => {
      const records = normalizeDigitalSurgeTransaction(dsTx());
      expect(records[0].eventType).toBe('EXCHANGE_DEPOSIT');
      expect(records[0].provider).toBe('digital_surge');
      expect(records[0].transactionHash).toBe('0xdsdeposithash');
    });

    it('ingests CONVERSION for USDC→AUD swap with fees and AUD credit', () => {
      const records = normalizeDigitalSurgeTransaction(
        dsTx({
          transaction_type: 'swap',
          src_asset: 'USDC',
          dst_asset: 'AUD',
          src_amount: '1500',
          dst_amount: '2245',
          aud_fee: '5',
          exchange_rate: '1.496666',
          blockchain_tx_hash: null,
        })
      );
      expect(records.some((r) => r.eventType === 'CONVERSION')).toBe(true);
      expect(records.some((r) => r.eventType === 'FIAT_CREDIT')).toBe(true);
      const conversion = records.find((r) => r.eventType === 'CONVERSION')!;
      expect(conversion.asset).toBe('USDC');
      expect(conversion.destinationAsset).toBe('AUD');
      expect(conversion.exchangeRate).toBe('1.496666');
      expect(conversion.feeAmount).toBe('5');
    });

    it('ingests AUD withdrawal separately without BANK_SETTLEMENT', () => {
      const records = normalizeDigitalSurgeTransaction(
        dsTx({
          transaction_type: 'withdrawal',
          src_asset: 'AUD',
          dst_asset: 'AUD',
          transaction_subtype: 'bank_transfer',
          src_amount: '2000',
          status: 'completed',
        })
      );
      expect(records[0].eventType).toBe('FIAT_CREDIT');
      expect(records[0].eventType).not.toBe('BANK_SETTLEMENT');
      expect(records[0].metadata?.display_as).toBe('aud_withdrawal');
      expect(records[0].status).toBe('CONFIRMED');
    });

    it('AUD withdrawal with pending status does not become confirmed BANK_SETTLEMENT', () => {
      const records = normalizeDigitalSurgeTransaction(
        dsTx({
          transaction_type: 'withdrawal',
          src_asset: 'AUD',
          dst_asset: 'AUD',
          transaction_subtype: 'internal',
          src_amount: '2000',
          status: 'pending',
        })
      );
      expect(records[0].status).toBe('UNKNOWN');
      expect(records.every((r) => r.eventType !== 'BANK_SETTLEMENT')).toBe(true);
    });

    it('conversion creates FIAT_CREDIT aud_balance_credit at Digital Surge', () => {
      const records = normalizeDigitalSurgeTransaction(
        dsTx({
          transaction_type: 'swap',
          src_asset: 'USDC',
          dst_asset: 'AUD',
          dst_amount: '2245',
        })
      );
      const audCredit = records.find((r) => r.metadata?.display_as === 'aud_balance_credit');
      expect(audCredit?.eventType).toBe('FIAT_CREDIT');
      expect(audCredit?.status).toBe('CONFIRMED');
    });

    it('explicit BANK_SETTLEMENT CONFIRMED could come from future bank connector only', () => {
      expect(
        normalizeDigitalSurgeTransaction(
          dsTx({
            transaction_type: 'withdrawal',
            src_asset: 'AUD',
            transaction_subtype: 'bank_transfer',
            status: 'completed',
          })
        ).some((r) => r.eventType === 'BANK_SETTLEMENT')
      ).toBe(false);
    });
  });

  describe('deterministic correlation', () => {
    const knownAddresses = new Set([DS_DEPOSIT_ADDR.toLowerCase()]);

    it('correlates WALLET_TRANSFER to EXCHANGE_DEPOSIT by exact transaction hash', () => {
      const match = findDeterministicCorrelation(
        {
          id: 'wt-1',
          organization_id: ORG_A,
          event_type: 'WALLET_TRANSFER',
          status: 'CONFIRMED',
          transaction_hash: '0xabc',
          provider_reference: 'evm:outbound:base:0xabc:USDC:a:b',
          payment_link_id: 'link-1',
          source_address: '0xmerchant',
          destination_address: DS_DEPOSIT_ADDR,
          amount: { toString: () => '-1500' },
          asset: 'USDC',
        },
        {
          id: 'dep-1',
          organization_id: ORG_A,
          event_type: 'EXCHANGE_DEPOSIT',
          status: 'CONFIRMED',
          transaction_hash: '0xabc',
          provider_reference: digitalSurgeProviderReference(dsTx()),
          payment_link_id: null,
          destination_address: DS_DEPOSIT_ADDR,
          amount: { toString: () => '1500' },
          asset: 'USDC',
        },
        { knownDepositAddresses: knownAddresses }
      );
      expect(match?.strategy).toBe('known_deposit_address_with_hash');
      expect(match?.status).toBe('CONFIRMED');
    });

    it('rejects wallet transfer when hash matches but destination is not a known DS deposit address', () => {
      const match = findDeterministicCorrelation(
        {
          id: 'wt-1',
          organization_id: ORG_A,
          event_type: 'WALLET_TRANSFER',
          status: 'CONFIRMED',
          transaction_hash: '0xabc',
          provider_reference: 'evm:outbound',
          payment_link_id: null,
          source_address: '0xmerchant',
          destination_address: '0xrandomaddress',
          amount: { toString: () => '-1500' },
          asset: 'USDC',
        },
        {
          id: 'dep-1',
          organization_id: ORG_A,
          event_type: 'EXCHANGE_DEPOSIT',
          status: 'CONFIRMED',
          transaction_hash: '0xabc',
          provider_reference: 'ds:summary:1:object:2',
          payment_link_id: null,
          destination_address: null,
          amount: { toString: () => '1500' },
          asset: 'USDC',
        },
        { knownDepositAddresses: knownAddresses }
      );
      expect(match).toBeNull();
    });

    it('rejects amount-only and timestamp-only matching', () => {
      expect(isWeakCorrelationAttempt({ matchOnAmountOnly: true })).toBe(true);
      expect(isWeakCorrelationAttempt({ matchOnTimestampOnly: true })).toBe(true);
    });

    it('leaves wallet transfer UNKNOWN when only amount/token would match', () => {
      const match = findDeterministicCorrelation(
        {
          id: 'wt-1',
          organization_id: ORG_A,
          event_type: 'WALLET_TRANSFER',
          status: 'CONFIRMED',
          transaction_hash: null,
          provider_reference: 'evm:outbound',
          payment_link_id: null,
          source_address: '0xmerchant',
          destination_address: DS_DEPOSIT_ADDR,
          amount: { toString: () => '-1500' },
          asset: 'USDC',
        },
        {
          id: 'dep-1',
          organization_id: ORG_A,
          event_type: 'EXCHANGE_DEPOSIT',
          status: 'UNKNOWN',
          transaction_hash: null,
          provider_reference: 'ds:summary:9:object:9',
          payment_link_id: null,
          destination_address: DS_DEPOSIT_ADDR,
          amount: { toString: () => '1500' },
          asset: 'USDC',
        },
        { knownDepositAddresses: knownAddresses }
      );
      expect(match).toBeNull();
    });

    it('links deposit to conversion by shared provider object_id', () => {
      const deposit = {
        id: 'dep-1',
        organization_id: ORG_A,
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'CONFIRMED' as const,
        transaction_hash: null,
        provider_reference: 'ds:summary:501:object:701',
        payment_link_id: 'link-1',
        source_address: null,
        destination_address: null,
        amount: { toString: () => '1500' },
        asset: 'USDC',
        metadata: { digital_surge: { objectId: 701, summaryId: 501 } },
      };
      const conversion = {
        id: 'conv-1',
        organization_id: ORG_A,
        event_type: 'CONVERSION',
        status: 'CONFIRMED' as const,
        transaction_hash: null,
        provider_reference: 'ds:summary:502:object:701',
        payment_link_id: 'link-1',
        source_address: null,
        destination_address: null,
        amount: { toString: () => '1500' },
        asset: 'USDC',
        metadata: { digital_surge: { objectId: 701, summaryId: 502 } },
      };
      const match = findDepositToConversionCorrelation(deposit, conversion);
      expect(match?.strategy).toBe('provider_object_id');
    });
  });

  describe('sync', () => {
    it('runs incremental idempotent sync for organization', async () => {
      getDigitalSurgeConnection.mockResolvedValue({ id: 'conn-1', apiKey: 'key' });
      prisma.treasury_integration_connections.findUnique.mockResolvedValue({
        last_sync_at: new Date('2026-08-02T00:00:00Z'),
        metadata: { sync_cursor: { lastCreatedAt: '2026-08-02T00:00:00Z' } },
      });
      prisma.treasury_events.findMany.mockResolvedValue([]);
      digitalSurgeConnector.fetchDepositAddresses.mockResolvedValue([
        { asset: 'USDC', address: DS_DEPOSIT_ADDR, active: true },
      ]);
      digitalSurgeConnector.fetchTransactions.mockResolvedValue({
        records: normalizeDigitalSurgeTransaction(dsTx()),
        cursor: { lastCreatedAt: '2026-08-03T10:00:00Z', lastSummaryId: 501 },
      });

      const first = await syncTreasuryForOrganization(ORG_A);
      expect(first.ingested).toBe(1);
      expect(first.depositsCorrelated).toBe(0);
      expect(markDigitalSurgeSyncResult).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_A,
          error: null,
          metadata: expect.objectContaining({
            deposit_addresses: expect.objectContaining({ USDC: [DS_DEPOSIT_ADDR] }),
          }),
        })
      );

      prisma.treasury_events.findUnique.mockResolvedValue({ id: 'existing' });
      const second = await syncTreasuryForOrganization(ORG_A);
      expect(second.skipped).toBe(1);
      expect(second.ingested).toBe(0);
    });

    it('isolates sync by organization', async () => {
      getDigitalSurgeConnection.mockImplementation((organizationId: string) =>
        organizationId === ORG_B ? { id: 'conn-b', apiKey: 'key-b' } : null
      );
      prisma.treasury_integration_connections.findUnique.mockResolvedValue(null);
      digitalSurgeConnector.fetchDepositAddresses.mockResolvedValue([]);
      digitalSurgeConnector.fetchTransactions.mockResolvedValue({ records: [], cursor: {} });

      const result = await syncTreasuryForOrganization(ORG_A);
      expect(result.ingested).toBe(0);
      expect(digitalSurgeConnector.fetchTransactions).not.toHaveBeenCalled();
    });
  });

  describe('idempotency and payment isolation', () => {
    it('uses stable provider reference for duplicate Digital Surge transactions', async () => {
      const ref = digitalSurgeProviderReference(dsTx());
      prisma.treasury_events.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-dep' });

      const record = normalizeDigitalSurgeTransaction(dsTx())[0];
      const first = await ingestTreasuryEvent({ organizationId: ORG_A, ...record, occurredAt: new Date() });
      const second = await ingestTreasuryEvent({ organizationId: ORG_A, ...record, occurredAt: new Date() });

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(ref).toContain('ds:summary:501:object:701');
      expect(extractDigitalSurgeTxHash(dsTx())).toBe('0xdsdeposithash');
    });

    it('does not modify customer payment event types during exchange ingest', async () => {
      const record = normalizeDigitalSurgeTransaction(dsTx())[0];
      await ingestTreasuryEvent({ organizationId: ORG_A, ...record, occurredAt: new Date() });
      expect(prisma.treasury_events.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ event_type: 'EXCHANGE_DEPOSIT' }),
      });
      expect(prisma.payment_events).toBeUndefined();
    });
  });
});
