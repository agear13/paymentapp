/**
 * Data Repair Utilities
 * 
 * Automated utilities for detecting and repairing data inconsistencies:
 * - Orphaned payment records
 * - Missing ledger entries
 * - Missing Xero sync records
 * - Ledger imbalances
 * - Stale payment links
 * 
 * Sprint 24: Comprehensive data integrity maintenance
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { retryLedgerPosting, hasLedgerEntries } from '@/lib/hedera/payment-confirmation';
import { queueXeroSync } from '@/lib/xero/queue-service';
import type { PaymentLinkStatus } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface OrphanedPayment {
  id: string;
  amount: string;
  currency: string;
  status: PaymentLinkStatus;
  created_at: Date;
  issues: string[];
  canAutoRepair: boolean;
}

export interface RepairResult {
  success: boolean;
  repaired: number;
  failed: number;
  errors: string[];
}

export interface ConsistencyCheckResult {
  totalChecked: number;
  issuesFound: number;
  issues: Array<{
    paymentLinkId: string;
    issueType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    canAutoRepair: boolean;
  }>;
}

// ============================================================================
// Orphan Detection
// ============================================================================

/**
 * Find all orphaned payment records
 * 
 * An orphaned payment is a PAID link that:
 * - Has no ledger entries, OR
 * - Has no successful Xero sync, OR
 * - Has ledger imbalance
 */
export async function findOrphanedPayments(
  organizationId: string
): Promise<OrphanedPayment[]> {
  log.info({ organizationId }, 'Scanning for orphaned payments');

  // Get all PAID payment links
  const paidLinks = await prisma.payment_links.findMany({
    where: {
      organization_id: organizationId,
      status: 'PAID',
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      created_at: true,
      ledger_entries: {
        select: { id: true, entry_type: true, amount: true },
      },
      xero_syncs: {
        where: { status: 'SUCCESS' },
        select: { id: true },
      },
    },
  });

  const orphans: OrphanedPayment[] = [];

  for (const link of paidLinks) {
    const issues: string[] = [];
    let canAutoRepair = true;

    // Check for missing ledger entries
    if (link.ledger_entries.length === 0) {
      issues.push('NO_LEDGER_ENTRIES');
    } else {
      // Check ledger balance
      const debits = link.ledger_entries
        .filter((e) => e.entry_type === 'DEBIT')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const credits = link.ledger_entries
        .filter((e) => e.entry_type === 'CREDIT')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      if (Math.abs(debits - credits) > 0.01) {
        issues.push('LEDGER_IMBALANCE');
        canAutoRepair = false; // Imbalances need manual review
      }
    }

    // Check for missing Xero sync
    if (link.xero_syncs.length === 0) {
      issues.push('NO_XERO_SYNC');
    }

    if (issues.length > 0) {
      orphans.push({
        id: link.id,
        amount: link.amount.toString(),
        currency: link.currency,
        status: link.status,
        created_at: link.created_at,
        issues,
        canAutoRepair,
      });
    }
  }

  log.info(
    { organizationId, orphanCount: orphans.length },
    'Orphan scan complete'
  );

  return orphans;
}

// ============================================================================
// Automated Repair
// ============================================================================

/**
 * Repair orphaned payments automatically
 * 
 * Attempts to:
 * 1. Create missing ledger entries
 * 2. Queue missing Xero syncs
 */
export async function repairOrphanedPayments(
  organizationId: string,
  dryRun: boolean = false
): Promise<RepairResult> {
  log.info(
    { organizationId, dryRun },
    'Starting orphan repair process'
  );

  const orphans = await findOrphanedPayments(organizationId);
  const autoRepairableOrphans = orphans.filter((o) => o.canAutoRepair);

  let repaired = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const orphan of autoRepairableOrphans) {
    try {
      if (dryRun) {
        log.info(
          { paymentLinkId: orphan.id, issues: orphan.issues },
          '[DRY RUN] Would repair orphan'
        );
        continue;
      }

      // Repair missing ledger entries
      if (orphan.issues.includes('NO_LEDGER_ENTRIES')) {
        log.info({ paymentLinkId: orphan.id }, 'Repairing missing ledger entries');
        await retryLedgerPosting(orphan.id);
      }

      // Repair missing Xero sync
      if (orphan.issues.includes('NO_XERO_SYNC')) {
        log.info({ paymentLinkId: orphan.id }, 'Queuing Xero sync');
        await queueXeroSync({
          paymentLinkId: orphan.id,
          organizationId,
        });
      }

      repaired++;
      log.info({ paymentLinkId: orphan.id }, 'Orphan repaired successfully');
    } catch (error: any) {
      failed++;
      const errorMsg = `Failed to repair ${orphan.id}: ${error.message}`;
      errors.push(errorMsg);
      log.error(
        { paymentLinkId: orphan.id, error: error.message },
        'Failed to repair orphan'
      );
    }
  }

  const result: RepairResult = {
    success: failed === 0,
    repaired,
    failed,
    errors,
  };

  log.info(result, 'Orphan repair process complete');
  return result;
}

