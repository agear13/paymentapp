import type { PayoutStatus } from '@prisma/client';
import type { CanonicalPayoutInstruction } from '@/lib/payouts/rails/types';

type PayoutRow = {
  id: string;
  organization_id: string;
  batch_id: string;
  user_id: string;
  status: PayoutStatus;
  rail_id: string;
  destination_kind: 'WALLET';
  idempotency_key: string;
  external_reference: string | null;
  paid_at: Date | null;
  failed_reason: string | null;
  provider_payload: unknown;
  net_amount: { toString: () => string };
  currency: string;
  payout_method_id: string | null;
  payout_methods: {
    id: string;
    method_type: 'CRYPTO';
    handle: string;
    details: Record<string, unknown>;
  };
};

const mockSubmit = jest.fn();
const mockSyncStatus = jest.fn();

jest.mock('@/lib/audit/audit-log', () => ({
  AuditEventType: {
    PAYOUT_CREATED: 'payout.created',
    PAYOUT_APPROVED: 'payout.approved',
    PAYOUT_PAID: 'payout.paid',
    PAYOUT_FAILED: 'payout.failed',
  },
  AuditSeverity: { INFO: 'INFO', WARNING: 'WARNING' },
  createAuditLog: jest.fn(async () => undefined),
}));

jest.mock('@/lib/payouts/rails/adapters', () => ({
  getPayoutRailAdapter: () => ({
    railId: 'cregis',
    submit: (...args: unknown[]) => mockSubmit(...args),
    syncStatus: (...args: unknown[]) => mockSyncStatus(...args),
  }),
}));

jest.mock('@/lib/server/prisma', () => {
  const payouts = new Map<string, PayoutRow>();
  const lines = new Map<string, { payout_id: string | null; status: string; paid_at: Date | null }>();
  const items = new Map<string, { payout_id: string | null; status: string; paid_at: Date | null }>();
  const batches = new Map<string, { id: string; organization_id: string; status: string }>();

  const mockTx = {
    payouts: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; idempotency_key?: string } }) => {
        if (where.id) return payouts.get(where.id) ?? null;
        if (where.idempotency_key) {
          return [...payouts.values()].find((row) => row.idempotency_key === where.idempotency_key) ?? null;
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = payouts.get(where.id);
        if (!row) throw new Error('missing payout');
        Object.assign(row, data);
        return row;
      }),
      count: jest.fn(async () =>
        [...payouts.values()].filter((row) => row.status !== 'PAID' && row.status !== 'FAILED').length
      ),
    },
    payout_batches: {
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const batch = batches.get(where.id);
        if (batch) Object.assign(batch, data);
        return batch;
      }),
    },
    commission_obligation_lines: {
      updateMany: jest.fn(async ({ where, data }: { where: { payout_id: string }; data: Record<string, unknown> }) => {
        for (const [id, line] of lines) {
          if (line.payout_id === where.payout_id) lines.set(id, { ...line, ...data } as typeof line);
        }
        return { count: 1 };
      }),
    },
    commission_obligation_items: {
      updateMany: jest.fn(async ({ where, data }: { where: { payout_id: string }; data: Record<string, unknown> }) => {
        for (const [id, item] of items) {
          if (item.payout_id === where.payout_id) items.set(id, { ...item, ...data } as typeof item);
        }
        return { count: 1 };
      }),
    },
    deal_network_pilot_participants: { findUnique: jest.fn(async () => null), update: jest.fn() },
    deal_network_pilot_obligations: { updateMany: jest.fn() },
  };

  return {
    prisma: {
      $transaction: async (fn: (inner: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      payouts: mockTx.payouts,
      payout_batches: mockTx.payout_batches,
      __test: { payouts, lines, items, batches },
    },
  };
});

import { prisma } from '@/lib/server/prisma';
import { executePayoutRelease } from '@/lib/payouts/execute-payout-release.server';

