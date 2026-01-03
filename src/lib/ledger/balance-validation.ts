/**
 * Balance Validation
 * Automated checks to ensure ledger integrity (DR = CR)
 */

import { prisma } from '@/lib/server/prisma';
import { Prisma } from '@prisma/client';
import { loggers } from '@/lib/logger';

/**
 * Result of balance check
 */
export interface BalanceCheckResult {
  isBalanced: boolean;
  totalDebits: string;
  totalCredits: string;
  variance: string;
  entries: Array<{
    paymentLinkId: string;
    debits: string;
    credits: string;
    variance: string;
    isBalanced: boolean;
  }>;
}

/**
 * Check that all ledger entries balance (DR = CR) for an organization
 * 
 * @param organizationId - Organization ID to check
 * @returns Balance check result
 */
export async function checkLedgerBalance(
  organizationId: string
): Promise<BalanceCheckResult> {
  loggers.ledger.info({ organizationId }, 'Starting ledger balance check');

  // Get all entries for organization
  const entries = await prisma.ledger_entries.findMany({
    where: {
      ledger_accounts: {
        organization_id: organizationId,
      },
    },
    select: {
      payment_link_id: true,
      entry_type: true,
      amount: true,
    },
  });

  // Calculate totals
  const debits = entries
    .filter((e) => e.entry_type === 'DEBIT')
    .reduce((sum, e) => sum.add(e.amount), new Prisma.Decimal(0));

  const credits = entries
    .filter((e) => e.entry_type === 'CREDIT')
    .reduce((sum, e) => sum.add(e.amount), new Prisma.Decimal(0));

  // Group by payment link
  const byLink = groupEntriesByLink(entries);

  // Check if balanced (allow 0.01 variance for rounding)
  const variance = debits.minus(credits).abs();
  const isBalanced = variance.lessThanOrEqualTo(0.01);

  const result: BalanceCheckResult = {
    isBalanced,
    totalDebits: debits.toString(),
    totalCredits: credits.toString(),
    variance: variance.toString(),
    entries: byLink,
  };

  loggers.ledger.info(
    {
      organizationId,
      isBalanced,
      totalDebits: debits.toString(),
      totalCredits: credits.toString(),
      variance: variance.toString(),
    },
    'Ledger balance check complete'
  );

  if (!isBalanced) {
    loggers.ledger.error(
      {
        organizationId,
        variance: variance.toString(),
      },
      'LEDGER IMBALANCE DETECTED!'
    );
  }

  return result;
}

/**
 * Check balance for a specific payment link
 * 
 * @param paymentLinkId - Payment link ID to check
 * @returns Balance check result
 */
export async function checkPaymentLinkBalance(
  paymentLinkId: string
): Promise<BalanceCheckResult> {
  loggers.ledger.debug({ paymentLinkId }, 'Checking payment link balance');

  const entries = await prisma.ledger_entries.findMany({
    where: { payment_link_id: paymentLinkId },
    select: {
      payment_link_id: true,
      entry_type: true,
      amount: true,
    },
  });

  const debits = entries
    .filter((e) => e.entry_type === 'DEBIT')
    .reduce((sum, e) => sum.add(e.amount), new Prisma.Decimal(0));

  const credits = entries
    .filter((e) => e.entry_type === 'CREDIT')
    .reduce((sum, e) => sum.add(e.amount), new Prisma.Decimal(0));

  const variance = debits.minus(credits).abs();
  const isBalanced = variance.lessThanOrEqualTo(0.01);

  const result: BalanceCheckResult = {
    isBalanced,
    totalDebits: debits.toString(),
    totalCredits: credits.toString(),
    variance: variance.toString(),
    entries: [
      {
        paymentLinkId,
        debits: debits.toString(),
        credits: credits.toString(),
        variance: variance.toString(),
        isBalanced,
      },
    ],
  };

  if (!isBalanced) {
    loggers.ledger.warn(
      {
        paymentLinkId,
        debits: debits.toString(),
        credits: credits.toString(),
        variance: variance.toString(),
      },
      'Payment link has imbalanced entries'
    );
  }

  return result;
}

/**
 * Run balance check after each posting
 * Throws error if imbalance detected
 * 
 * @param paymentLinkId - Payment link ID to validate
 * @throws Error if entries don't balance
 */
export async function validatePostingBalance(paymentLinkId: string): Promise<void> {
  const result = await checkPaymentLinkBalance(paymentLinkId);

  if (!result.isBalanced) {
    const error = `Ledger imbalance detected for payment link ${paymentLinkId}: DR=${result.totalDebits}, CR=${result.totalCredits}, Variance=${result.variance}`;

    loggers.ledger.error(
      {
        paymentLinkId,
        result,
      },
      error
    );

    throw new Error(error);
  }
}

/**
 * Get account balances for an organization
 * Shows debit and credit totals per account
 * 
 * @param organizationId - Organization ID
 * @returns Array of account balances
 */
