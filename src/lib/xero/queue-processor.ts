/**
 * Xero Sync Queue Processor
 * Processes queued sync jobs with retry logic
 * 
 * Sprint 13: Queue & Retry Logic
 */

import { logger } from '@/lib/logger';
import { syncInvoiceToXero, syncPaymentToXero } from './sync-orchestration';
import {
  getPendingSyncJobs,
  getProcessableSyncJobById,
  markSyncInProgress,
  markSyncSuccess,
  markSyncFailed,
} from './queue-service';

export interface ProcessorStats {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ syncId: string; error: string }>;
}

/**
 * Process pending sync jobs from the queue
 * 
 * This function should be called periodically (e.g., every minute via cron)
 * to process any pending or retry-ready sync jobs.
 * 
 * @param batchSize - Maximum number of jobs to process in one run
 * @returns Processing statistics
 */
export async function processQueue(batchSize: number = 10): Promise<ProcessorStats> {
  logger.info({ batchSize }, 'Starting queue processor');
  const maxConcurrency = Math.max(
    1,
    Number.parseInt(process.env.XERO_QUEUE_CONCURRENCY || '4', 10) || 4
  );

  const stats: ProcessorStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get pending jobs
    const jobs = await getPendingSyncJobs(batchSize);

    if (jobs.length === 0) {
      logger.info('No pending sync jobs found');
      return stats;
    }

    logger.info({ count: jobs.length }, 'Processing sync jobs');

    const processJob = async (job: (typeof jobs)[number]) => {
      stats.processed++;

      try {
        const requiresOpen = job.sync_type === 'INVOICE';
        const statusOk = requiresOpen
          ? job.payment_links.status === 'OPEN' || job.payment_links.status === 'PAID'
          : job.payment_links.status === 'PAID';
        if (!statusOk) {
          logger.warn(
            {
              syncId: job.id,
              syncType: job.sync_type,
              paymentLinkId: job.payment_link_id,
              status: job.payment_links.status,
            },
            'Skipping sync - payment link status does not match sync type requirements'
          );
          stats.skipped++;
          return;
        }

        // Mark as in progress
        await markSyncInProgress(job.id);

        // Extract organization ID from request payload or payment link
        const organizationId =
          (job.request_payload as any)?.organizationId ||
          job.payment_links.organization_id;

        // Execute sync
        logger.info(
          {
            syncId: job.id,
            paymentLinkId: job.payment_link_id,
            retryCount: job.retry_count,
          },
          'Executing Xero sync'
        );

        const result =
          job.sync_type === 'INVOICE'
            ? await syncInvoiceToXero({
                paymentLinkId: job.payment_link_id,
                organizationId,
              })
            : await syncPaymentToXero({
                paymentLinkId: job.payment_link_id,
                organizationId,
              });

        if (result.success) {
          // Mark as successful
          await markSyncSuccess(job.id, {
            invoiceId: result.invoiceId ?? null,
            invoiceNumber: result.invoiceNumber ?? null,
            paymentId: result.paymentId ?? null,
            narration: result.narration,
          });

          stats.succeeded++;
          logger.info(
            {
              syncId: job.id,
              invoiceNumber: result.invoiceNumber,
            },
            'Sync completed successfully'
          );
        } else {
          // Mark as failed
          await markSyncFailed(job.id, result.error || 'Unknown error');
          stats.failed++;
          stats.errors.push({
            syncId: job.id,
            error: result.error || 'Unknown error',
          });
        }
      } catch (error) {
        // Unexpected error during processing
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            syncId: job.id,
            paymentLinkId: job.payment_link_id,
            error: errorMessage,
          },
          'Unexpected error processing sync job'
        );

        await markSyncFailed(job.id, errorMessage);
        stats.failed++;
        stats.errors.push({
          syncId: job.id,
          error: errorMessage,
        });
      }

    };

    // Process jobs with bounded concurrency to improve throughput while protecting downstream APIs.
    for (let i = 0; i < jobs.length; i += maxConcurrency) {
      const batch = jobs.slice(i, i + maxConcurrency);
      await Promise.all(batch.map(processJob));
      // Small pause between batches to avoid provider burst limits.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info(
      {
        processed: stats.processed,
        succeeded: stats.succeeded,
        failed: stats.failed,
        skipped: stats.skipped,
      },
      'Queue processing complete'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Error in queue processor');
    throw error;
  }

  return stats;
}

/**
 * Process a specific sync job by ID (for manual replay)
 * 
 * @param syncId - Sync record ID to process
 * @returns Processing result
 */
export async function processSyncById(syncId: string): Promise<{
  success: boolean;
  error?: string;
  result?: any;
}> {
  logger.info({ syncId }, 'Processing specific sync job');

  try {
    // Get the specific sync record directly.
    const job = await getProcessableSyncJobById(syncId);

    if (!job) {
      const error = 'Sync record not found or not in processable state';
      logger.error({ syncId }, error);
      return { success: false, error };
    }

    // Validate payment link
    const requiresOpen = job.sync_type === 'INVOICE';
    const statusOk = requiresOpen
      ? job.payment_links.status === 'OPEN' || job.payment_links.status === 'PAID'
      : job.payment_links.status === 'PAID';
    if (!statusOk) {
      const error = requiresOpen
        ? `Payment link not in OPEN/PAID status: ${job.payment_links.status}`
        : `Payment link not in PAID status: ${job.payment_links.status}`;
      logger.warn({ syncId, status: job.payment_links.status }, error);
      return { success: false, error };
    }

    // Mark as in progress
    await markSyncInProgress(job.id);

    // Extract organization ID
    const organizationId =
      (job.request_payload as any)?.organizationId ||
      job.payment_links.organization_id;

    // Execute sync
    const result =
      job.sync_type === 'INVOICE'
        ? await syncInvoiceToXero({
            paymentLinkId: job.payment_link_id,
            organizationId,
          })
        : await syncPaymentToXero({
            paymentLinkId: job.payment_link_id,
            organizationId,
          });

    if (result.success) {
      await markSyncSuccess(job.id, {
        invoiceId: result.invoiceId ?? null,
        invoiceNumber: result.invoiceNumber ?? null,
        paymentId: result.paymentId ?? null,
        narration: result.narration,
      });

      logger.info(
        { syncId, invoiceNumber: result.invoiceNumber },
        'Manual sync completed successfully'
      );

      return { success: true, result };
    } else {
      await markSyncFailed(job.id, result.error || 'Unknown error');
      return { success: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ syncId, error: errorMessage }, 'Error processing sync');

    try {
      await markSyncFailed(syncId, errorMessage);
    } catch (updateError) {
      logger.error({ syncId, updateError }, 'Failed to mark sync as failed');
    }

    return { success: false, error: errorMessage };
  }
}