const mockStore = (
  prisma as unknown as {
    __test: {
      payouts: Map<string, PayoutRow>;
      lines: Map<string, { payout_id: string | null; status: string; paid_at: Date | null }>;
      items: Map<string, { payout_id: string | null; status: string; paid_at: Date | null }>;
      batches: Map<string, { id: string; organization_id: string; status: string }>;
    };
  }
).__test;

function seed(status: PayoutStatus = 'SUBMITTED') {
  mockStore.payouts.clear();
  mockStore.lines.clear();
  mockStore.items.clear();
  mockStore.batches.clear();
  mockStore.batches.set('batch-1', { id: 'batch-1', organization_id: 'org-1', status: 'SUBMITTED' });
  mockStore.payouts.set('payout-1', {
    id: 'payout-1',
    organization_id: 'org-1',
    batch_id: 'batch-1',
    user_id: 'payee-1',
    status,
    rail_id: 'cregis',
    destination_kind: 'WALLET',
    idempotency_key: 'payout:org-1:payout-1',
    external_reference: status === 'PROCESSING' ? 'cregis:99' : null,
    paid_at: status === 'PAID' ? new Date() : null,
    failed_reason: null,
    provider_payload: null,
    net_amount: { toString: () => '25' },
    currency: 'USD',
    payout_method_id: 'method-1',
    payout_methods: {
      id: 'method-1',
      method_type: 'CRYPTO',
      handle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      details: { asset: 'USDT', network: 'tron' },
    },
  });
  mockStore.lines.set('line-1', { payout_id: 'payout-1', status: 'POSTED', paid_at: null });
  mockStore.items.set('item-1', { payout_id: 'payout-1', status: 'POSTED', paid_at: null });
  mockSubmit.mockReset();
  mockSyncStatus.mockReset();
}

describe('Cregis adapter → executePayoutRelease()', () => {
  it('is the only path that mutates canonical payout state after submit', async () => {
    seed('SUBMITTED');
    mockSubmit.mockResolvedValue({
      providerReference: 'cregis:42',
      status: 'PROCESSING',
      providerPayload: { cid: 42 },
    });

    const result = await executePayoutRelease({
      type: 'execute',
      payoutId: 'payout-1',
      actor: { userId: 'op-1', organizationId: 'org-1' },
    });

    expect(result.statuses).toEqual(['PROCESSING']);
    expect(mockStore.payouts.get('payout-1')?.external_reference).toBe('cregis:42');
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    const submitted = mockSubmit.mock.calls[0][0] as CanonicalPayoutInstruction;
    expect(submitted.idempotencyKey).toBe('payout:org-1:payout-1');
    expect(submitted.destination.details).toEqual({ asset: 'USDT', network: 'tron' });
  });

  it('applies a later PAID sync and then ignores a stale PROCESSING event', async () => {
    seed('PROCESSING');
    mockSyncStatus.mockResolvedValue({
      providerReference: 'cregis:99',
      status: 'PAID',
      providerPayload: { status: 6 },
    });

    await executePayoutRelease({ type: 'sync', payoutId: 'payout-1' });
    expect(mockStore.payouts.get('payout-1')?.status).toBe('PAID');
    expect(mockStore.lines.get('line-1')?.status).toBe('PAID');

    const stale = await executePayoutRelease({
      type: 'apply_event',
      event: {
        payoutId: 'payout-1',
        providerReference: 'cregis:99',
        status: 'PROCESSING',
      },
    });
    expect(stale.statuses).toEqual(['PAID']);
    expect(mockStore.payouts.get('payout-1')?.status).toBe('PAID');
  });

  it('does not treat execute as a fake success when the adapter has not been called', async () => {
    seed('SUBMITTED');
    mockSubmit.mockRejectedValue(new Error('network'));
    await expect(
      executePayoutRelease({
        type: 'execute',
        payoutId: 'payout-1',
        actor: { organizationId: 'org-1' },
      })
    ).rejects.toThrow('network');
    expect(mockStore.payouts.get('payout-1')?.status).toBe('SUBMITTED');
    expect(mockStore.lines.get('line-1')?.status).toBe('POSTED');
  });
});