// ============================================================================
// Comprehensive Consistency Checks
// ============================================================================

/**
 * Run comprehensive data consistency checks
 */
export async function runConsistencyChecks(
  organizationId: string
): Promise<ConsistencyCheckResult> {
  log.info({ organizationId }, 'Running comprehensive consistency checks');

  const issues: ConsistencyCheckResult['issues'] = [];

  // 1. Check for PAID links without payment events
  const paidWithoutEvents = await prisma.payment_links.findMany({
    where: {
      organization_id: organizationId,
      status: 'PAID',
      payment_events: {
        none: {
          event_type: 'PAYMENT_CONFIRMED',
        },
      },
    },
    select: { id: true },
  });

  for (const link of paidWithoutEvents) {
    issues.push({
      paymentLinkId: link.id,
      issueType: 'MISSING_PAYMENT_EVENT',
      severity: 'HIGH',
      description: 'Payment link marked as PAID but has no PAYMENT_CONFIRMED event',
      canAutoRepair: false,
    });
  }

  // 2. Check for payment events without corresponding link status
  const confirmedEventsNotPaid = await prisma.payment_events.findMany({
    where: {
      event_type: 'PAYMENT_CONFIRMED',
      payment_links: {
        organization_id: organizationId,
        status: { not: 'PAID' },
      },
    },
    select: {
      id: true,
      payment_link_id: true,
      payment_links: { select: { status: true } },
    },
  });

  for (const event of confirmedEventsNotPaid) {
    issues.push({
      paymentLinkId: event.payment_link_id,
      issueType: 'STATUS_MISMATCH',
      severity: 'CRITICAL',
      description: `Has PAYMENT_CONFIRMED event but status is ${event.payment_links.status}`,
      canAutoRepair: true,
    });
  }

  // 3. Check for missing FX snapshots on PAID links
  const paidLinksWithSnapshots = await prisma.payment_links.findMany({
    where: {
      organization_id: organizationId,
      status: 'PAID',
    },
    select: {
      id: true,
      fx_snapshots: {
        where: { snapshot_type: 'SETTLEMENT' },
        select: { id: true },
      },
    },
  });

  for (const link of paidLinksWithSnapshots) {
    if (link.fx_snapshots.length === 0) {
      issues.push({
        paymentLinkId: link.id,
        issueType: 'MISSING_FX_SNAPSHOT',
        severity: 'MEDIUM',
        description: 'PAID link has no SETTLEMENT FX snapshot',
        canAutoRepair: false,
      });
    }
  }

  // 4. Check for expired links still marked as OPEN
  const expiredButOpen = await prisma.payment_links.findMany({
    where: {
      organization_id: organizationId,
      status: 'OPEN',
      expires_at: {
        lt: new Date(),
      },
    },
    select: { id: true, expires_at: true },
  });

  for (const link of expiredButOpen) {
    issues.push({
      paymentLinkId: link.id,
      issueType: 'STALE_EXPIRY',
      severity: 'LOW',
      description: `Link expired at ${link.expires_at?.toISOString()} but still marked OPEN`,
      canAutoRepair: true,
    });
  }

  // 5. Check ledger balances
  const ledgerChecks = await prisma.payment_links.findMany({
    where: {
      organization_id: organizationId,
      status: 'PAID',
      ledger_entries: {
        some: {},
      },
    },
    select: {
      id: true,
      ledger_entries: {
        select: {
          entry_type: true,
          amount: true,
        },
      },
    },
  });

  for (const link of ledgerChecks) {
    const debits = link.ledger_entries
      .filter((e) => e.entry_type === 'DEBIT')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const credits = link.ledger_entries
      .filter((e) => e.entry_type === 'CREDIT')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    if (Math.abs(debits - credits) > 0.01) {
      issues.push({
        paymentLinkId: link.id,
        issueType: 'LEDGER_IMBALANCE',
        severity: 'CRITICAL',
        description: `Ledger imbalance: DR=${debits.toFixed(2)}, CR=${credits.toFixed(2)}, variance=${(debits - credits).toFixed(2)}`,
        canAutoRepair: false,
      });
    }
  }

  // 6. Check for duplicate short codes
  const duplicateShortCodes = await prisma.$queryRaw<
    Array<{ short_code: string; count: bigint }>
  >`
    SELECT short_code, COUNT(*) as count
    FROM payment_links
    WHERE organization_id = ${organizationId}::uuid
    GROUP BY short_code
    HAVING COUNT(*) > 1
  `;

  for (const dup of duplicateShortCodes) {
    const links = await prisma.payment_links.findMany({
      where: {
        organization_id: organizationId,
        short_code: dup.short_code,
      },
      select: { id: true },
    });

    for (const link of links) {
      issues.push({
        paymentLinkId: link.id,
        issueType: 'DUPLICATE_SHORT_CODE',
        severity: 'HIGH',
        description: `Duplicate short code: ${dup.short_code}`,
        canAutoRepair: false,
      });
    }
  }

  const result: ConsistencyCheckResult = {
    totalChecked: 6,
    issuesFound: issues.length,
    issues,
  };

  log.info(
    {
      organizationId,
      totalChecked: result.totalChecked,
      issuesFound: result.issuesFound,
      critical: issues.filter((i) => i.severity === 'CRITICAL').length,
      high: issues.filter((i) => i.severity === 'HIGH').length,
      medium: issues.filter((i) => i.severity === 'MEDIUM').length,
      low: issues.filter((i) => i.severity === 'LOW').length,
    },
    'Consistency checks complete'
  );

  return result;
}

