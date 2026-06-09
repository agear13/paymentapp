import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { claimAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/claim-job.server';
import { completeAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/complete-job.server';
import { createAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/create-job.server';
import { failAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/fail-job.server';
import {
  AGREEMENT_JOB_BACKOFF_MINUTES,
  getAgreementJobRetryDelayMs,
} from '@/lib/agreement-analyzer/jobs/agreement-processing-job-types';
import {
  processAgreementProcessingJobsBatch,
  processNextAgreementProcessingJob,
} from '@/lib/agreement-analyzer/jobs/process-jobs.server';
import { retryAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/retry-job.server';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server', () => ({
  trackAgreementAnalyzerEvent: jest.fn(),
}));

jest.mock('@/lib/agreement-analyzer/extraction/process-agreement-extraction.server', () => ({
  processAgreementExtraction: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    agreement_processing_jobs: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    agreement_obligation_reports: {
      updateMany: jest.fn(),
    },
    agreement_uploads: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}));

type InMemoryJob = {
  id: string;
  upload_id: string;
  report_id: string;
  job_type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  locked_at: Date | null;
  locked_by: string | null;
  run_after: Date;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

function createInMemoryJob(overrides: Partial<InMemoryJob> = {}): InMemoryJob {
  const now = new Date();
  return {
    id: 'job-1',
    upload_id: 'upload-1',
    report_id: 'report-1',
    job_type: 'EXTRACTION',
    status: 'PENDING',
    attempt_count: 0,
    max_attempts: 3,
    last_error: null,
    locked_at: null,
    locked_by: null,
    run_after: now,
    created_at: now,
    updated_at: now,
    completed_at: null,
    ...overrides,
  };
}

describe('agreement processing job backoff', () => {
  it('uses exponential backoff minutes for each attempt', () => {
    expect(getAgreementJobRetryDelayMs(1)).toBe(AGREEMENT_JOB_BACKOFF_MINUTES[0] * 60 * 1000);
    expect(getAgreementJobRetryDelayMs(2)).toBe(AGREEMENT_JOB_BACKOFF_MINUTES[1] * 60 * 1000);
    expect(getAgreementJobRetryDelayMs(3)).toBe(AGREEMENT_JOB_BACKOFF_MINUTES[2] * 60 * 1000);
    expect(getAgreementJobRetryDelayMs(99)).toBe(AGREEMENT_JOB_BACKOFF_MINUTES[2] * 60 * 1000);
  });
});

describe('createAgreementProcessingJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a pending extraction job and emits analytics', async () => {
    (prisma.agreement_processing_jobs.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.agreement_processing_jobs.create as jest.Mock).mockResolvedValue({ id: 'job-new' });

    const result = await createAgreementProcessingJob({
      uploadId: 'upload-1',
      reportId: 'report-1',
    });

    expect(result).toEqual({ jobId: 'job-new', created: true });
    expect(prisma.agreement_processing_jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        upload_id: 'upload-1',
        report_id: 'report-1',
        job_type: 'EXTRACTION',
        status: 'PENDING',
        max_attempts: 3,
      }),
      select: { id: true },
    });
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith('agreement_job_created', {
      jobId: 'job-new',
      uploadId: 'upload-1',
      reportId: 'report-1',
      jobType: 'EXTRACTION',
    });
  });

  it('returns an existing active job without creating a duplicate', async () => {
    (prisma.agreement_processing_jobs.findFirst as jest.Mock).mockResolvedValue({ id: 'job-existing' });

    const result = await createAgreementProcessingJob({
      uploadId: 'upload-1',
      reportId: 'report-1',
    });

    expect(result).toEqual({ jobId: 'job-existing', created: false });
    expect(prisma.agreement_processing_jobs.create).not.toHaveBeenCalled();
  });
});

