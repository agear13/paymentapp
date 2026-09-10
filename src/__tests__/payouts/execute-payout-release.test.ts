import fs from 'node:fs';
import path from 'node:path';
import type { PayoutStatus } from '@prisma/client';
import { canTransitionPayoutStatus } from '@/lib/payouts/payout-status-transitions';


type PayoutRow = {
  id: string;
  organization_id: string;
  batch_id: string;
  user_id: string;
  status: PayoutStatus;
  rail_id: string;
  destination_kind: 'WALLET' | 'BANK_ACCOUNT' | 'PLATFORM_HANDLE' | null;
  idempotency_key: string;
  external_reference: string | null;
  paid_at: Date | null;
  failed_reason: string | null;
  provider_payload: unknown;
  net_amount: { toString: () => string };
  currency: string;
  payout_method_id: string | null;
};

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

jest.mock('@/lib/server/prisma', () => {
  const payouts = new Map<string, PayoutRow>();
  const lines = new Map<string, { payout_id: string | null; status: string; paid_at: Date | null }>();
  const items = new Map<string, { payout_id: string | null; status: string; paid_at: Date | null }>();
  const batches = new Map<
    string,
    { id: string; organization_id: string; status: string; submitted_at: Date | null; completed_at: Date | null }
  >();

  const mockTx = {
    payouts: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; idempotency_key?: string } }) => {
        if (where.id) return payouts.get(where.id) ?? null;
        if (where.idempotency_key) {
          return [...payouts.values()].find((row) => row.idempotency_key === where.idempotency_key) ?? null;
        }
        return null;
      }),
      findFirst: jest.fn(async ({ where }: { where: { external_reference?: string } }) => {
        if (!where.external_reference) return null;
        return [...payouts.values()].find((row) => row.external_reference === where.external_reference) ?? null;
      }),
      findMany: jest.fn(async ({ where }: { where: { batch_id: string } }) =>
        [...payouts.values()].filter((row) => row.batch_id === where.batch_id)
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = payouts.get(where.id);
        if (!row) throw new Error('missing payout');
        Object.assign(row, data);
        return row;
      }),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { batch_id: string; status?: string };
          data: Record<string, unknown>;
        }) => {
          for (const row of payouts.values()) {
            if (row.batch_id !== where.batch_id) continue;
            if (where.status && row.status !== where.status) continue;
            Object.assign(row, data);
          }
          return { count: 1 };
        }
      ),
      count: jest.fn(
        async ({ where }: { where: { batch_id: string; status: { notIn: string[] } } }) =>
          [...payouts.values()].filter(
            (row) => row.batch_id === where.batch_id && !where.status.notIn.includes(row.status)
          ).length
      ),
    },
    payout_batches: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const batch = batches.get(where.id);
        if (!batch) return null;
        return {
          ...batch,
          payouts: [...payouts.values()].filter((row) => row.batch_id === batch.id),
        };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const batch = batches.get(where.id);
        if (!batch) throw new Error('missing batch');
        Object.assign(batch, data);
        return batch;
      }),
    },
    commission_obligation_lines: {
      updateMany: jest.fn(
        async ({ where, data }: { where: { payout_id: string }; data: Record<string, unknown> }) => {
          for (const [id, line] of lines) {
            if (line.payout_id === where.payout_id) {
              lines.set(id, { ...line, ...data } as typeof line);
            }
          }
          return { count: 1 };
        }
      ),
    },
    commission_obligation_items: {
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { payout_id: string; status?: { not: string } };
          data: Record<string, unknown>;
        }) => {
          for (const [id, item] of items) {
            if (item.payout_id !== where.payout_id) continue;
            if (where.status?.not && item.status === where.status.not) continue;
            items.set(id, { ...item, ...data } as typeof item);
          }
          return { count: 1 };
        }
      ),
    },
    deal_network_pilot_participants: {
      findUnique: jest.fn(async () => null),
      update: jest.fn(),
    },
    deal_network_pilot_obligations: {
      updateMany: jest.fn(),
    },
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
import { buildManualFailedEvent, buildManualPaidEvent } from '@/lib/payouts/rails/manual.adapter';

const mockStore = (
  prisma as unknown as {
    __test: {
      payouts: Map<string, PayoutRow>;
      lines: Map<string, { payout_id: string | null; status: string; paid_at: Date | null }>;
      items: Map<string, { payout_id: string | null; status: string; paid_at: Date | null }>;
      batches: Map<
        string,
        { id: string; organization_id: string; status: string; submitted_at: Date | null; completed_at: Date | null }
      >;
    };
  }
).__test;

function seedPayout(status: PayoutStatus = 'SUBMITTED') {
  mockStore.payouts.clear();
  mockStore.lines.clear();
  mockStore.items.clear();
  mockStore.batches.clear();
  mockStore.batches.set('batch-1', {
    id: 'batch-1',
    organization_id: 'org-1',
    status: status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED',
    submitted_at: null,
    completed_at: null,
  });
  mockStore.payouts.set('payout-1', {
    id: 'payout-1',
    organization_id: 'org-1',
    batch_id: 'batch-1',
    user_id: 'rachel',
    status,
    rail_id: 'manual',
    destination_kind: 'BANK_ACCOUNT',
    idempotency_key: 'payout:org-1:payout-1',
    external_reference: null,
    paid_at: null,
    failed_reason: null,
    provider_payload: null,
    net_amount: { toString: () => '500' },
    currency: 'USD',
    payout_method_id: 'method-1',
  });
  mockStore.lines.set('line-1', { payout_id: 'payout-1', status: 'POSTED', paid_at: null });
  mockStore.items.set('item-1', { payout_id: 'payout-1', status: 'POSTED', paid_at: null });
}

