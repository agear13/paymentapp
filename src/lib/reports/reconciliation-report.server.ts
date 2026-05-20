import { prisma } from '@/lib/server/prisma';

export const RECONCILIATION_TOLERANCE = 0.01;

export type ReconciliationRailKey =
  | 'stripe'
  | 'hedera_hbar'
  | 'hedera_usdc'
  | 'hedera_usdt'
  | 'hedera_audd';

export type ReconciliationRailItem = {
  expectedRevenue: number;
  ledgerBalance: number;
  difference: number;
  paymentCount: number;
};

export type ReconciliationReportData = {
  report: Record<ReconciliationRailKey, ReconciliationRailItem>;
  isReconciled: boolean;
  totalDifference: number;
  timestamp: string;
};

const HEDERA_RAILS: ReconciliationRailKey[] = [
  'hedera_hbar',
  'hedera_usdc',
  'hedera_usdt',
  'hedera_audd',
];

export function isRailBalanced(difference: number): boolean {
  return Math.abs(difference) < RECONCILIATION_TOLERANCE;
}

export function areHederaRailsBalanced(
  report: ReconciliationReportData['report']
): boolean {
  return HEDERA_RAILS.every((key) => isRailBalanced(report[key].difference));
}

/**
 * Compare expected revenue (paid payment links) with ledger clearing balances.
 */
export async function buildReconciliationReport(
  organizationId: string
): Promise<ReconciliationReportData> {
  const confirmedPayments = await prisma.payment_links.findMany({
    where: {
      organization_id: organizationId,
      status: 'PAID',
    },
    include: {
      payment_events: {
        where: {
          event_type: 'PAYMENT_CONFIRMED',
        },
      },
      ledger_entries: true,
    },
  });

  const report: ReconciliationReportData['report'] = {
    stripe: {
      expectedRevenue: 0,
      ledgerBalance: 0,
      difference: 0,
      paymentCount: 0,
    },
    hedera_hbar: {
      expectedRevenue: 0,
      ledgerBalance: 0,
      difference: 0,
      paymentCount: 0,
    },
    hedera_usdc: {
      expectedRevenue: 0,
      ledgerBalance: 0,
      difference: 0,
      paymentCount: 0,
    },
    hedera_usdt: {
      expectedRevenue: 0,
      ledgerBalance: 0,
      difference: 0,
      paymentCount: 0,
    },
    hedera_audd: {
      expectedRevenue: 0,
      ledgerBalance: 0,
      difference: 0,
      paymentCount: 0,
    },
  };

  const accounts = await prisma.ledger_accounts.findMany({
    where: {
      organization_id: organizationId,
      code: {
        in: ['1050', '1051', '1052', '1053', '1054'],
      },
    },
    include: {
      ledger_entries: true,
    },
  });

  const accountBalances: Record<string, number> = {};
  for (const account of accounts) {
    let balance = 0;
    for (const entry of account.ledger_entries) {
      const amount = parseFloat(entry.amount.toString());
      if (entry.entry_type === 'DEBIT') {
        balance += amount;
      } else {
        balance -= amount;
      }
    }
    accountBalances[account.code] = balance;
  }

  for (const payment of confirmedPayments) {
    const paymentEvent = payment.payment_events[0];
    if (!paymentEvent) continue;

    const amount = parseFloat(payment.amount.toString());
    const method = paymentEvent.payment_method;

    if (method === 'STRIPE') {
      report.stripe.expectedRevenue += amount;
      report.stripe.paymentCount++;
    } else if (method === 'HEDERA') {
      const metadata = paymentEvent.metadata as Record<string, unknown> | null;
      const tokenType = (metadata?.tokenType ?? metadata?.token_type) as string | undefined;

      if (tokenType === 'HBAR') {
        report.hedera_hbar.expectedRevenue += amount;
        report.hedera_hbar.paymentCount++;
      } else if (tokenType === 'USDC') {
        report.hedera_usdc.expectedRevenue += amount;
        report.hedera_usdc.paymentCount++;
      } else if (tokenType === 'USDT') {
        report.hedera_usdt.expectedRevenue += amount;
        report.hedera_usdt.paymentCount++;
      } else if (tokenType === 'AUDD') {
        report.hedera_audd.expectedRevenue += amount;
        report.hedera_audd.paymentCount++;
      }
    }
  }

  report.stripe.ledgerBalance = accountBalances['1050'] || 0;
  report.hedera_hbar.ledgerBalance = accountBalances['1051'] || 0;
  report.hedera_usdc.ledgerBalance = accountBalances['1052'] || 0;
  report.hedera_usdt.ledgerBalance = accountBalances['1053'] || 0;
  report.hedera_audd.ledgerBalance = accountBalances['1054'] || 0;

  for (const key of Object.keys(report) as ReconciliationRailKey[]) {
    report[key].difference = report[key].expectedRevenue - report[key].ledgerBalance;
  }

  const totalDifference =
    Math.abs(report.stripe.difference) +
    Math.abs(report.hedera_hbar.difference) +
    Math.abs(report.hedera_usdc.difference) +
    Math.abs(report.hedera_usdt.difference) +
    Math.abs(report.hedera_audd.difference);

  const isReconciled = totalDifference < RECONCILIATION_TOLERANCE;

  return {
    report,
    isReconciled,
    totalDifference,
    timestamp: new Date().toISOString(),
  };
}