describe('claimAgreementProcessingJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims the oldest pending job with worker lock metadata', async () => {
    const job = createInMemoryJob();

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: job.id }]),
        agreement_processing_jobs: {
          update: jest.fn().mockResolvedValue({
            ...job,
            status: 'PROCESSING',
            locked_at: new Date('2026-06-09T12:00:00.000Z'),
            locked_by: 'worker-a',
          }),
        },
      };
      return callback(tx);
    });

    const claimed = await claimAgreementProcessingJob('worker-a');

    expect(claimed).toEqual({
      id: job.id,
      uploadId: job.upload_id,
      reportId: job.report_id,
      jobType: job.job_type,
      attemptCount: 0,
      maxAttempts: 3,
    });
  });

  it('returns null when no pending jobs are available', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        agreement_processing_jobs: {
          update: jest.fn(),
        },
      };
      return callback(tx);
    });

    await expect(claimAgreementProcessingJob('worker-a')).resolves.toBeNull();
  });
});

describe('duplicate worker protection', () => {
  it('only one worker can claim the same pending job in memory simulation', async () => {
    const jobs = new Map<string, InMemoryJob>([['job-1', createInMemoryJob()]]);

    const claimFromStore = (workerId: string): Claimed | null => {
      const eligible = [...jobs.values()]
        .filter((job) => job.status === 'PENDING' && job.run_after <= new Date())
        .sort((left, right) => left.created_at.getTime() - right.created_at.getTime());

      const next = eligible[0];
      if (!next || next.status !== 'PENDING') {
        return null;
      }

      next.status = 'PROCESSING';
      next.locked_at = new Date();
      next.locked_by = workerId;
      jobs.set(next.id, next);

      return {
        id: next.id,
        uploadId: next.upload_id,
        reportId: next.report_id,
        jobType: next.job_type,
        attemptCount: next.attempt_count,
        maxAttempts: next.max_attempts,
      };
    };

    type Claimed = Awaited<ReturnType<typeof claimAgreementProcessingJob>>;

    const firstClaim = claimFromStore('worker-a');
    const secondClaim = claimFromStore('worker-b');

    expect(firstClaim?.id).toBe('job-1');
    expect(secondClaim).toBeNull();
    expect(jobs.get('job-1')?.locked_by).toBe('worker-a');
    expect(jobs.get('job-1')?.status).toBe('PROCESSING');
  });
});

describe('retryAgreementProcessingJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-09T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requeues failed extraction rows with backoff and analytics', async () => {
    const job = createInMemoryJob();
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);

    const runAfter = await retryAgreementProcessingJob(job, 1, 'temporary failure');

    expect(runAfter.getTime()).toBe(
      new Date('2026-06-09T12:00:00.000Z').getTime() + getAgreementJobRetryDelayMs(1)
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith('agreement_job_retried', {
      jobId: job.id,
      uploadId: job.upload_id,
      reportId: job.report_id,
      attemptCount: 1,
      runAfter: runAfter.toISOString(),
      error: 'temporary failure',
    });
  });
});

describe('completeAgreementProcessingJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks the job completed and emits analytics', async () => {
    const completedAt = new Date('2026-06-09T12:05:00.000Z');
    const createdAt = new Date('2026-06-09T12:00:00.000Z');

    (prisma.agreement_processing_jobs.update as jest.Mock).mockResolvedValue({
      id: 'job-1',
      upload_id: 'upload-1',
      report_id: 'report-1',
      attempt_count: 0,
      created_at: createdAt,
      completed_at: completedAt,
    });

    await completeAgreementProcessingJob('job-1');

    expect(prisma.agreement_processing_jobs.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'COMPLETED',
        completed_at: expect.any(Date),
        locked_at: null,
        locked_by: null,
        last_error: null,
      },
      select: expect.any(Object),
    });
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith('agreement_job_completed', {
      jobId: 'job-1',
      uploadId: 'upload-1',
      reportId: 'report-1',
      attemptCount: 0,
      processingTimeMs: 5 * 60 * 1000,
    });
  });
});