describe('executePayoutRelease', () => {
  it('submits a draft Cregis-stamped batch to SUBMITTED without calling a provider', async () => {
    seedPayout('DRAFT');
    mockStore.payouts.get('payout-1')!.rail_id = 'cregis';
    mockStore.payouts.get('payout-1')!.destination_kind = 'WALLET';
    const result = await executePayoutRelease({
      type: 'submit_batch',
      batchId: 'batch-1',
      actor: { userId: 'op-1', organizationId: 'org-1' },
    });
    expect(result.batchStatus).toBe('SUBMITTED');
    expect(mockStore.payouts.get('payout-1')?.status).toBe('SUBMITTED');
    expect(mockStore.payouts.get('payout-1')?.rail_id).toBe('cregis');
    expect(mockStore.payouts.get('payout-1')?.external_reference).toBeNull();
  });

  it('does not call a payout adapter while submitting a batch', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/payouts/execute-payout-release.server.ts'),
      'utf8'
    );
    const submitFn = source.slice(
      source.indexOf('async function submitBatchInTx'),
      source.indexOf('async function executePayoutOnRail')
    );
    expect(submitFn).toContain("data: { status: 'SUBMITTED'");
    expect(submitFn).not.toContain('getPayoutRailAdapter');
    expect(submitFn).not.toContain('/api/v2/payout');
  });

  it('marks manual payouts PAID, pays obligation rows, and completes the batch', async () => {
    seedPayout('SUBMITTED');
    const result = await executePayoutRelease({
      type: 'apply_event',
      event: buildManualPaidEvent({
        payoutId: 'payout-1',
        externalReference: 'wire-123',
      }),
    });
    expect(result.statuses).toEqual(['PAID']);
    expect(mockStore.payouts.get('payout-1')?.external_reference).toBe('wire-123');
    expect(mockStore.lines.get('line-1')?.status).toBe('PAID');
    expect(mockStore.items.get('item-1')?.status).toBe('PAID');
    expect(mockStore.batches.get('batch-1')?.status).toBe('COMPLETED');
  });

  it('is idempotent when already PAID', async () => {
    seedPayout('PAID');
    mockStore.payouts.get('payout-1')!.external_reference = 'wire-123';
    const result = await executePayoutRelease({
      type: 'apply_event',
      event: buildManualPaidEvent({
        payoutId: 'payout-1',
        externalReference: 'wire-999',
      }),
    });
    expect(result.statuses).toEqual(['PAID']);
    expect(mockStore.payouts.get('payout-1')?.external_reference).toBe('wire-123');
  });

  it('unassigns obligation lines on FAILED so they can be re-batched', async () => {
    seedPayout('PROCESSING');
    await executePayoutRelease({
      type: 'apply_event',
      event: buildManualFailedEvent({
        payoutId: 'payout-1',
        failedReason: 'bank rejected',
      }),
    });
    expect(mockStore.payouts.get('payout-1')?.status).toBe('FAILED');
    expect(mockStore.lines.get('line-1')).toEqual({
      payout_id: null,
      status: 'POSTED',
      paid_at: null,
    });
    expect(mockStore.items.get('item-1')?.payout_id).toBeNull();
    expect(mockStore.batches.get('batch-1')?.status).toBe('COMPLETED');
  });

  it('ignores stale events instead of moving PAID backwards', async () => {
    seedPayout('PAID');
    mockStore.payouts.get('payout-1')!.external_reference = 'cregis:1';
    const result = await executePayoutRelease({
      type: 'apply_event',
      event: {
        payoutId: 'payout-1',
        providerReference: 'cregis:1',
        status: 'PROCESSING',
      },
    });
    expect(result.statuses).toEqual(['PAID']);
    expect(mockStore.payouts.get('payout-1')?.status).toBe('PAID');
    expect(canTransitionPayoutStatus('PAID', 'FAILED')).toBe(false);
    expect(canTransitionPayoutStatus('PAID', 'PROCESSING')).toBe(false);
  });
});

describe('Hedera payout routes no longer own the SDK', () => {
  it('moves Hashgraph SDK usage into the Hedera adapter', () => {
    const prepare = fs.readFileSync(
      path.join(process.cwd(), 'app/api/payout-batches/[id]/hedera/prepare/route.ts'),
      'utf8'
    );
    const confirm = fs.readFileSync(
      path.join(process.cwd(), 'app/api/payout-batches/[id]/hedera/confirm/route.ts'),
      'utf8'
    );
    expect(prepare).not.toContain('@hashgraph/sdk');
    expect(confirm).not.toContain('@hashgraph/sdk');
    expect(prepare).toContain('executePayoutRelease');
    expect(confirm).toContain('executePayoutRelease');
  });
});
