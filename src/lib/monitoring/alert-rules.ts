/**
 * Alert Rules Engine
 * Defines and evaluates alert conditions for system monitoring
 * 
 * Sprint 15: Alerting & Monitoring
 */

import { prisma } from '@/lib/server/prisma';
import { logger } from '@/lib/logger';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  checkInterval: number; // minutes
  condition: () => Promise<AlertResult>;
}

export interface AlertResult {
  triggered: boolean;
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * Alert Rule: High Failure Rate
 * Triggers when sync failure rate exceeds 5% in the last hour
 */
export async function checkFailureRate(organizationId?: string): Promise<AlertResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const where = organizationId
    ? {
        created_at: { gte: oneHourAgo },
        payment_links: { organization_id: organizationId },
      }
    : {
        created_at: { gte: oneHourAgo },
      };

  const [total, failed] = await Promise.all([
    prisma.xero_syncs.count({ where }),
    prisma.xero_syncs.count({ where: { ...where, status: 'FAILED' } }),
  ]);

  if (total === 0) {
    return {
      triggered: false,
      message: 'No syncs in the last hour',
      timestamp: new Date(),
    };
  }

  const failureRate = (failed / total) * 100;
  const threshold = 5; // 5%

  return {
    triggered: failureRate > threshold,
    message: failureRate > threshold
      ? `Failure rate is ${failureRate.toFixed(1)}% (threshold: ${threshold}%)`
      : `Failure rate is ${failureRate.toFixed(1)}% (within threshold)`,
    details: {
      total,
      failed,
      failureRate: failureRate.toFixed(1),
      threshold,
      period: '1 hour',
    },
    timestamp: new Date(),
  };
}

/**
 * Alert Rule: Stuck Payment Links
 * Triggers when payment links are in OPEN status for more than 24 hours
 */
export async function checkStuckPaymentLinks(organizationId?: string): Promise<AlertResult> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const where = organizationId
    ? {
        status: 'OPEN',
        created_at: { lt: twentyFourHoursAgo },
        organization_id: organizationId,
      }
    : {
        status: 'OPEN',
        created_at: { lt: twentyFourHoursAgo },
      };

  const stuckLinks = await prisma.payment_links.findMany({
    where,
    select: {
      id: true,
      invoice_reference: true,
      amount: true,
      currency: true,
      created_at: true,
    },
    take: 10, // Limit to first 10 for alert
  });

  const count = stuckLinks.length;

  return {
    triggered: count > 0,
    message: count > 0
      ? `${count} payment link(s) stuck in OPEN status for >24 hours`
      : 'No stuck payment links detected',
    details: {
      count,
      stuckLinks: stuckLinks.map((link) => ({
        id: link.id,
        reference: link.invoice_reference,
        amount: `${link.amount} ${link.currency}`,
        age: Math.floor((Date.now() - link.created_at.getTime()) / (1000 * 60 * 60)), // hours
      })),
    },
    timestamp: new Date(),
  };
}

/**
 * Alert Rule: Large Queue Backlog
 * Triggers when pending/retrying queue exceeds 100 items
 */
export async function checkQueueBacklog(organizationId?: string): Promise<AlertResult> {
  const where = organizationId
    ? {
        status: { in: ['PENDING', 'RETRYING'] },
        payment_links: { organization_id: organizationId },
      }
    : {
        status: { in: ['PENDING', 'RETRYING'] },
      };

  const backlogCount = await prisma.xero_syncs.count({ where });
  const threshold = 100;

  return {
    triggered: backlogCount > threshold,
    message: backlogCount > threshold
      ? `Queue backlog is ${backlogCount} items (threshold: ${threshold})`
      : `Queue backlog is ${backlogCount} items (within threshold)`,
    details: {
      backlogCount,
      threshold,
    },
    timestamp: new Date(),
  };
}

/**
 * Alert Rule: No Syncs Processed Recently
 * Triggers when no syncs have been processed in the last 5 minutes
 * (indicates cron job may not be running)
 */
export async function checkSyncProcessing(): Promise<AlertResult> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentSyncs = await prisma.xero_syncs.count({
    where: {
      updated_at: { gte: fiveMinutesAgo },
    },
  });

  return {
    triggered: recentSyncs === 0,
    message: recentSyncs === 0
      ? 'No syncs processed in the last 5 minutes - cron job may be down'
      : `${recentSyncs} sync(s) processed in the last 5 minutes`,
    details: {
      recentSyncs,
      period: '5 minutes',
    },
    timestamp: new Date(),
  };
}

/**
 * Alert Rule: High Retry Count
 * Triggers when any sync has retry count > 3
 */
export async function checkHighRetryCount(organizationId?: string): Promise<AlertResult> {
  const where = organizationId
    ? {
        retry_count: { gt: 3 },
        status: { in: ['RETRYING', 'FAILED'] },
        payment_links: { organization_id: organizationId },
      }
    : {
        retry_count: { gt: 3 },
        status: { in: ['RETRYING', 'FAILED'] },
      };

  const highRetrySyncs = await prisma.xero_syncs.findMany({
    where,
    select: {
      id: true,
      payment_link_id: true,
      retry_count: true,
      error_message: true,
    },
    take: 5,
  });

  const count = highRetrySyncs.length;

  return {
    triggered: count > 0,
    message: count > 0
      ? `${count} sync(s) with retry count > 3`
      : 'No syncs with high retry count',
    details: {
      count,
      syncs: highRetrySyncs.map((sync) => ({
        id: sync.id,
        paymentLinkId: sync.payment_link_id,
        retryCount: sync.retry_count,
        error: sync.error_message?.slice(0, 100),
      })),
    },
    timestamp: new Date(),
  };
}