// ============================================================================
// Automated Consistency Repair
// ============================================================================

/**
 * Attempt to auto-repair consistency issues
 */
export async function repairConsistencyIssues(
  organizationId: string,
  dryRun: boolean = false
): Promise<RepairResult> {
  log.info(
    { organizationId, dryRun },
    'Starting consistency issue repair'
  );

  const checkResult = await runConsistencyChecks(organizationId);
  const repairableIssues = checkResult.issues.filter((i) => i.canAutoRepair);

  let repaired = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const issue of repairableIssues) {
    try {
      if (dryRun) {
        log.info(
          { paymentLinkId: issue.paymentLinkId, issueType: issue.issueType },
          '[DRY RUN] Would repair issue'
        );
        continue;
      }

      if (issue.issueType === 'STATUS_MISMATCH') {
        // Fix status mismatch - update to PAID
        await prisma.payment_links.update({
          where: { id: issue.paymentLinkId },
          data: { status: 'PAID', updated_at: new Date() },
        });
        repaired++;
      } else if (issue.issueType === 'STALE_EXPIRY') {
        // Fix stale expiry - update to EXPIRED
        await prisma.payment_links.update({
          where: { id: issue.paymentLinkId },
          data: { status: 'EXPIRED', updated_at: new Date() },
        });
        repaired++;
      }

      log.info(
        { paymentLinkId: issue.paymentLinkId, issueType: issue.issueType },
        'Issue repaired successfully'
      );
    } catch (error: any) {
      failed++;
      const errorMsg = `Failed to repair ${issue.paymentLinkId} (${issue.issueType}): ${error.message}`;
      errors.push(errorMsg);
      log.error(
        {
          paymentLinkId: issue.paymentLinkId,
          issueType: issue.issueType,
          error: error.message,
        },
        'Failed to repair issue'
      );
    }
  }

  const result: RepairResult = {
    success: failed === 0,
    repaired,
    failed,
    errors,
  };

  log.info(result, 'Consistency repair process complete');
  return result;
}

// ============================================================================
// Maintenance Utilities
// ============================================================================

/**
 * Run full maintenance cycle
 * 
 * 1. Consistency checks
 * 2. Orphan detection
 * 3. Auto-repair (if enabled)
 */
export async function runMaintenanceCycle(
  organizationId: string,
  options: {
    autoRepair?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<{
  consistencyCheck: ConsistencyCheckResult;
  orphanRepair?: RepairResult;
  consistencyRepair?: RepairResult;
}> {
  const { autoRepair = false, dryRun = false } = options;

  log.info(
    { organizationId, autoRepair, dryRun },
    'Starting maintenance cycle'
  );

  // Run consistency checks
  const consistencyCheck = await runConsistencyChecks(organizationId);

  let orphanRepair: RepairResult | undefined;
  let consistencyRepair: RepairResult | undefined;

  if (autoRepair) {
    // Repair orphans
    orphanRepair = await repairOrphanedPayments(organizationId, dryRun);

    // Repair consistency issues
    consistencyRepair = await repairConsistencyIssues(organizationId, dryRun);
  }

  log.info(
    {
      organizationId,
      issuesFound: consistencyCheck.issuesFound,
      orphansRepaired: orphanRepair?.repaired || 0,
      consistencyIssuesRepaired: consistencyRepair?.repaired || 0,
    },
    'Maintenance cycle complete'
  );

  return {
    consistencyCheck,
    orphanRepair,
    consistencyRepair,
  };
}







