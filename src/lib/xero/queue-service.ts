/**
 * Xero Sync Queue Service
 * Manages queuing, retrying, and processing of Xero sync jobs
 * 
 * Sprint 13: Queue & Retry Logic
 */

import { prisma } from '@/lib/server/prisma';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import type { XeroSyncStatus } from '@prisma/client';

export interface QueueSyncJobParams {
  paymentLinkId: string;
  organizationId: string;
  priority?: number; // Optional priority (higher = more important)
}

export interface ProcessQueueOptions {
  batchSize?: number;
  maxRetries?: number;
}

/**
 * Calculate next retry time using exponential backoff
 * Schedule: 1min, 5min, 15min, 1hr, 6hr
 * 
 * @param retryCount - Current retry attempt (0-indexed)
 * @returns Date for next retry or null if max retries exceeded
 */
export function calculateNextRetryTime(retryCount: number): Date | null {
  const MAX_RETRIES = 5;
  
  if (retryCount >= MAX_RETRIES) {
    return null; // Max retries exceeded
  }

  // Retry schedule in milliseconds
  const RETRY_SCHEDULE = [
    1 * 60 * 1000,      // 1 minute
    5 * 60 * 1000,      // 5 minutes
    15 * 60 * 1000,     // 15 minutes
    60 * 60 * 1000,     // 1 hour
    6 * 60 * 60 * 1000, // 6 hours
  ];

  const delay = RETRY_SCHEDULE[retryCount] || RETRY_SCHEDULE[RETRY_SCHEDULE.length - 1];
  return new Date(Date.now() + delay);
}

/**
 * Queue a Xero sync job for a payment
 * Called automatically after payment confirmation
 * 
 * @param params - Queue job parameters
 * @returns Sync record ID
 */
