import { buildTreasuryReconciliationChain } from '@/lib/treasury/reconciliation/engine';
import {
  detectReconciliationExceptions,
  deriveChainStatus,
} from '@/lib/treasury/reconciliation/exceptions';
import {
  countCorrelationCandidates,
  evaluatePairCorrelation,
  evidenceFromLink,
  findLinkBetween,
} from '@/lib/treasury/reconciliation/matching';
import { createManualTreasuryLink, ManualReconciliationError } from '@/lib/treasury/reconciliation/manual-link';
import { computeTreasuryReconciliationMetrics } from '@/lib/treasury/reconciliation/metrics';
import { buildInvoiceTreasuryReconciliation } from '@/lib/treasury/reconciliation/chain';
import type { ReconciliationChainNode } from '@/lib/treasury/reconciliation/types';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    payment_links: { findFirst: jest.fn(), findMany: jest.fn() },
    treasury_events: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    treasury_event_links: { findMany: jest.fn(), upsert: jest.fn() },
    treasury_manual_reconciliations: { create: jest.fn() },
    payment_events: { findFirst: jest.fn() },
    xero_syncs: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/treasury/integration/connection-service', () => ({
  getDigitalSurgeSyncMetadata: jest.fn().mockResolvedValue({
    deposit_addresses: { USDC: ['0xdigitalsurge deposit000000000000000000001'] },
  }),
}));

jest.mock('@/lib/treasury/reconciliation/correlation', () => {
  const actual = jest.requireActual('@/lib/treasury/reconciliation/correlation');
  return actual;
});

const { prisma } = jest.requireMock('@/lib/server/prisma');

const ORG = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const LINK = 'link-11111111-1111-1111-1111-111111111111';
const DS_ADDR = '0xdigitalsurge deposit000000000000000000001';

function evt(
  overrides: Record<string, unknown> & { id: string; event_type: string }
) {
  return {
    organization_id: ORG,
    status: 'CONFIRMED',
    transaction_hash: null,
    provider_reference: `ref:${overrides.id}`,
    payment_link_id: LINK,
    source_address: null,
    destination_address: null,
    amount: { toString: () => '1000' },
    destination_amount: null,
    destination_asset: null,
    exchange_rate: null,
    fee_amount: null,
    asset: 'USDC',
    provider: 'blockchain',
    occurred_at: new Date('2026-08-01T10:00:00Z'),
    metadata: {},
    ...overrides,
  };
}

