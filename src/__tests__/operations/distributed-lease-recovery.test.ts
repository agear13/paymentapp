/**
 * Distributed job lease — crash recovery, takeover, overlap.
 * Uses jest.resetModules + jest.doMock so @/ imports in job-lease resolve to the same mocked prisma.
 */

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

type LeaseRow = {
  job_name: string;
  owner_id: string;
  lease_expires_at: Date;
};

const leaseStore = { rows: new Map<string, LeaseRow>() };

let opChain: Promise<unknown> = Promise.resolve();

function runLeaseOp<T>(fn: () => Promise<T>): Promise<T> {
  const done = opChain.then(() => fn());
  opChain = done.then(
    () => undefined,
    () => undefined
  );
  return done;
}

function updateMatchesOrBranch(
  row: LeaseRow,
  where: {
    job_name: string;
    OR: Array<{ lease_expires_at: { lt: Date } } | { owner_id: string }>;
  }
): boolean {
  if (row.job_name !== where.job_name) {
    return false;
  }
  for (const clause of where.OR) {
    if ('lease_expires_at' in clause && clause.lease_expires_at?.lt) {
      if (row.lease_expires_at.getTime() < clause.lease_expires_at.lt.getTime()) {
        return true;
      }
    }
    if ('owner_id' in clause && clause.owner_id === row.owner_id) {
      return true;
    }
  }
  return false;
}

function buildLeasePrismaMock() {
  return {
    prisma: {
      operational_job_leases: {
        create: jest.fn(({ data }: { data: LeaseRow }) =>
          runLeaseOp(async () => {
            if (leaseStore.rows.has(data.job_name)) {
              const err = new Error('Unique constraint failed');
              (err as NodeJS.ErrnoException & { code?: string }).code = 'P2002';
              throw err;
            }
            leaseStore.rows.set(data.job_name, { ...data });
          })
        ),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: {
              job_name: string;
              owner_id?: string;
              OR?: Array<
                | { lease_expires_at: { lt: Date } }
                | { owner_id: string }
              >;
            };
            data: { owner_id?: string; lease_expires_at: Date };
          }) =>
            runLeaseOp(async () => {
              const row = leaseStore.rows.get(where.job_name);
              if (!row) {
                return { count: 0 };
              }

              if (where.OR && Array.isArray(where.OR)) {
                if (!updateMatchesOrBranch(row, where as Parameters<typeof updateMatchesOrBranch>[1])) {
                  return { count: 0 };
                }
                leaseStore.rows.set(where.job_name, {
                  ...row,
                  ...(data.owner_id != null ? { owner_id: data.owner_id } : {}),
                  lease_expires_at: data.lease_expires_at,
                });
                return { count: 1 };
              }

              if (where.owner_id != null) {
                if (row.owner_id !== where.owner_id) {
                  return { count: 0 };
                }
                row.lease_expires_at = data.lease_expires_at;
                return { count: 1 };
              }

              return { count: 0 };
            })
        ),
        findUnique: jest.fn(({ where }: { where: { job_name: string } }) =>
          runLeaseOp(async () => leaseStore.rows.get(where.job_name) ?? null)
        ),
      },
    },
  };
}

function registerLeaseMocks() {
  const factory = () => buildLeasePrismaMock();
  jest.doMock('@/lib/server/prisma', factory);
  jest.doMock('@/lib/xero/sync-orchestration', () => ({
    syncInvoiceToXero: jest.fn(async () => ({ success: true, invoiceId: 'inv-1' })),
    syncPaymentToXero: jest.fn(async () => ({
      success: true,
      paymentId: 'xero-pay-1',
    })),
  }));
  jest.doMock('@/lib/xero/queue-service', () => ({
    __esModule: true,
    getPendingSyncJobs: jest.fn(),
    getProcessableSyncJobById: jest.fn(),
    markSyncInProgress: jest.fn(async () => {}),
    markSyncSuccess: jest.fn(async () => {}),
    markSyncFailed: jest.fn(async () => {}),
  }));
}

let acquireJobLease: typeof import('@/lib/jobs/job-lease').acquireJobLease;
let releaseJobLease: typeof import('@/lib/jobs/job-lease').releaseJobLease;
let executeLeasedJob: typeof import('@/lib/jobs/job-scheduler').executeLeasedJob;
let processQueue: typeof import('@/lib/xero/queue-processor').processQueue;
let getPendingSyncJobs: typeof import('@/lib/xero/queue-service').getPendingSyncJobs;
let markSyncSuccess: typeof import('@/lib/xero/queue-service').markSyncSuccess;
let syncPaymentToXero: typeof import('@/lib/xero/sync-orchestration').syncPaymentToXero;

