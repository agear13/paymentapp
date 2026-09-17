import type { PublicClient, TransactionReceipt } from 'viem';
import { stringToBytes32 } from '@/lib/xlayer/terms-hash';
import type { XlayerCommitmentRecord } from '@/lib/xlayer/types';

const mockGetCommitmentById = jest.fn();
const mockSaveVerificationResult = jest.fn();
const mockWriteCommitmentAudit = jest.fn();

jest.mock('@/lib/xlayer/store.server', () => ({
  getCommitmentById: (...args: unknown[]) => mockGetCommitmentById(...args),
  saveVerificationResult: (...args: unknown[]) => mockSaveVerificationResult(...args),
  writeCommitmentAudit: (...args: unknown[]) => mockWriteCommitmentAudit(...args),
  buildXlayerExplorerTxUrl: (hash: string) => `https://www.okx.com/web3/explorer/xlayer-test/tx/${hash}`,
}));

jest.mock('@/lib/xlayer/chain', () => {
  const actual = jest.requireActual('@/lib/xlayer/chain');
  return {
    ...actual,
    getConfiguredRegistryAddress: () => '0x1111111111111111111111111111111111111111',
  };
});

import { verifyXlayerCommitment } from '@/lib/xlayer/verify.server';

const REGISTRY = '0x1111111111111111111111111111111111111111';
const WALLET = '0x2222222222222222222222222222222222222222';
const COMMITMENT_ID = `0x${'aa'.repeat(32)}` as const;
const TERMS_HASH = `0x${'bb'.repeat(32)}` as const;
const TX = `0x${'cd'.repeat(32)}`;

function record(overrides: Partial<XlayerCommitmentRecord> = {}): XlayerCommitmentRecord {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sourceAgreementId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    pilotDealId: null,
    displayCommitmentId: '0xaabbccddee',
    onchainCommitmentId: COMMITMENT_ID,
    buyerLabel: 'Buyer',
    supplierLabel: 'Supplier',
    amountMinorUnits: 10_000_000,
    sourceCurrency: 'AUD',
    settlementCurrency: 'AUD',
    dueDate: '2026-10-17T00:00:00.000Z',
    purpose: 'Inventory purchase',
    termsHash: TERMS_HASH,
    offchainLifecycleStage: 'negotiated',
    onchainStatus: null,
    verificationStatus: 'submitted',
    chainId: 1952,
    contractAddress: REGISTRY,
    walletAddress: WALLET,
    transactionHash: TX,
    blockNumber: null,
    explorerUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdByUserId: 'user-1',
    originalDueLabel: 'Net 30',
    incentive: null,
    registerArgs: {
      commitmentId: COMMITMENT_ID,
      buyerRefHash: `0x${'11'.repeat(32)}`,
      supplierRefHash: `0x${'22'.repeat(32)}`,
      amountMinorUnits: '10000000',
      sourceCurrency: stringToBytes32('AUD'),
      settlementCurrency: stringToBytes32('AUD'),
      dueDate: Math.floor(Date.parse('2026-10-17T00:00:00.000Z') / 1000),
      purposeHash: `0x${'33'.repeat(32)}`,
      termsHash: TERMS_HASH,
    },
    ...overrides,
  };
}

function onchain(overrides: Record<string, unknown> = {}) {
  const base = record();
  return {
    commitmentId: base.onchainCommitmentId,
    creator: WALLET,
    buyerRefHash: base.registerArgs.buyerRefHash,
    supplierRefHash: base.registerArgs.supplierRefHash,
    amountMinorUnits: BigInt(base.amountMinorUnits),
    sourceCurrency: stringToBytes32('AUD'),
    settlementCurrency: stringToBytes32('AUD'),
    dueDate: BigInt(base.registerArgs.dueDate),
    purposeHash: base.registerArgs.purposeHash,
    termsHash: TERMS_HASH,
    status: 1,
    createdAt: BigInt(1),
    ...overrides,
  };
}

function receipt(overrides: Partial<TransactionReceipt> = {}): TransactionReceipt {
  return {
    status: 'success',
    to: REGISTRY,
    from: WALLET,
    blockNumber: BigInt(123),
    transactionHash: TX,
    logs: [],
    ...overrides,
  } as TransactionReceipt;
}

function registeredLogs(creator = WALLET) {
  return [
    {
      args: {
        commitmentId: COMMITMENT_ID,
        creator,
        termsHash: TERMS_HASH,
        amountMinorUnits: BigInt(10_000_000),
      },
    },
  ] as never;
}