/**
 * Alert Rule: Ledger Imbalance
 * Triggers when ledger entries don't balance (DR != CR)
 */
export async function checkLedgerBalance(organizationId?: string): Promise<AlertResult> {
  // Get all payment links with ledger entries
  const where = organizationId
    ? { organization_id: organizationId, status: 'PAID' }
    : { status: 'PAID' };

  const paidLinks = await prisma.payment_links.findMany({
    where,
    select: {
      id: true,
      invoice_reference: true,
      ledger_entries: {
        select: {
          entry_type: true,
          amount: true,
        },
      },
    },
    take: 1000, // Check last 1000 paid links
  });

  const imbalancedLinks = paidLinks.filter((link) => {
    if (link.ledger_entries.length === 0) return false;

    const debits = link.ledger_entries
      .filter((e) => e.entry_type === 'DEBIT')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const credits = link.ledger_entries
      .filter((e) => e.entry_type === 'CREDIT')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    // Allow for small rounding differences (0.01)
    return Math.abs(debits - credits) > 0.01;
  });

  const count = imbalancedLinks.length;

  return {
    triggered: count > 0,
    message: count > 0
      ? `${count} payment link(s) with ledger imbalance`
      : 'All ledgers balanced',
    details: {
      count,
      imbalancedLinks: imbalancedLinks.slice(0, 5).map((link) => ({
        id: link.id,
        reference: link.invoice_reference,
      })),
    },
    timestamp: new Date(),
  };
}

/**
 * Evaluate all alert rules
 */
export async function evaluateAllAlerts(organizationId?: string): Promise<{
  alerts: Array<{ rule: string; result: AlertResult }>;
  criticalCount: number;
  warningCount: number;
}> {
  logger.info({ organizationId }, 'Evaluating all alert rules');

  const results = await Promise.all([
    checkFailureRate(organizationId).then((result) => ({ rule: 'failure_rate', result })),
    checkStuckPaymentLinks(organizationId).then((result) => ({ rule: 'stuck_links', result })),
    checkQueueBacklog(organizationId).then((result) => ({ rule: 'queue_backlog', result })),
    checkSyncProcessing().then((result) => ({ rule: 'sync_processing', result })),
    checkHighRetryCount(organizationId).then((result) => ({ rule: 'high_retry', result })),
    checkLedgerBalance(organizationId).then((result) => ({ rule: 'ledger_balance', result })),
  ]);

  const triggeredAlerts = results.filter((r) => r.result.triggered);
  
  // Categorize by severity (you can customize this)
  const criticalRules = ['sync_processing', 'ledger_balance'];
  const criticalCount = triggeredAlerts.filter((a) => criticalRules.includes(a.rule)).length;
  const warningCount = triggeredAlerts.length - criticalCount;

  logger.info(
    {
      total: results.length,
      triggered: triggeredAlerts.length,
      critical: criticalCount,
      warning: warningCount,
    },
    'Alert evaluation complete'
  );

  return {
    alerts: results,
    criticalCount,
    warningCount,
  };
}

/**
 * Get alert rule definitions
 */
export function getAlertRules(): AlertRule[] {
  return [
    {
      id: 'failure_rate',
      name: 'High Failure Rate',
      description: 'Sync failure rate exceeds 5% in the last hour',
      severity: 'warning',
      enabled: true,
      checkInterval: 15, // Check every 15 minutes
      condition: checkFailureRate,
    },
    {
      id: 'stuck_links',
      name: 'Stuck Payment Links',
      description: 'Payment links in OPEN status for more than 24 hours',
      severity: 'warning',
      enabled: true,
      checkInterval: 60, // Check every hour
      condition: checkStuckPaymentLinks,
    },
    {
      id: 'queue_backlog',
      name: 'Large Queue Backlog',
      description: 'Pending/retrying queue exceeds 100 items',
      severity: 'warning',
      enabled: true,
      checkInterval: 30, // Check every 30 minutes
      condition: checkQueueBacklog,
    },
    {
      id: 'sync_processing',
      name: 'No Syncs Processed',
      description: 'No syncs processed in the last 5 minutes',
      severity: 'critical',
      enabled: true,
      checkInterval: 5, // Check every 5 minutes
      condition: checkSyncProcessing,
    },
    {
      id: 'high_retry',
      name: 'High Retry Count',
      description: 'Syncs with retry count greater than 3',
      severity: 'warning',
      enabled: true,
      checkInterval: 30, // Check every 30 minutes
      condition: checkHighRetryCount,
    },
    {
      id: 'ledger_balance',
      name: 'Ledger Imbalance',
      description: 'Ledger entries do not balance (DR != CR)',
      severity: 'critical',
      enabled: true,
      checkInterval: 60, // Check every hour
      condition: checkLedgerBalance,
    },
  ];
}