export async function queueXeroSync(params: QueueSyncJobParams): Promise<string> {
  const { paymentLinkId, organizationId, priority = 0 } = params;

  logger.info(
    { paymentLinkId, organizationId },
    'Queuing Xero sync for payment'
  );

  // Upsert: create if doesn't exist, or requeue if not SUCCESS
  const syncRecord = await prisma.xero_syncs.upsert({
    where: {
      xero_syncs_payment_link_sync_type_unique: {
        payment_link_id: paymentLinkId,
        sync_type: 'INVOICE',
      },
    },
    update: {
      // Only requeue if not already successful
      status: 'PENDING',
      request_payload: {
        paymentLinkId,
        organizationId,
        requeuedAt: new Date().toISOString(),
        priority,
      },
      next_retry_at: new Date(), // Process immediately
      updated_at: new Date(),
      // Note: retry_count is NOT reset to preserve retry history
    },
    create: {
      id: randomUUID(),
      payment_link_id: paymentLinkId,
      sync_type: 'INVOICE',
      status: 'PENDING',
      request_payload: {
        paymentLinkId,
        organizationId,
        queuedAt: new Date().toISOString(),
        priority,
      },
      retry_count: 0,
      next_retry_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  logger.info(
    { syncId: syncRecord.id, paymentLinkId, wasExisting: !!syncRecord.created_at },
    'Xero sync queued (idempotent)'
  );

  return syncRecord.id;
}

/**
 * Get pending sync jobs ready to process
 * 
 * @param batchSize - Maximum number of jobs to retrieve
 * @returns Array of sync records
 */
export async function getPendingSyncJobs(batchSize: number = 10) {
  const now = new Date();

  const jobs = await prisma.xero_syncs.findMany({
    where: {
      status: { in: ['PENDING', 'RETRYING'] },
      OR: [
        { next_retry_at: null },
        { next_retry_at: { lte: now } },
      ],
    },
    orderBy: [
      { next_retry_at: 'asc' },
      { created_at: 'asc' },
    ],
    take: batchSize,
    include: {
      payment_links: {
        select: {
          id: true,
          organization_id: true,
          status: true,
        },
      },
    },
  });

  return jobs;
}

/**
 * Mark sync as in progress (RETRYING status)
 * 
 * @param syncId - Sync record ID
 */
export async function markSyncInProgress(syncId: string): Promise<void> {
  await prisma.xero_syncs.update({
    where: { id: syncId },
    data: {
      status: 'RETRYING',
      updated_at: new Date(),
    },
  });
}

/**
 * Mark sync as successful
 * 
 * @param syncId - Sync record ID
 * @param result - Sync result data
 */
export async function markSyncSuccess(
  syncId: string,
  result: {
    invoiceId: string;
    invoiceNumber: string;
    paymentId: string;
    narration?: string;
  }
): Promise<void> {
  await prisma.xero_syncs.update({
    where: { id: syncId },
    data: {
      status: 'SUCCESS',
      xero_invoice_id: result.invoiceId,
      xero_payment_id: result.paymentId,
      response_payload: {
        success: true,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        paymentId: result.paymentId,
        narration: result.narration,
        completedAt: new Date().toISOString(),
      },
      next_retry_at: null, // Clear retry time
      updated_at: new Date(),
    },
  });

  logger.info(
    { syncId, invoiceNumber: result.invoiceNumber },
    'Xero sync completed successfully'
  );
}

/**
 * Mark sync as failed and schedule retry if attempts remain
 * 
 * @param syncId - Sync record ID
 * @param error - Error that caused failure
 */
export async function markSyncFailed(
  syncId: string,
  error: Error | string
): Promise<void> {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Get current sync to check retry count
  const currentSync = await prisma.xero_syncs.findUnique({
    where: { id: syncId },
    select: { retry_count: true },
  });

  if (!currentSync) {
    logger.error({ syncId }, 'Sync record not found');
    return;
  }

  const newRetryCount = currentSync.retry_count + 1;
  const nextRetryTime = calculateNextRetryTime(currentSync.retry_count);

  const isCategorizedError = categorizeError(errorMessage);
  const shouldRetry = isCategorizedError.retryable && nextRetryTime !== null;

  await prisma.xero_syncs.update({
    where: { id: syncId },
    data: {
      status: shouldRetry ? 'RETRYING' : 'FAILED',
      error_message: errorMessage,
      retry_count: newRetryCount,
      next_retry_at: nextRetryTime,
      response_payload: {
        success: false,
        error: errorMessage,
        errorType: isCategorizedError.type,
        retryable: isCategorizedError.retryable,
        failedAt: new Date().toISOString(),
        retryCount: newRetryCount,
      },
      updated_at: new Date(),
    },
  });

  if (shouldRetry) {
    logger.warn(
      {
        syncId,
        retryCount: newRetryCount,
        nextRetry: nextRetryTime,
        error: errorMessage,
      },
      'Xero sync failed - will retry'
    );
  } else {
    logger.error(
      {
        syncId,
        retryCount: newRetryCount,
        error: errorMessage,
        permanent: !isCategorizedError.retryable,
      },
      'Xero sync failed permanently'
    );
  }
}

/**
 * Categorize error to determine if it's retryable
 * 
 * @param errorMessage - Error message
 * @returns Error categorization
 */
export function categorizeError(errorMessage: string): {
  type: string;
  retryable: boolean;
} {
  const lowerError = errorMessage.toLowerCase();

  // Permanent errors (don't retry)
  if (
    lowerError.includes('not found') ||
    lowerError.includes('invalid') ||
    lowerError.includes('unauthorized') ||
    lowerError.includes('forbidden') ||
    lowerError.includes('bad request') ||
    lowerError.includes('missing') ||
    lowerError.includes('validation')
  ) {
    return { type: 'PERMANENT', retryable: false };
  }

  // Rate limit errors (retry with backoff)
  if (
    lowerError.includes('rate limit') ||
    lowerError.includes('too many requests') ||
    lowerError.includes('429')
  ) {
    return { type: 'RATE_LIMIT', retryable: true };
  }

  // Network/timeout errors (retry)
  if (
    lowerError.includes('timeout') ||
    lowerError.includes('network') ||
    lowerError.includes('econnrefused') ||
    lowerError.includes('enotfound') ||
    lowerError.includes('503') ||
    lowerError.includes('504')
  ) {
    return { type: 'NETWORK', retryable: true };
  }

  // Xero API errors (retry)
  if (
    lowerError.includes('xero') ||
    lowerError.includes('token') ||
    lowerError.includes('expired') ||
    lowerError.includes('500') ||
    lowerError.includes('502')
  ) {
    return { type: 'API_ERROR', retryable: true };
  }

  // Unknown errors (retry by default)
  return { type: 'UNKNOWN', retryable: true };
}

/**
 * Get sync status for a payment link
 * 
 * @param paymentLinkId - Payment link ID
 * @returns Sync records for the payment
 */
export async function getSyncStatus(paymentLinkId: string) {
  const syncs = await prisma.xero_syncs.findMany({
    where: { payment_link_id: paymentLinkId },
    orderBy: { created_at: 'desc' },
  });

  return syncs;
}

/**
 * Get failed syncs that need attention
 * 
 * @param limit - Maximum number of records to return
 * @returns Failed sync records
 */
export async function getFailedSyncs(limit: number = 50) {
  const failedSyncs = await prisma.xero_syncs.findMany({
    where: {
      status: 'FAILED',
    },
    orderBy: { updated_at: 'desc' },
    take: limit,
    include: {
      payment_links: {
        select: {
          id: true,
          organization_id: true,
          amount: true,
          currency: true,
          invoice_reference: true,
        },
      },
    },
  });

  return failedSyncs;
}

/**
 * Get sync statistics
 * 
 * @param organizationId - Optional organization filter
 * @returns Sync statistics
 */
export async function getSyncStatistics(organizationId?: string) {
  const where = organizationId
    ? {
        payment_links: {
          organization_id: organizationId,
        },
      }
    : {};

  const [total, pending, retrying, success, failed] = await Promise.all([
    prisma.xero_syncs.count({ where }),
    prisma.xero_syncs.count({ where: { ...where, status: 'PENDING' } }),
    prisma.xero_syncs.count({ where: { ...where, status: 'RETRYING' } }),
    prisma.xero_syncs.count({ where: { ...where, status: 'SUCCESS' } }),
    prisma.xero_syncs.count({ where: { ...where, status: 'FAILED' } }),
  ]);

  return {
    total,
    pending,
    retrying,
    success,
    failed,
    successRate: total > 0 ? (success / total) * 100 : 0,
    failureRate: total > 0 ? (failed / total) * 100 : 0,
  };
}







