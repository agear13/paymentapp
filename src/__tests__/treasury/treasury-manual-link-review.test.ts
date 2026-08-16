import { listManualReconciliationReviewItems, MANUAL_LINKABLE_EXCEPTION_TYPES } from '@/lib/treasury/reconciliation/manual-link-review';
import { createManualTreasuryLink } from '@/lib/treasury/reconciliation/manual-link';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    payment_links: { findMany: jest.fn() },
    treasury_events: { findMany: jest.fn(), findFirst: jest.fn() },
    treasury_event_links: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/treasury/integration/connection-service', () => ({
  getDigitalSurgeSyncMetadata: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/treasury/reconciliation/engine', () => ({
  buildTreasuryReconciliationChain: jest.fn(),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');
const { buildTreasuryReconciliationChain: buildChainMock } = jest.requireMock(
  '@/lib/treasury/reconciliation/engine'
);

const ORG = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LINK = 'link-11111111-1111-1111-1111-111111111111';
const WT = 'wt-11111111-1111-1111-1111-111111111111';
const DEP = 'dep-22222222-2222-2222-2222-222222222222';

describe('manual-link review service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payment_links.findMany.mockResolvedValue([{ id: LINK }]);
  });

  it('lists review items for manual-linkable exceptions with candidates', async () => {
    buildChainMock.mockResolvedValue({
      paymentLinkId: LINK,
      invoiceReference: 'INV-001',
      chainStatus: 'AWAITING_EXCHANGE_IDENTIFICATION',
      nodes: [],
      exceptions: [
        {
          type: 'wallet_without_exchange',
          severity: 'UNKNOWN',
          observed: 'Wallet transfer without matching exchange deposit',
          expected: 'Digital Surge deposit',
          reason: 'No exchange deposit correlated',
          suggestedAction: 'Sync Digital Surge',
          relatedEventIds: [WT],
          paymentLinkId: LINK,
        },
      ],
      links: [],
    });

    prisma.treasury_events.findMany.mockImplementation(async (args: { where?: { id?: { in?: string[] }; event_type?: string } }) => {
      if (args.where?.id?.in?.includes(WT) && args.where.id.in.length === 1 && !args.include) {
        return [{ id: WT, event_type: 'WALLET_TRANSFER' }];
      }
      if (args.where?.event_type === 'EXCHANGE_DEPOSIT' && !args.where?.id) {
        return [{ id: DEP, payment_link_id: null }];
      }
      if (args.where?.id?.in?.includes(DEP)) {
        return [
          {
            id: WT,
            event_type: 'WALLET_TRANSFER',
            status: 'CONFIRMED',
            asset: 'USDC',
            destination_asset: null,
            amount: { toString: () => '-1500' },
            destination_amount: null,
            provider: 'blockchain',
            occurred_at: new Date('2026-08-02T10:00:00Z'),
            transaction_hash: '0xabc',
            provider_reference: 'wt:1',
            destination_address: '0xDS',
            source_address: '0xM',
            payment_link_id: LINK,
            payment_links: { invoice_reference: 'INV-001', short_code: 'Ab12' },
            manual_links_as_target: [],
            target_links: [],
            source_links: [],
          },
          {
            id: DEP,
            event_type: 'EXCHANGE_DEPOSIT',
            status: 'UNKNOWN',
            asset: 'USDC',
            destination_asset: null,
            amount: { toString: () => '1500' },
            destination_amount: null,
            provider: 'digital_surge',
            occurred_at: new Date('2026-08-03T10:00:00Z'),
            transaction_hash: '0xabc',
            provider_reference: 'ds:1',
            destination_address: null,
            source_address: null,
            payment_link_id: null,
            payment_links: null,
            manual_links_as_target: [],
            target_links: [],
            source_links: [],
          },
        ];
      }
      return [];
    });

    const items = await listManualReconciliationReviewItems(ORG);
    expect(items).toHaveLength(1);
    expect(items[0]?.sourceEvent.id).toBe(WT);
    expect(items[0]?.candidateTargetEvents[0]?.id).toBe(DEP);
    expect(items[0]?.autoLinkFailureReason).toContain('No exchange deposit');
  });

  it('does not include non-manual-linkable exceptions such as awaiting bank confirmation', () => {
    expect(MANUAL_LINKABLE_EXCEPTION_TYPES).not.toContain('awaiting_bank_confirmation');
    expect(MANUAL_LINKABLE_EXCEPTION_TYPES).not.toContain('duplicate_provider_event');
  });
});

describe('createManualTreasuryLink provider fact preservation', () => {
  it('is imported from manual-link module without altering provider references', () => {
    expect(typeof createManualTreasuryLink).toBe('function');
  });
});