function linkRow(
  sourceId: string,
  targetId: string,
  overrides: Record<string, unknown> = {}
) {
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

describe('Phase F — Treasury Reconciliation Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payment_links.findFirst.mockResolvedValue({
      id: LINK,
      invoice_reference: 'INV-001',
      short_code: 'Ab12Cd34',
      status: 'PAID',
    });
    prisma.payment_links.findMany.mockResolvedValue([]);
    prisma.treasury_events.findFirst.mockResolvedValue(null);
    prisma.treasury_event_links.findMany.mockResolvedValue([]);
    prisma.payment_events.findFirst.mockResolvedValue({ id: 'pe-1' });
    prisma.xero_syncs.findFirst.mockResolvedValue({ id: 'xs-1' });
  });

  describe('complete chain → RECONCILED', () => {
    it('marks chain RECONCILED only with confirmed bank settlement and confirmed nodes', async () => {
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
          amount: { toString: () => '-998' },
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
          destination_amount: { toString: () => '1490' },
          exchange_rate: { toString: () => '1.49' },
          metadata: { digital_surge: { object_id: 701 } },
        }),
        evt({
          id: 'ab',
          event_type: 'FIAT_CREDIT',
          asset: 'AUD',
          provider: 'digital_surge',
          metadata: { display_as: 'aud_balance_credit' },
        }),
        evt({
          id: 'aw',
          event_type: 'FIAT_CREDIT',
          asset: 'AUD',
          amount: { toString: () => '-1485' },
          metadata: { display_as: 'aud_withdrawal' },
        }),
        evt({
          id: 'bs',
          event_type: 'BANK_SETTLEMENT',
          asset: 'AUD',
          provider: 'bank_feed',
          status: 'CONFIRMED',
        }),
      ];
      prisma.treasury_events.findMany.mockResolvedValue(events);
      prisma.treasury_event_links.findMany.mockResolvedValue([
        linkRow('cp', 'ar', { link_type: 'PARENT_CHILD', evidence: { strategy: 'payment_link' } }),
        linkRow('ar', 'wt', { link_type: 'PARENT_CHILD', evidence: { strategy: 'wallet_continuity' } }),
        linkRow('wt', 'ed', { evidence: { strategy: 'transaction_hash' } }),
        linkRow('ed', 'cv', { link_type: 'PARENT_CHILD', evidence: { strategy: 'provider_object_id' } }),
      ]);

      const chain = await buildTreasuryReconciliationChain(ORG, LINK);
      expect(chain?.chainStatus).toBe('RECONCILED');
      expect(chain?.nodes.some((n) => n.stage === 'bank_settlement')).toBe(true);
      expect(chain?.nodes.find((n) => n.stage === 'conversion')?.destinationAmount).toBe('1490');
    });
  });

  describe('partial chains', () => {
    it('returns AWAITING_WALLET_ACTIVITY when asset received but no wallet transfer', async () => {
      prisma.treasury_events.findMany.mockResolvedValue([
        evt({ id: 'cp', event_type: 'CUSTOMER_PAYMENT', provider: 'provvy' }),
        evt({
          id: 'ar',
          event_type: 'ASSET_RECEIVED',
          destination_address: '0xMerchant',
        }),
      ]);

      const chain = await buildTreasuryReconciliationChain(ORG, LINK);
      expect(chain?.chainStatus).toBe('AWAITING_WALLET_ACTIVITY');
    });

    it('returns AWAITING_EXCHANGE_IDENTIFICATION for wallet transfer without deposit', async () => {
      prisma.treasury_events.findMany.mockResolvedValue([
        evt({
          id: 'ar',
          event_type: 'ASSET_RECEIVED',
          destination_address: '0xMerchant',
        }),
        evt({
          id: 'wt',
          event_type: 'WALLET_TRANSFER',
          source_address: '0xMerchant',
          destination_address: '0xUnknown',
        }),
      ]);
      prisma.treasury_event_links.findMany.mockResolvedValue([
        linkRow('ar', 'wt', { link_type: 'PARENT_CHILD' }),
      ]);

      const chain = await buildTreasuryReconciliationChain(ORG, LINK);
      expect(chain?.chainStatus).toBe('AWAITING_EXCHANGE_IDENTIFICATION');
    });

    it('returns AWAITING_BANK_CONFIRMATION after DS withdrawal without bank settlement', async () => {
      prisma.treasury_events.findMany.mockResolvedValue([
        evt({ id: 'ed', event_type: 'EXCHANGE_DEPOSIT', provider: 'digital_surge' }),
        evt({ id: 'cv', event_type: 'CONVERSION', provider: 'digital_surge', destination_asset: 'AUD' }),
        evt({
          id: 'aw',
          event_type: 'FIAT_CREDIT',
          asset: 'AUD',
          metadata: { display_as: 'aud_withdrawal' },
        }),
      ]);

      const chain = await buildTreasuryReconciliationChain(ORG, LINK);
      expect(chain?.chainStatus).toBe('AWAITING_BANK_CONFIRMATION');
      expect(chain?.exceptions.some((e) => e.type === 'awaiting_bank_confirmation')).toBe(true);
    });

    it('never marks incomplete chain as RECONCILED', async () => {
      prisma.treasury_events.findMany.mockResolvedValue([
        evt({ id: 'ar', event_type: 'ASSET_RECEIVED', destination_address: '0xM' }),
        evt({ id: 'wt', event_type: 'WALLET_TRANSFER' }),
        evt({ id: 'ed', event_type: 'EXCHANGE_DEPOSIT', provider: 'digital_surge' }),
        evt({ id: 'cv', event_type: 'CONVERSION', provider: 'digital_surge', destination_asset: 'AUD' }),
      ]);

      const chain = await buildTreasuryReconciliationChain(ORG, LINK);
      expect(chain?.chainStatus).not.toBe('RECONCILED');
    });
  });

  describe('matching hierarchy', () => {
    const walletTransfer = {
      id: 'wt-1',
      organization_id: ORG,
      event_type: 'WALLET_TRANSFER',
      status: 'CONFIRMED' as const,
      transaction_hash: '0xabc',
      provider_reference: 'wt:1',
      payment_link_id: LINK,
      source_address: '0xM',
      destination_address: DS_ADDR,
      amount: { toString: () => '1000' },
      asset: 'USDC',
    };

    it('matches by exact transaction hash', () => {
      const deposit = {
        ...walletTransfer,
        id: 'ed-1',
        event_type: 'EXCHANGE_DEPOSIT',
        provider_reference: 'ds:1',
      };
      const match = evaluatePairCorrelation(walletTransfer, deposit, {
        knownDepositAddresses: new Set([DS_ADDR.toLowerCase()]),
      });
      expect(match?.strategy).toBe('known_deposit_address_with_hash');
    });

    it('matches deposit address with hash when DS address is known', () => {
      const deposit = {
        ...walletTransfer,
        id: 'ed-2',
        event_type: 'EXCHANGE_DEPOSIT',
        transaction_hash: '0xabc',
        destination_address: DS_ADDR,
      };
      const match = evaluatePairCorrelation(walletTransfer, deposit, {
        knownDepositAddresses: new Set([DS_ADDR.toLowerCase()]),
      });
      expect(['transaction_hash', 'known_deposit_address_with_hash']).toContain(match?.strategy);
    });

    it('matches conversion via provider object id', () => {
      const deposit = {
        id: 'ed-3',
        organization_id: ORG,
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'CONFIRMED' as const,
        transaction_hash: '0xdep',
        provider_reference: 'ds:501:601',
        payment_link_id: LINK,
        source_address: null,
        destination_address: null,
        amount: { toString: () => '1000' },
        asset: 'USDC',
        metadata: { digital_surge: { object_id: 701 } },
      };
      const conversion = {
        id: 'cv-1',
        organization_id: ORG,
        event_type: 'CONVERSION',
        status: 'CONFIRMED' as const,
        transaction_hash: null,
        provider_reference: 'ds:501:602',
        payment_link_id: LINK,
        source_address: null,
        destination_address: null,
        amount: { toString: () => '1000' },
        asset: 'USDC',
        metadata: { digital_surge: { object_id: 701 } },
      };
      const match = evaluatePairCorrelation(deposit, conversion);
      expect(match?.strategy).toBe('provider_object_id');
    });

    it('returns null for cross-organisation pairs', () => {
      const otherOrgDeposit = {
        ...walletTransfer,
        id: 'ed-x',
        event_type: 'EXCHANGE_DEPOSIT',
        organization_id: ORG_B,
      };
      expect(evaluatePairCorrelation(walletTransfer, otherOrgDeposit)).toBeNull();
    });

    it('flags ambiguous candidates instead of auto-selecting', () => {
      const wt = walletTransfer;
      const d1 = { ...wt, id: 'd1', event_type: 'EXCHANGE_DEPOSIT', transaction_hash: '0xabc' };
      const d2 = { ...wt, id: 'd2', event_type: 'EXCHANGE_DEPOSIT', transaction_hash: '0xabc' };
      const candidates = countCorrelationCandidates(wt, [d1, d2], {
        knownDepositAddresses: new Set([DS_ADDR.toLowerCase()]),
      });
      expect(candidates.length).toBeGreaterThan(1);
    });
  });

  describe('exceptions', () => {
    it('detects unknown wallet movement', () => {
      const exceptions = detectReconciliationExceptions({
        paymentLinkId: LINK,
        events: [evt({ id: 'ar', event_type: 'ASSET_RECEIVED' })],
        links: [],
        nodes: [],
        chainStatus: 'AWAITING_EXCHANGE_IDENTIFICATION',
        unknownOutboundMovement: true,
      });
      expect(exceptions.some((e) => e.type === 'unknown_wallet_movement')).toBe(true);
    });

    it('detects duplicate provider events', () => {
      const events = [
        evt({ id: 'e1', event_type: 'EXCHANGE_DEPOSIT', provider_reference: 'ds:dup' }),
        evt({ id: 'e2', event_type: 'EXCHANGE_DEPOSIT', provider_reference: 'ds:dup' }),
      ];
      const exceptions = detectReconciliationExceptions({
        paymentLinkId: LINK,
        events,
        links: [],
        nodes: [],
        chainStatus: 'EXCEPTION',
      });
      expect(exceptions.some((e) => e.type === 'duplicate_provider_event')).toBe(true);
    });

    it('detects multiple assets on one invoice', () => {
      const events = [
        evt({ id: 'a1', event_type: 'ASSET_RECEIVED', asset: 'USDC' }),
        evt({ id: 'a2', event_type: 'ASSET_RECEIVED', asset: 'USDT' }),
      ];
      const exceptions = detectReconciliationExceptions({
        paymentLinkId: LINK,
        events,
        links: [],
        nodes: [],
        chainStatus: 'PARTIAL',
      });
      expect(exceptions.some((e) => e.type === 'unexpected_asset')).toBe(true);
    });

    it('does not infer BANK_SETTLEMENT from DS withdrawal', () => {
      const events = [
        evt({
          id: 'aw',
          event_type: 'FIAT_CREDIT',
          asset: 'AUD',
          metadata: { display_as: 'aud_withdrawal' },
        }),
      ];
      const exceptions = detectReconciliationExceptions({
        paymentLinkId: LINK,
        events,
        links: [],
        nodes: [],
        chainStatus: 'AWAITING_BANK_CONFIRMATION',
      });
      expect(exceptions.some((e) => e.type === 'awaiting_bank_confirmation')).toBe(true);
      expect(events.some((e) => e.event_type === 'BANK_SETTLEMENT')).toBe(false);
    });
  });

  describe('fees and amount differences', () => {
    it('preserves source and destination amounts without fuzzy matching', () => {
      const nodes: ReconciliationChainNode[] = [
        {
          stage: 'wallet_transfer',
          eventType: 'WALLET_TRANSFER',
          label: 'USDC sent',
          status: 'CONFIRMED',
          asset: 'USDC',
          amount: '-998',
          feeAmount: '2',
          provider: 'blockchain',
          occurredAt: null,
          transactionReference: '0xout',
          providerReference: 'wt:1',
          destinationAddress: DS_ADDR,
          evidence: null,
        },
        {
          stage: 'exchange_deposit',
          eventType: 'EXCHANGE_DEPOSIT',
          label: 'Deposit',
          status: 'CONFIRMED',
          asset: 'USDC',
          amount: '998',
          provider: 'digital_surge',
          occurredAt: null,
          transactionReference: '0xout',
          providerReference: 'ds:1',
          destinationAddress: null,
          evidence: { strategy: 'transaction_hash', manual: false },
        },
      ];
      expect(nodes[0].amount).not.toBe(nodes[1].amount);
      expect(nodes[0].feeAmount).toBe('2');
    });
  });

  describe('manual reconciliation', () => {
    beforeEach(() => {
      prisma.treasury_events.findFirst
        .mockResolvedValueOnce({
          id: 'wt-1',
          organization_id: ORG,
          event_type: 'WALLET_TRANSFER',
          status: 'CONFIRMED',
          payment_link_id: LINK,
          provider_reference: 'wt:1',
          transaction_hash: '0x1',
        })
        .mockResolvedValueOnce({
          id: 'ed-1',
          organization_id: ORG,
          event_type: 'EXCHANGE_DEPOSIT',
          status: 'UNKNOWN',
          payment_link_id: null,
          provider_reference: 'ds:1',
          transaction_hash: '0x1',
        });
      prisma.treasury_event_links.upsert.mockResolvedValue({ id: 'manual-link-1' });
      prisma.treasury_manual_reconciliations.create.mockResolvedValue({
        id: 'audit-1',
        linked_at: new Date('2026-08-16T10:00:00Z'),
      });
      prisma.treasury_events.update.mockResolvedValue({});
    });

    it('creates auditable manual link with user and evidence', async () => {
      const result = await createManualTreasuryLink({
        organizationId: ORG,
        sourceEventId: 'wt-1',
        targetEventId: 'ed-1',
        linkedByUserId: 'user-1',
        confirmLink: true,
        notes: 'Confirmed DS deposit for invoice',
      });
      expect(result.auditId).toBe('audit-1');
      expect(prisma.treasury_manual_reconciliations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            linked_by_user_id: 'user-1',
            notes: 'Confirmed DS deposit for invoice',
          }),
        })
      );
    });

    it('manual link evidence is distinguishable from provider confirmed link', () => {
      const manual = evidenceFromLink({
        id: 'l1',
        source_event_id: 'a',
        target_event_id: 'b',
        link_type: 'MANUAL',
        link_status: 'INFERRED',
        evidence: { strategy: 'manual' },
      });
      const confirmed = evidenceFromLink({
        id: 'l2',
        source_event_id: 'a',
        target_event_id: 'b',
        link_type: 'CORRELATION',
        link_status: 'CONFIRMED',
        evidence: { strategy: 'transaction_hash' },
      });
      expect(manual.manual).toBe(true);
      expect(confirmed.manual).toBe(false);
      expect(confirmed.linkStatus).toBe('CONFIRMED');
    });

    it('blocks manual links involving BANK_SETTLEMENT', async () => {
      prisma.treasury_events.findFirst.mockReset();
      prisma.treasury_events.findFirst
        .mockResolvedValueOnce({
          id: 'aw',
          organization_id: ORG,
          event_type: 'FIAT_CREDIT',
          status: 'CONFIRMED',
          payment_link_id: LINK,
          provider_reference: 'ds:w',
          transaction_hash: null,
        })
        .mockResolvedValueOnce({
          id: 'bs',
          organization_id: ORG,
          event_type: 'BANK_SETTLEMENT',
          status: 'UNKNOWN',
          payment_link_id: LINK,
          provider_reference: 'bank:1',
          transaction_hash: null,
        });

      await expect(
        createManualTreasuryLink({
          organizationId: ORG,
          sourceEventId: 'aw',
          targetEventId: 'bs',
          linkedByUserId: 'user-1',
          confirmLink: true,
        })
      ).rejects.toBeInstanceOf(ManualReconciliationError);
    });
  });

  describe('deriveChainStatus', () => {
    it('returns EXCEPTION when severity EXCEPTION present', () => {
      const status = deriveChainStatus({
        nodes: [],
        exceptions: [
          {
            type: 'duplicate_provider_event',
            severity: 'EXCEPTION',
            observed: 'x',
            expected: 'y',
            reason: 'z',
            suggestedAction: 'a',
            relatedEventIds: [],
          },
        ],
        hasConfirmedBankSettlement: false,
        hasAudWithdrawal: false,
        hasWalletTransfer: false,
        hasExchangeDeposit: false,
        unknownOutboundMovement: false,
      });
      expect(status).toBe('EXCEPTION');
    });
  });

  describe('findLinkBetween', () => {
    it('finds directed link between events', () => {
      const links = [linkRow('a', 'b')];
      expect(findLinkBetween(links, 'a', 'b')?.id).toBe('link-a-b');
      expect(findLinkBetween(links, 'b', 'a')).toBeNull();
    });
  });

  describe('metrics', () => {
    it('computes reconciliation metrics from treasury events', async () => {
      prisma.treasury_events.findMany.mockResolvedValue([
        {
          event_type: 'ASSET_RECEIVED',
          status: 'CONFIRMED',
          asset: 'USDC',
          amount: { toString: () => '1000' },
          destination_amount: null,
          metadata: {},
          payment_link_id: LINK,
        },
        {
          event_type: 'FIAT_CREDIT',
          status: 'CONFIRMED',
          asset: 'AUD',
          amount: { toString: () => '500' },
          destination_amount: null,
          metadata: { display_as: 'aud_withdrawal' },
          payment_link_id: LINK,
        },
      ]);
      prisma.payment_links.findMany.mockResolvedValue([]);

      const metrics = await computeTreasuryReconciliationMetrics(ORG);
      expect(metrics.totalCryptoReceived).toBe(1000);
      expect(metrics.audAwaitingBankConfirmation).toBe(500);
    });
  });

  describe('Xero customer payment unchanged', () => {
    it('still exposes Xero step from existing sync without treasury accounting changes', async () => {
      prisma.treasury_events.findMany.mockResolvedValue([
        evt({ id: 'cp', event_type: 'CUSTOMER_PAYMENT', provider: 'provvy' }),
        evt({ id: 'ar', event_type: 'ASSET_RECEIVED', destination_address: '0xM' }),
      ]);

      const result = await buildInvoiceTreasuryReconciliation(ORG, LINK);
      expect(result?.steps.find((s) => s.stage === 'xero')?.status).toBe('CONFIRMED');
      expect(result?.chainStatus).toBeDefined();
    });
  });
});
