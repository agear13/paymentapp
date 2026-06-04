/**
 * R5: commission artifact reconcile — repair missing obligations/items/lines without duplicating ledger.
 */

import {
  detectCommissionArtifactGaps,
  reconcileCommissionArtifactsForPaymentEvent,
} from '@/lib/referrals/commission-reconcile.server';
import { LedgerEntryService } from '@/lib/ledger/ledger-entry-service';
import { provisionCommissionLedgerAccounts } from '@/lib/ledger/ledger-account-provisioner';
import { orchestrateFundingAfterInvoiceSettlement } from '@/lib/operations/funding/bridge-invoice-settlement.server';
import { resolveReferralCommissionMetadata } from '@/lib/referrals/commission-metadata.server';

const PAYMENT_EVENT_ID = 'pe-11111111-1111-1111-1111-111111111111';
const PAYMENT_LINK_ID = 'pl-22222222-2222-2222-2222-222222222222';
const ORG_ID = 'org-33333333-3333-3333-3333-333333333333';
const REFERRAL_LINK_ID = 'rl-44444444-4444-4444-4444-444444444444';
const SPLIT_ID = '660e8400-e29b-41d4-a716-446655440001';
const OBLIGATION_ID = 'ob-55555555-5555-5555-5555-555555555555';

const snapshotMetadata = {
  referral_link_id: REFERRAL_LINK_ID,
  referral_code: 'DEMO',
  commission_basis: 'GROSS',
  referral_splits: JSON.stringify([
    {
      split_id: SPLIT_ID,
      label: 'Partner 1',
      percentage: 10,
      beneficiary_id: 'user-partner-1',
      sort_order: 0,
    },
  ]),
};

const paymentEventRow = {
  id: PAYMENT_EVENT_ID,
  event_type: 'PAYMENT_CONFIRMED',
  payment_link_id: PAYMENT_LINK_ID,
  pilot_deal_id: 'pilot-deal-1',
  correlation_id: 'corr-r5-test',
  amount_received: 100,
  currency_received: 'AUD',
  metadata: snapshotMetadata,
};

const paymentLinkRow = {
  id: PAYMENT_LINK_ID,
  organization_id: ORG_ID,
  referral_link_id: REFERRAL_LINK_ID,
  commission_attribution_snapshot: snapshotMetadata,
};

const mockLedgerPost = jest.fn().mockResolvedValue({
  success: true,
  entriesPosted: 1,
  totalDebits: '10',
  totalCredits: '10',
  idempotencyKey: 'key',
});

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    payment_events: { findUnique: jest.fn() },
    payment_links: { findUnique: jest.fn() },
    commission_obligations: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    commission_obligation_items: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    commission_obligation_lines: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    ledger_entries: { count: jest.fn() },
    referral_links: { findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/ledger/ledger-entry-service', () => ({
  LedgerEntryService: jest.fn().mockImplementation(() => ({
    postJournalEntries: mockLedgerPost,
  })),
}));

jest.mock('@/lib/ledger/ledger-account-provisioner', () => ({
  provisionCommissionLedgerAccounts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/operations/funding/bridge-invoice-settlement.server', () => ({
  orchestrateFundingAfterInvoiceSettlement: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/referrals/commission-metadata.server', () => ({
  resolveReferralCommissionMetadata: jest.fn(),
}));

const prismaMock = jest.requireMock('@/lib/server/prisma').prisma;
const resolveMetadataMock = resolveReferralCommissionMetadata as jest.Mock;

function setupBaseMocks() {
  prismaMock.payment_events.findUnique.mockResolvedValue(paymentEventRow);
  prismaMock.payment_links.findUnique.mockResolvedValue(paymentLinkRow);
  prismaMock.ledger_entries.count.mockResolvedValue(0);
  resolveMetadataMock.mockResolvedValue(snapshotMetadata);
}

