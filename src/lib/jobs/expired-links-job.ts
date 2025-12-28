/**
 * Expired Links Background Job
 * Checks for expired payment links and transitions them to EXPIRED status
 */

import { prisma } from '@/lib/prisma';
import { loggers } from '@/lib/logger';

export interface ExpiredLinksJobResult {
  success: boolean;
  processedCount: number;
  expiredCount: number;
  errors: Array<{ id: string; error: string }>;
  startTime: Date;
  endTime: Date;
  duration: number;
}

/**
 * Run the expired links job
 * Finds all OPEN payment links that have passed their expiry date
 * and transitions them to EXPIRED status
 */
export async function runExpiredLinksJob(): Promise<ExpiredLinksJobResult> {
  const startTime = new Date();
  const errors: Array<{ id: string; error: string }> = [];
  let processedCount = 0;
  let expiredCount = 0;

  loggers.jobs.info('Starting expired links job');

  try {
    // Find all OPEN payment links that have expired
    const expiredLinks = await prisma.payment_links.findMany({
      where: {
        status: 'OPEN',
        expires_at: {
          lt: new Date(), // Less than current time
        },
      },
      select: {
        id: true,
        short_code: true,
        expires_at: true,
        organization_id: true,
      },
    });

    loggers.jobs.info(
      { count: expiredLinks.length },
      'Found expired payment links to process'
    );

    // Process each expired link
    for (const link of expiredLinks) {
      processedCount++;

      try {
        // Transition to EXPIRED status
        await prisma.$transaction([
          prisma.payment_links.update({
            where: { id: link.id },
            data: {
              status: 'EXPIRED',
              updated_at: new Date(),
            },
          }),
          prisma.payment_events.create({
            data: {
              payment_link_id: link.id,
              event_type: 'EXPIRED',
              metadata: {
                expiredAt: new Date().toISOString(),
                expiryDate: link.expires_at?.toISOString(),
                autoExpired: true,
                jobProcessed: true,
              },
            },
          }),
          prisma.audit_logs.create({
            data: {
              organization_id: link.organization_id,
              entity_type: 'PaymentLink',
              entity_id: link.id,
              action: 'UPDATE',
              old_values: { status: 'OPEN' },
              new_values: { status: 'EXPIRED' },
            },
          }),
        ]);

        expiredCount++;

        loggers.jobs.info(
          {
            paymentLinkId: link.id,
            shortCode: link.short_code,
            expiresAt: link.expires_at,
          },
          'Payment link transitioned to EXPIRED'
        );
      } catch (error: any) {
        loggers.jobs.error(
          {
            paymentLinkId: link.id,
            error: error.message,
          },
          'Failed to expire payment link'
        );

        errors.push({
          id: link.id,
          error: error.message,
        });
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    loggers.jobs.info(
      {
        processedCount,
        expiredCount,
        errorCount: errors.length,
        duration: `${duration}ms`,
      },
      'Expired links job completed'
    );

    return {
      success: errors.length === 0,
      processedCount,
      expiredCount,
      errors,
      startTime,
      endTime,
      duration,
    };
  } catch (error: any) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    loggers.jobs.error(
      { error: error.message, duration: `${duration}ms` },
      'Expired links job failed'
    );

    return {
      success: false,
      processedCount,
      expiredCount,
      errors: [{ id: 'JOB_FAILURE', error: error.message }],
      startTime,
      endTime,
      duration,
    };
  }
}

/**
 * Check for stuck payment links
 * Finds payment links that have been in OPEN state for too long
 * without any recent activity (potential issues)
 */
export async function checkStuckPaymentLinks(): Promise<{
  stuckLinks: Array<{
    id: string;
    shortCode: string;
    createdAt: Date;
    lastEventAt: Date | null;
    ageMinutes: number;
  }>;
  count: number;
}> {
  const STUCK_THRESHOLD_MINUTES = 60; // Consider stuck after 1 hour
  const thresholdDate = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);

  loggers.jobs.info('Checking for stuck payment links');

  try {
    // Find OPEN links created before threshold with no recent activity
    const stuckLinks = await prisma.payment_links.findMany({
      where: {
        status: 'OPEN',
        created_at: {
          lt: thresholdDate,
        },
      },
      include: {
        payment_events: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    const stuckLinksData = stuckLinks.map((link) => {
      const lastEvent = link.payment_events[0];
      const ageMinutes = Math.floor(
        (Date.now() - link.created_at.getTime()) / (1000 * 60)
      );

      return {
        id: link.id,
        shortCode: link.short_code,
        createdAt: link.created_at,
        lastEventAt: lastEvent?.created_at || null,
        ageMinutes,
      };
    });

    loggers.jobs.info(
      { count: stuckLinksData.length },
      'Found stuck payment links'
    );

    return {
      stuckLinks: stuckLinksData,
      count: stuckLinksData.length,
    };
  } catch (error: any) {
    loggers.jobs.error(
      { error: error.message },
      'Failed to check stuck payment links'
    );

    return {
      stuckLinks: [],
      count: 0,
    };
  }
}






