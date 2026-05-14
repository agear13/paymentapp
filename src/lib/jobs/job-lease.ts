import { randomUUID } from 'crypto';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';

function nowPlusSeconds(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

export interface AcquireLeaseResult {
  acquired: boolean;
  ownerId: string;
  jobName: string;
  leaseExpiresAt?: Date;
}

export async function acquireJobLease(params: {
  jobName: string;
  leaseTtlSeconds: number;
  ownerId?: string;
}): Promise<AcquireLeaseResult> {
  const ownerId = params.ownerId || randomUUID();
  const now = new Date();
  const leaseExpiresAt = nowPlusSeconds(params.leaseTtlSeconds);

  try {
    await prisma.operational_job_leases.create({
      data: {
        job_name: params.jobName,
        owner_id: ownerId,
        lease_expires_at: leaseExpiresAt,
      },
    });
    loggers.jobs.info('Job lease acquired (new row)', {
      jobName: params.jobName,
      ownerId,
      leaseExpiresAt: leaseExpiresAt.toISOString(),
      ttlSeconds: params.leaseTtlSeconds,
    });
    return { acquired: true, ownerId, jobName: params.jobName, leaseExpiresAt };
  } catch {
    // Row already exists; try to steal only if expired or already owned by this owner.
  }

  const update = await prisma.operational_job_leases.updateMany({
    where: {
      job_name: params.jobName,
      OR: [{ lease_expires_at: { lt: now } }, { owner_id: ownerId }],
    },
    data: {
      owner_id: ownerId,
      lease_expires_at: leaseExpiresAt,
    },
  });

  if (update.count > 0) {
    loggers.jobs.info('Job lease acquired (expired/renewed)', {
      jobName: params.jobName,
      ownerId,
      leaseExpiresAt: leaseExpiresAt.toISOString(),
      ttlSeconds: params.leaseTtlSeconds,
    });
    return { acquired: true, ownerId, jobName: params.jobName, leaseExpiresAt };
  }

  const current = await prisma.operational_job_leases.findUnique({
    where: { job_name: params.jobName },
    select: { owner_id: true, lease_expires_at: true },
  });

  loggers.jobs.warn('Job lease busy; skipping run', {
    jobName: params.jobName,
    ownerId,
    activeOwnerId: current?.owner_id,
    activeLeaseExpiresAt: current?.lease_expires_at?.toISOString(),
  });
  return { acquired: false, ownerId, jobName: params.jobName };
}

export async function renewJobLease(params: {
  jobName: string;
  ownerId: string;
  leaseTtlSeconds: number;
}): Promise<boolean> {
  const leaseExpiresAt = nowPlusSeconds(params.leaseTtlSeconds);
  const updated = await prisma.operational_job_leases.updateMany({
    where: {
      job_name: params.jobName,
      owner_id: params.ownerId,
    },
    data: {
      lease_expires_at: leaseExpiresAt,
    },
  });
  return updated.count > 0;
}

export async function releaseJobLease(params: {
  jobName: string;
  ownerId: string;
}): Promise<void> {
  await prisma.operational_job_leases.updateMany({
    where: {
      job_name: params.jobName,
      owner_id: params.ownerId,
    },
    data: {
      lease_expires_at: new Date(),
    },
  });
}