export async function getAccountBalances(organizationId: string) {
  const entries = await prisma.ledger_entries.findMany({
    where: {
      ledger_accounts: {
        organization_id: organizationId,
      },
    },
    include: {
      ledger_accounts: {
        select: {
          id: true,
          code: true,
          name: true,
          account_type: true,
        },
      },
    },
  });

  // Group by account
  const balances = new Map<
    string,
    {
      accountId: string;
      code: string;
      name: string;
      accountType: string;
      debits: Prisma.Decimal;
      credits: Prisma.Decimal;
      balance: Prisma.Decimal;
    }
  >();

  for (const entry of entries) {
    const accountId = entry.ledger_accounts.id;

    if (!balances.has(accountId)) {
      balances.set(accountId, {
        accountId,
        code: entry.ledger_accounts.code,
        name: entry.ledger_accounts.name,
        accountType: entry.ledger_accounts.account_type,
        debits: new Prisma.Decimal(0),
        credits: new Prisma.Decimal(0),
        balance: new Prisma.Decimal(0),
      });
    }

    const account = balances.get(accountId)!;

    if (entry.entry_type === 'DEBIT') {
      account.debits = account.debits.add(entry.amount);
    } else {
      account.credits = account.credits.add(entry.amount);
    }

    // Calculate balance (DR - CR for assets/expenses, CR - DR for liabilities/equity/revenue)
    if (['ASSET', 'EXPENSE'].includes(account.accountType)) {
      account.balance = account.debits.minus(account.credits);
    } else {
      account.balance = account.credits.minus(account.debits);
    }
  }

  return Array.from(balances.values()).map((account) => ({
    accountId: account.accountId,
    code: account.code,
    name: account.name,
    accountType: account.accountType,
    debits: account.debits.toString(),
    credits: account.credits.toString(),
    balance: account.balance.toString(),
  }));
}

/**
 * Find unbalanced payment links
 * Returns payment links where DR ≠ CR
 * 
 * @param organizationId - Organization ID
 * @returns Array of unbalanced payment link IDs
 */
export async function findUnbalancedPaymentLinks(
  organizationId: string
): Promise<string[]> {
  loggers.ledger.info({ organizationId }, 'Finding unbalanced payment links');

  const entries = await prisma.ledger_entries.findMany({
    where: {
      ledger_accounts: {
        organization_id: organizationId,
      },
    },
    select: {
      payment_link_id: true,
      entry_type: true,
      amount: true,
    },
  });

  const byLink = groupEntriesByLink(entries);
  const unbalanced = byLink.filter((link) => !link.isBalanced);

  if (unbalanced.length > 0) {
    loggers.ledger.warn(
      {
        organizationId,
        count: unbalanced.length,
        unbalanced,
      },
      'Found unbalanced payment links'
    );
  }

  return unbalanced.map((link) => link.paymentLinkId);
}

/**
 * Helper function to group entries by payment link
 * @private
 */
function groupEntriesByLink(entries: Array<{
  payment_link_id: string;
  entry_type: string;
  amount: Prisma.Decimal;
}>): Array<{
  paymentLinkId: string;
  debits: string;
  credits: string;
  variance: string;
  isBalanced: boolean;
}> {
  const grouped = entries.reduce((acc, entry) => {
    if (!acc[entry.payment_link_id]) {
      acc[entry.payment_link_id] = {
        debits: new Prisma.Decimal(0),
        credits: new Prisma.Decimal(0),
      };
    }

    if (entry.entry_type === 'DEBIT') {
      acc[entry.payment_link_id].debits = acc[entry.payment_link_id].debits.add(
        entry.amount
      );
    } else {
      acc[entry.payment_link_id].credits = acc[entry.payment_link_id].credits.add(
        entry.amount
      );
    }

    return acc;
  }, {} as Record<string, { debits: Prisma.Decimal; credits: Prisma.Decimal }>);

  return Object.entries(grouped).map(([paymentLinkId, totals]) => {
    const variance = totals.debits.minus(totals.credits).abs();
    const isBalanced = variance.lessThanOrEqualTo(0.01);

    return {
      paymentLinkId,
      debits: totals.debits.toString(),
      credits: totals.credits.toString(),
      variance: variance.toString(),
      isBalanced,
    };
  });
}

/**
 * Get ledger integrity report
 * Comprehensive report on ledger health
 * 
 * @param organizationId - Organization ID
 * @returns Integrity report
 */
export async function getLedgerIntegrityReport(organizationId: string) {
  const [balanceCheck, accountBalances, unbalancedLinks] = await Promise.all([
    checkLedgerBalance(organizationId),
    getAccountBalances(organizationId),
    findUnbalancedPaymentLinks(organizationId),
  ]);

  return {
    isHealthy: balanceCheck.isBalanced && unbalancedLinks.length === 0,
    overallBalance: {
      isBalanced: balanceCheck.isBalanced,
      totalDebits: balanceCheck.totalDebits,
      totalCredits: balanceCheck.totalCredits,
      variance: balanceCheck.variance,
    },
    accountBalances,
    unbalancedPaymentLinks: unbalancedLinks,
    summary: {
      totalAccounts: accountBalances.length,
      totalPaymentLinks: balanceCheck.entries.length,
      unbalancedCount: unbalancedLinks.length,
    },
  };
}