describe('commission reconcile (R5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupBaseMocks();
    mockLedgerPost.mockResolvedValue({
      success: true,
      entriesPosted: 1,
      totalDebits: '10',
      totalCredits: '10',
      idempotencyKey: 'key',
    });
  });

  it('detects missing obligation and items when settlement exists', async () => {
    prismaMock.commission_obligations.findUnique.mockResolvedValue(null);

    const gaps = await detectCommissionArtifactGaps(PAYMENT_EVENT_ID, {
      grossAmount: 100,
      currency: 'AUD',
    });

    expect(gaps).toContain('NO_COMMISSION_OBLIGATIONS_ROW');
    expect(gaps).toContain('NO_COMMISSION_OBLIGATION_ITEMS');
  });

  it('repairs missing obligation and items without duplicate ledger when ledger already posted', async () => {
    prismaMock.commission_obligations.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.ledger_entries.count.mockResolvedValue(1);
    prismaMock.commission_obligations.create.mockResolvedValue({
      id: OBLIGATION_ID,
      stripe_event_id: PAYMENT_EVENT_ID,
    });
    prismaMock.commission_obligation_items.findFirst.mockResolvedValue(null);
    prismaMock.commission_obligation_items.create.mockResolvedValue({ id: 'item-1' });
    prismaMock.commission_obligation_lines.findFirst.mockResolvedValue(null);
    prismaMock.commission_obligation_lines.create.mockResolvedValue({ id: 'line-1' });

    prismaMock.commission_obligations.findUnique.mockImplementation(async (args: { where: { stripe_event_id?: string } }) => {
      if (args?.where?.stripe_event_id === PAYMENT_EVENT_ID) {
        return {
          id: OBLIGATION_ID,
          obligation_items: [{ split_id: SPLIT_ID }],
          obligation_lines: [{ id: 'line-1' }],
        };
      }
      return null;
    });

    const result = await reconcileCommissionArtifactsForPaymentEvent(PAYMENT_EVENT_ID, {
      grossAmount: 100,
      currency: 'AUD',
      correlationId: 'corr-r5-test',
    });

    expect(result.status).toBe('repaired');
    expect(result.actions).toContain('obligation_created');
    expect(result.actions).toContain('items_created');
    expect(mockLedgerPost).not.toHaveBeenCalled();
    expect(prismaMock.commission_obligations.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.commission_obligation_items.create).toHaveBeenCalledTimes(1);
  });

  it('repairs missing items when obligation exists (P2002 / R13 scenario)', async () => {
    prismaMock.ledger_entries.count.mockResolvedValue(1);
    const items: { split_id: string }[] = [];
    const lines: { id: string }[] = [];
    prismaMock.commission_obligations.findUnique.mockImplementation(async () => ({
      id: OBLIGATION_ID,
      obligation_items: items,
      obligation_lines: lines,
    }));
    prismaMock.commission_obligation_items.findFirst.mockResolvedValue(null);
    prismaMock.commission_obligation_items.create.mockImplementation(async () => {
      items.push({ split_id: SPLIT_ID });
      return { id: 'item-1' };
    });
    prismaMock.commission_obligation_lines.findFirst.mockResolvedValue(null);
    prismaMock.commission_obligation_lines.create.mockImplementation(async () => {
      lines.push({ id: 'line-1' });
      return { id: 'line-1' };
    });

    const result = await reconcileCommissionArtifactsForPaymentEvent(PAYMENT_EVENT_ID, {
      grossAmount: 100,
      currency: 'AUD',
    });

    expect(result.status).toBe('repaired');
    expect(result.actions).toContain('obligation_exists');
    expect(result.actions).toContain('items_created');
    expect(prismaMock.commission_obligations.create).not.toHaveBeenCalled();
    expect(prismaMock.commission_obligation_items.create).toHaveBeenCalledTimes(1);
  });

  it('repairs missing lines when obligation exists', async () => {
    prismaMock.ledger_entries.count.mockResolvedValue(1);
    const lines: { id: string }[] = [];
    prismaMock.commission_obligations.findUnique.mockImplementation(async () => ({
      id: OBLIGATION_ID,
      obligation_items: [{ split_id: SPLIT_ID }],
      obligation_lines: lines,
    }));
    prismaMock.commission_obligation_items.findFirst.mockResolvedValue({ id: 'item-1', status: 'POSTED' });
    prismaMock.commission_obligation_lines.findFirst.mockResolvedValue(null);
    prismaMock.commission_obligation_lines.create.mockImplementation(async () => {
      lines.push({ id: 'line-1' });
      return { id: 'line-1' };
    });

    const result = await reconcileCommissionArtifactsForPaymentEvent(PAYMENT_EVENT_ID, {
      grossAmount: 100,
      currency: 'AUD',
    });

    expect(result.actions).toContain('lines_created');
    expect(prismaMock.commission_obligation_lines.create).toHaveBeenCalledTimes(1);
  });

  it('skips when all artifacts already exist (complete state)', async () => {
    prismaMock.ledger_entries.count.mockResolvedValue(1);
    prismaMock.commission_obligations.findUnique.mockResolvedValue({
      id: OBLIGATION_ID,
      obligation_items: [{ split_id: SPLIT_ID }],
      obligation_lines: [{ id: 'line-1' }],
    });

    const result = await reconcileCommissionArtifactsForPaymentEvent(PAYMENT_EVENT_ID, {
      grossAmount: 100,
      currency: 'AUD',
    });

    expect(result.status).toBe('complete');
    expect(result.actions).not.toContain('obligation_created');
    expect(result.actions).not.toContain('items_created');
    expect(mockLedgerPost).not.toHaveBeenCalled();
    expect(prismaMock.commission_obligations.create).not.toHaveBeenCalled();
    expect(prismaMock.commission_obligation_items.create).not.toHaveBeenCalled();
  });

  it('duplicate reconcile execution is idempotent', async () => {
    prismaMock.ledger_entries.count.mockResolvedValue(1);
    prismaMock.commission_obligations.findUnique.mockResolvedValue({
      id: OBLIGATION_ID,
      obligation_items: [{ split_id: SPLIT_ID }],
      obligation_lines: [{ id: 'line-1' }],
    });

    const first = await reconcileCommissionArtifactsForPaymentEvent(PAYMENT_EVENT_ID, {
      grossAmount: 100,
      currency: 'AUD',
    });
    const second = await reconcileCommissionArtifactsForPaymentEvent(PAYMENT_EVENT_ID, {
      grossAmount: 100,
      currency: 'AUD',
    });

    expect(first.status).toBe('complete');
    expect(second.status).toBe('complete');
    expect(prismaMock.commission_obligations.create).not.toHaveBeenCalled();
    expect(prismaMock.commission_obligation_items.create).not.toHaveBeenCalled();
    expect(mockLedgerPost).not.toHaveBeenCalled();
  });

  it('posts missing ledger then obligation on full gap repair', async () => {
    const items: { split_id: string }[] = [];
    const lines: { id: string }[] = [];
    let obligationCreated = false;
    prismaMock.commission_obligations.findUnique.mockImplementation(async () => {
      if (!obligationCreated) return null;
      return {
        id: OBLIGATION_ID,
        obligation_items: items,
        obligation_lines: lines,
      };
    });
    prismaMock.commission_obligations.create.mockImplementation(async () => {
      obligationCreated = true;
      return { id: OBLIGATION_ID };
    });
    prismaMock.commission_obligation_items.findFirst.mockResolvedValue(null);
    prismaMock.commission_obligation_items.create.mockImplementation(async () => {
      items.push({ split_id: SPLIT_ID });
      return { id: 'item-1' };
    });
    prismaMock.commission_obligation_lines.findFirst.mockResolvedValue(null);
    prismaMock.commission_obligation_lines.create.mockImplementation(async () => {
      lines.push({ id: 'line-1' });
      return { id: 'line-1' };
    });
    prismaMock.ledger_entries.count.mockImplementation(async () => {
      return mockLedgerPost.mock.calls.length > 0 ? 1 : 0;
    });

    const result = await reconcileCommissionArtifactsForPaymentEvent(PAYMENT_EVENT_ID, {
      grossAmount: 100,
      currency: 'AUD',
    });

    expect(result.status).toBe('repaired');
    expect(result.actions).toContain('ledger_posted');
    expect(mockLedgerPost).toHaveBeenCalledTimes(1);
    const postArgs = mockLedgerPost.mock.calls[0][0];
    expect(postArgs.idempotencyKey).toBe(
      `commission-${PAYMENT_EVENT_ID}-split-${SPLIT_ID}`
    );
  });

  it('orchestrates funding on repair when pilot deal is linked', async () => {
    prismaMock.ledger_entries.count.mockResolvedValue(1);
    const items: { split_id: string }[] = [];
    const lines: { id: string }[] = [];
    prismaMock.commission_obligations.findUnique.mockImplementation(async () => ({
      id: OBLIGATION_ID,
      obligation_items: items,
      obligation_lines: lines,
    }));
    prismaMock.commission_obligation_items.findFirst.mockResolvedValue(null);
    prismaMock.commission_obligation_items.create.mockImplementation(async () => {
      items.push({ split_id: SPLIT_ID });
      return { id: 'item-1' };
    });
    prismaMock.commission_obligation_lines.findFirst.mockResolvedValue(null);
    prismaMock.commission_obligation_lines.create.mockImplementation(async () => {
      lines.push({ id: 'line-1' });
      return { id: 'line-1' };
    });

    await reconcileCommissionArtifactsForPaymentEvent(PAYMENT_EVENT_ID, {
      grossAmount: 100,
      currency: 'AUD',
      orchestrateFunding: true,
    });

    expect(orchestrateFundingAfterInvoiceSettlement).toHaveBeenCalledWith(PAYMENT_EVENT_ID);
  });
});

describe('confirmPayment R5 integration (contract)', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'lib', 'services', 'payment-confirmation.ts'),
    'utf-8'
  );

  it('invokes reconcile on alreadyProcessed path instead of re-running applyRevenueShareSplits', () => {
    expect(source).toContain('runCommissionReconcileAfterSettlement');
    expect(source).toContain('reconcileCommissionArtifactsForPaymentEvent');
    expect(source).toContain('commission_block_skipped_idempotent');
    const reconcileAfterSkip = source.indexOf('commission_block_skipped_idempotent');
    const reconcileCall = source.indexOf('runCommissionReconcileAfterSettlement', reconcileAfterSkip);
    expect(reconcileCall).toBeGreaterThan(reconcileAfterSkip);
  });

  it('invokes reconcile on provider idempotency early return', () => {
    expect(source).toContain('Payment already processed (idempotent)');
    expect(source).toMatch(
      /idempotencyCheck\.eventId[\s\S]*runCommissionReconcileAfterSettlement/
    );
  });
});