describe('xlayer verification', () => {
  beforeEach(() => {
    mockGetCommitmentById.mockReset();
    mockSaveVerificationResult.mockReset();
    mockWriteCommitmentAudit.mockReset().mockResolvedValue(undefined);
    mockSaveVerificationResult.mockImplementation(
      async (input: { verificationStatus: string }) =>
        record({
          verificationStatus: input.verificationStatus as XlayerCommitmentRecord['verificationStatus'],
          onchainStatus: input.verificationStatus === 'verified' ? 'registered' : null,
          explorerUrl:
            input.verificationStatus === 'verified'
              ? `https://www.okx.com/web3/explorer/xlayer-test/tx/${TX}`
              : null,
        })
    );
  });

  it('verifies a successful registration', async () => {
    mockGetCommitmentById.mockResolvedValue(record());
    const client = {
      getTransactionReceipt: jest.fn().mockResolvedValue(receipt()),
      readContract: jest.fn().mockResolvedValue(onchain()),
    } as unknown as PublicClient;
    const result = await verifyXlayerCommitment(
      { organizationId: record().organizationId, userId: 'user-1', id: record().id },
      { getPublicClient: () => client, parseRegisteredLogs: () => registeredLogs() }
    );
    expect(result.verificationStatus).toBe('verified');
    expect(mockWriteCommitmentAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'verified' }));
  });

  it('mismatches the wrong creator', async () => {
    mockGetCommitmentById.mockResolvedValue(record());
    const client = {
      getTransactionReceipt: jest.fn().mockResolvedValue(receipt()),
      readContract: jest.fn(),
    } as unknown as PublicClient;
    const result = await verifyXlayerCommitment(
      { organizationId: record().organizationId, userId: 'user-1', id: record().id },
      {
        getPublicClient: () => client,
        parseRegisteredLogs: () => registeredLogs('0x3333333333333333333333333333333333333333'),
      }
    );
    expect(result.verificationStatus).toBe('mismatch');
  });

  it('mismatches the wrong contract', async () => {
    mockGetCommitmentById.mockResolvedValue(record());
    const client = {
      getTransactionReceipt: jest.fn().mockResolvedValue(
        receipt({ to: '0x4444444444444444444444444444444444444444' })
      ),
      readContract: jest.fn(),
    } as unknown as PublicClient;
    const result = await verifyXlayerCommitment(
      { organizationId: record().organizationId, userId: 'user-1', id: record().id },
      { getPublicClient: () => client }
    );
    expect(result.verificationStatus).toBe('mismatch');
  });

  it('fails a reverted receipt', async () => {
    mockGetCommitmentById.mockResolvedValue(record());
    const client = {
      getTransactionReceipt: jest.fn().mockResolvedValue(receipt({ status: 'reverted' })),
      readContract: jest.fn(),
    } as unknown as PublicClient;
    const result = await verifyXlayerCommitment(
      { organizationId: record().organizationId, userId: 'user-1', id: record().id },
      { getPublicClient: () => client }
    );
    expect(result.verificationStatus).toBe('failed');
  });

  it('mismatches a terms hash difference', async () => {
    mockGetCommitmentById.mockResolvedValue(record());
    const client = {
      getTransactionReceipt: jest.fn().mockResolvedValue(receipt()),
      readContract: jest.fn().mockResolvedValue(onchain({ termsHash: `0x${'ff'.repeat(32)}` })),
    } as unknown as PublicClient;
    const result = await verifyXlayerCommitment(
      { organizationId: record().organizationId, userId: 'user-1', id: record().id },
      { getPublicClient: () => client, parseRegisteredLogs: () => registeredLogs() }
    );
    expect(result.verificationStatus).toBe('mismatch');
  });

  it('mismatches an amount difference', async () => {
    mockGetCommitmentById.mockResolvedValue(record());
    const client = {
      getTransactionReceipt: jest.fn().mockResolvedValue(receipt()),
      readContract: jest.fn().mockResolvedValue(onchain({ amountMinorUnits: BigInt(1) })),
    } as unknown as PublicClient;
    const result = await verifyXlayerCommitment(
      { organizationId: record().organizationId, userId: 'user-1', id: record().id },
      { getPublicClient: () => client, parseRegisteredLogs: () => registeredLogs() }
    );
    expect(result.verificationStatus).toBe('mismatch');
  });
});