async function loadModulesUnderMocks() {
  jest.resetModules();
  registerLeaseMocks();
  const lease = await import('@/lib/jobs/job-lease');
  const scheduler = await import('@/lib/jobs/job-scheduler');
  const processor = await import('@/lib/xero/queue-processor');
  const queue = await import('@/lib/xero/queue-service');
  const orch = await import('@/lib/xero/sync-orchestration');
  acquireJobLease = lease.acquireJobLease;
  releaseJobLease = lease.releaseJobLease;
  executeLeasedJob = scheduler.executeLeasedJob;
  processQueue = processor.processQueue;
  getPendingSyncJobs = queue.getPendingSyncJobs;
  markSyncSuccess = queue.markSyncSuccess;
  syncPaymentToXero = orch.syncPaymentToXero;
}

function samplePaymentJob() {
  return {
    id: 'sync-job-1',
    sync_type: 'PAYMENT' as const,
    payment_link_id: 'pl-1',
    retry_count: 0,
    request_payload: {},
    created_at: new Date(),
    payment_links: {
      id: 'pl-1',
      organization_id: 'org-1',
      status: 'PAID' as const,
    },
  };
}

describe('distributed lease recovery', () => {
  beforeEach(async () => {
    leaseStore.rows.clear();
    opChain = Promise.resolve();
    jest.clearAllMocks();
    await loadModulesUnderMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('A) worker crash while holding lease', () => {
    it('releases path is unnecessary for recovery: after TTL another owner acquires', async () => {
      jest.useFakeTimers({ now: 1_700_000_000_000 });
      const ttl = 120;
      const first = await acquireJobLease({
        jobName: 'recovery-crash-a',
        leaseTtlSeconds: ttl,
        ownerId: 'worker-crash-1',
      });
      expect(first.acquired).toBe(true);

      jest.advanceTimersByTime((ttl + 1) * 1000);

      const second = await acquireJobLease({
        jobName: 'recovery-crash-a',
        leaseTtlSeconds: ttl,
        ownerId: 'worker-takeover-2',
      });
      expect(second.acquired).toBe(true);
    });

    it('before TTL expiry, takeover owner is refused', async () => {
      jest.useFakeTimers({ now: 1_701_000_000_000 });
      const ttl = 600;
      await acquireJobLease({
        jobName: 'recovery-crash-b',
        leaseTtlSeconds: ttl,
        ownerId: 'holder',
      });

      jest.advanceTimersByTime(60_000);

      const impatient = await acquireJobLease({
        jobName: 'recovery-crash-b',
        leaseTtlSeconds: ttl,
        ownerId: 'other',
      });
      expect(impatient.acquired).toBe(false);
    });
  });

  describe('B) concurrent acquisition attempts', () => {
    it('many racers: at most one acquires while lease is healthy', async () => {
      const ttl = 300;
      const jobName = 'race-b';
      const results = await Promise.all(
        Array.from({ length: 12 }).map((_, i) =>
          acquireJobLease({
            jobName,
            leaseTtlSeconds: ttl,
            ownerId: `race-${i}`,
          })
        )
      );
      expect(results.filter((r) => r.acquired)).toHaveLength(1);
      expect(results.filter((r) => !r.acquired)).toHaveLength(11);
    });
  });

  describe('C) expired stale lease takeover', () => {
    it('replaces stale row without relying on owner release()', async () => {
      jest.useFakeTimers({ now: 1_702_000_000_000 });
      leaseStore.rows.set('stale-one', {
        job_name: 'stale-one',
        owner_id: 'ghost',
        lease_expires_at: new Date(Date.now() - 10_000),
      });

      const next = await acquireJobLease({
        jobName: 'stale-one',
        leaseTtlSeconds: 60,
        ownerId: 'repair-worker',
      });
      expect(next.acquired).toBe(true);
      const row = leaseStore.rows.get('stale-one');
      expect(row?.owner_id).toBe('repair-worker');
      expect(row!.lease_expires_at.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('D) reconciliation overlap and recovery (executeLeasedJob)', () => {
    it('overlapping second invoker skips while lease is held', async () => {
      jest.useFakeTimers({ now: 1_703_000_000_000 });
      const ttl = 90;
      const jobName = 'stripe-reconciliation';
      const held = await acquireJobLease({
        jobName,
        leaseTtlSeconds: ttl,
        ownerId: 'long-runner',
      });
      expect(held.acquired).toBe(true);

      const jobFn = jest.fn(async () => ({
        success: true,
        message: 'recon',
        duration: 0,
      }));

      const overlap = await executeLeasedJob(
        {
          name: jobName,
          description: 'test',
          enabled: true,
        },
        jobFn,
        { enabled: true, leaseTtlSeconds: ttl, ownerId: 'overlap-peer' }
      );

      expect(overlap.result.message).toMatch(/Skipped: lease already active/);
      expect(jobFn).not.toHaveBeenCalled();

      await releaseJobLease({ jobName, ownerId: held.ownerId });
    });

    it('after abandoned lease expiry, work runs once; second full cycle is separate (idempotency outside lease)', async () => {
      jest.useFakeTimers({ now: 1_704_000_000_000 });
      const ttl = 45;
      const jobName = 'stripe-reconciliation-resume';

      const abandoned = await acquireJobLease({
        jobName,
        leaseTtlSeconds: ttl,
        ownerId: 'crashed-invoker',
      });
      expect(abandoned.acquired).toBe(true);

      let settlementAttempts = 0;
      const jobFn = jest.fn(async () => {
        settlementAttempts += 1;
        return {
          success: true,
          message: 'ok',
          data: { settlementAttempts },
          duration: 0,
        };
      });

      jest.advanceTimersByTime((ttl + 1) * 1000);

      await executeLeasedJob(
        {
          name: jobName,
          description: 'test',
          enabled: true,
        },
        jobFn,
        { enabled: true, leaseTtlSeconds: ttl }
      );

      expect(jobFn).toHaveBeenCalledTimes(1);
      expect(settlementAttempts).toBe(1);

      // releaseJobLease uses `new Date()`; acquire uses `lt: now` — advance so expiry is strictly before `now`.
      jest.advanceTimersByTime(50);

      await executeLeasedJob(
        {
          name: jobName,
          description: 'test',
          enabled: true,
        },
        jobFn,
        { enabled: true, leaseTtlSeconds: ttl }
      );
      expect(jobFn).toHaveBeenCalledTimes(2);
      expect(settlementAttempts).toBe(2);
    });
  });

  describe('E) Xero queue processor', () => {
    afterEach(() => {
      process.env.XERO_QUEUE_CONCURRENCY = undefined;
      process.env.XERO_QUEUE_LEASE_TTL_SECONDS = undefined;
    });

    it('concurrent processQueue: one runs, the other returns immediately (no duplicate batch)', async () => {
      process.env.XERO_QUEUE_CONCURRENCY = '1';
      (getPendingSyncJobs as jest.Mock).mockResolvedValue([samplePaymentJob()]);

      const [a, b] = await Promise.all([processQueue(10), processQueue(10)]);
      const processedSum = a.processed + b.processed;
      expect(processedSum).toBe(1);
      expect(markSyncSuccess).toHaveBeenCalledTimes(1);
      expect(syncPaymentToXero).toHaveBeenCalledTimes(1);
    });

    it('stale xero-queue-processor lease: next worker acquires and completes one sync', async () => {
      process.env.XERO_QUEUE_CONCURRENCY = '1';
      process.env.XERO_QUEUE_LEASE_TTL_SECONDS = '30';

      leaseStore.rows.set('xero-queue-processor', {
        job_name: 'xero-queue-processor',
        owner_id: 'dead-node',
        lease_expires_at: new Date(Date.now() - 5_000),
      });

      (getPendingSyncJobs as jest.Mock).mockResolvedValue([samplePaymentJob()]);

      const stats = await processQueue(10);
      expect(stats.processed).toBe(1);
      expect(stats.succeeded).toBe(1);
      expect(syncPaymentToXero).toHaveBeenCalledTimes(1);
      expect(markSyncSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('invariants and logging', () => {
    it('release sets lease to immediate past so another owner can take over promptly', async () => {
      jest.useFakeTimers({ now: 1_707_000_000_000 });
      const jobName = 'release-handoff';
      const w1 = await acquireJobLease({
        jobName,
        leaseTtlSeconds: 600,
        ownerId: 'w1',
      });
      await releaseJobLease({ jobName, ownerId: w1.ownerId });
      jest.advanceTimersByTime(10);

      const w2 = await acquireJobLease({
        jobName,
        leaseTtlSeconds: 600,
        ownerId: 'w2',
      });
      expect(w2.acquired).toBe(true);
    });

    it('recovery / busy paths emit jobs logger entries', async () => {
      const { loggers: lg } = await import('@/lib/logger');
      const infoSpy = jest.spyOn(lg.jobs, 'info');
      const warnSpy = jest.spyOn(lg.jobs, 'warn');

      jest.useFakeTimers({ now: 1_706_000_000_000 });
      await acquireJobLease({
        jobName: 'log-job',
        leaseTtlSeconds: 120,
        ownerId: 'a',
      });
      await acquireJobLease({
        jobName: 'log-job',
        leaseTtlSeconds: 120,
        ownerId: 'b',
      });
      expect(warnSpy).toHaveBeenCalledWith(
        'Job lease busy; skipping run',
        expect.objectContaining({ jobName: 'log-job', activeOwnerId: 'a' })
      );
      jest.advanceTimersByTime(121_000);
      await acquireJobLease({
        jobName: 'log-job',
        leaseTtlSeconds: 120,
        ownerId: 'c',
      });
      expect(
        infoSpy.mock.calls.some((c) => c[0] === 'Job lease acquired (expired/renewed)')
      ).toBe(true);

      warnSpy.mockRestore();
      infoSpy.mockRestore();
    });
  });
});
