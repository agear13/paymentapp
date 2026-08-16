import { createManualTreasuryLink, ManualReconciliationError } from '@/lib/treasury/reconciliation/manual-link';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    treasury_events: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    treasury_event_links: {
      upsert: jest.fn(),
    },
    treasury_manual_reconciliations: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/treasury/reconciliation/correlation', () => ({
  findDeterministicCorrelation: jest.fn(() => null),
  isWeakCorrelationAttempt: jest.fn(() => false),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');

describe('manual treasury reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.treasury_events.findFirst
      .mockResolvedValueOnce({
        id: 'asset-1',
        organization_id: 'org-1',
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        payment_link_id: 'link-1',
        provider_reference: 'tx:0x1',
        transaction_hash: '0x1',
      })
      .mockResolvedValueOnce({
        id: 'deposit-1',
        organization_id: 'org-1',
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'UNKNOWN',
        payment_link_id: null,
        provider_reference: 'ds:summary:1:object:1',
        transaction_hash: null,
      });
    prisma.treasury_event_links.upsert.mockResolvedValue({ id: 'link-1' });
    prisma.treasury_manual_reconciliations.create.mockResolvedValue({
      id: 'audit-1',
      linked_at: new Date('2026-08-16T10:00:00Z'),
    });
    prisma.treasury_events.update.mockResolvedValue({});
  });

  it('creates auditable manual link when merchant confirms', async () => {
    const result = await createManualTreasuryLink({
      organizationId: 'org-1',
      sourceEventId: 'asset-1',
      targetEventId: 'deposit-1',
      linkedByUserId: 'user-1',
      confirmLink: true,
      notes: 'Confirmed deposit for INV-00485',
    });

    expect(result.linkId).toBe('link-1');
    expect(result.auditId).toBe('audit-1');
    expect(result.manualReconciliation.manual).toBe(true);
    expect(result.manualReconciliation.linkedByUserId).toBe('user-1');
    expect(prisma.treasury_manual_reconciliations.create).toHaveBeenCalled();
  });

  it('requires explicit confirmation', async () => {
    await expect(
      createManualTreasuryLink({
        organizationId: 'org-1',
        sourceEventId: 'asset-1',
        targetEventId: 'deposit-1',
        linkedByUserId: 'user-1',
        confirmLink: false,
      })
    ).rejects.toBeInstanceOf(ManualReconciliationError);
  });

  it('blocks manual links that would confirm bank settlement without bank evidence', async () => {
    prisma.treasury_events.findFirst.mockReset();
    prisma.treasury_events.findFirst
      .mockResolvedValueOnce({
        id: 'withdraw-1',
        organization_id: 'org-1',
        event_type: 'FIAT_CREDIT',
        status: 'CONFIRMED',
        payment_link_id: 'link-1',
        provider_reference: 'ds:w',
        transaction_hash: null,
      })
      .mockResolvedValueOnce({
        id: 'bank-1',
        organization_id: 'org-1',
        event_type: 'BANK_SETTLEMENT',
        status: 'UNKNOWN',
        payment_link_id: 'link-1',
        provider_reference: 'bank:1',
        transaction_hash: null,
      });

    await expect(
      createManualTreasuryLink({
        organizationId: 'org-1',
        sourceEventId: 'withdraw-1',
        targetEventId: 'bank-1',
        linkedByUserId: 'user-1',
        confirmLink: true,
      })
    ).rejects.toThrow(/bank settlement/i);
  });

  it('rejects cross-invoice linking', async () => {
    prisma.treasury_events.findFirst.mockReset();
    prisma.treasury_events.findFirst
      .mockResolvedValueOnce({
        id: 'asset-1',
        organization_id: 'org-1',
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        payment_link_id: 'link-1',
        provider_reference: 'tx:0x1',
        transaction_hash: '0x1',
      })
      .mockResolvedValueOnce({
        id: 'deposit-1',
        organization_id: 'org-1',
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'UNKNOWN',
        payment_link_id: 'link-2',
        provider_reference: 'ds:1',
        transaction_hash: null,
      });

    await expect(
      createManualTreasuryLink({
        organizationId: 'org-1',
        sourceEventId: 'asset-1',
        targetEventId: 'deposit-1',
        linkedByUserId: 'user-1',
        confirmLink: true,
      })
    ).rejects.toThrow(/Cross-invoice/i);
  });
});