describe('failAgreementProcessingJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-09T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries when attempts remain', async () => {
    const job = createInMemoryJob({ attempt_count: 0, max_attempts: 3 });
    (prisma.agreement_processing_jobs.findUniqueOrThrow as jest.Mock).mockResolvedValue(job);
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);

    const outcome = await failAgreementProcessingJob('job-1', 'extraction failed');

    expect(outcome).toBe('retried');
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith(
      'agreement_job_retried',
      expect.objectContaining({
        jobId: 'job-1',
        attemptCount: 1,
      })
    );
  });

  it('marks the job failed after max attempts', async () => {
    const job = createInMemoryJob({ attempt_count: 2, max_attempts: 3 });
    (prisma.agreement_processing_jobs.findUniqueOrThrow as jest.Mock).mockResolvedValue(job);
    (prisma.agreement_processing_jobs.update as jest.Mock).mockResolvedValue(job);

    const outcome = await failAgreementProcessingJob('job-1', 'extraction failed');

    expect(outcome).toBe('failed');
    expect(prisma.agreement_processing_jobs.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'FAILED',
        attempt_count: 3,
        last_error: 'extraction failed',
        locked_at: null,
        locked_by: null,
      },
    });
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith('agreement_job_failed', {
      jobId: 'job-1',
      uploadId: 'upload-1',
      reportId: 'report-1',
      attemptCount: 3,
      error: 'extraction failed',
    });
  });
});

describe('processNextAgreementProcessingJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes jobs when mocked extraction succeeds', async () => {
    const job = createInMemoryJob();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: job.id }]),
        agreement_processing_jobs: {
          update: jest.fn().mockResolvedValue(job),
        },
      };
      return callback(tx);
    });
    (prisma.agreement_processing_jobs.update as jest.Mock).mockResolvedValue({
      id: job.id,
      upload_id: job.upload_id,
      report_id: job.report_id,
      attempt_count: 0,
      created_at: job.created_at,
      completed_at: new Date(),
    });

    const processExtraction = jest.fn().mockResolvedValue({
      success: true,
      reportId: job.report_id,
      uploadId: job.upload_id,
      extractionId: 'extraction-1',
    });

    const outcome = await processNextAgreementProcessingJob('worker-a', { processExtraction });

    expect(outcome).toBe('completed');
    expect(processExtraction).toHaveBeenCalledWith({ reportId: job.report_id });
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith(
      'agreement_job_started',
      expect.objectContaining({ jobId: job.id, workerId: 'worker-a' })
    );
    expect(trackAgreementAnalyzerEvent).toHaveBeenCalledWith(
      'agreement_job_completed',
      expect.objectContaining({ jobId: job.id })
    );
  });

  it('returns idle when no jobs are claimable', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        agreement_processing_jobs: {
          update: jest.fn(),
        },
      };
      return callback(tx);
    });

    const outcome = await processNextAgreementProcessingJob('worker-a', {
      processExtraction: jest.fn(),
    });

    expect(outcome).toBe('idle');
  });
});

describe('processAgreementProcessingJobsBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes up to the requested limit with mocked extraction', async () => {
    const job = createInMemoryJob();
    let claimed = 0;

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      if (claimed >= 2) {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          agreement_processing_jobs: { update: jest.fn() },
        };
        return callback(tx);
      }

      claimed += 1;
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: job.id }]),
        agreement_processing_jobs: {
          update: jest.fn().mockResolvedValue(job),
        },
      };
      return callback(tx);
    });

    (prisma.agreement_processing_jobs.update as jest.Mock).mockResolvedValue({
      id: job.id,
      upload_id: job.upload_id,
      report_id: job.report_id,
      attempt_count: 0,
      created_at: job.created_at,
      completed_at: new Date(),
    });

    const processExtraction = jest.fn().mockResolvedValue({
      success: true,
      reportId: job.report_id,
      uploadId: job.upload_id,
      extractionId: 'extraction-1',
    });

    const batch = await processAgreementProcessingJobsBatch('worker-a', 3, { processExtraction });

    expect(batch).toEqual({
      processed: 2,
      completed: 2,
      retried: 0,
      failed: 0,
    });
    expect(processExtraction).toHaveBeenCalledTimes(2);
  });
});
