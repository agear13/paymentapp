import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';

export type LedgerInvariantResult = {
  balanced: boolean;
  paymentLinkId: string;
  currency: string;
  debitTotal: string;
  creditTotal: string;
  difference: string;
};

export async function validateLedgerInvariant(
  paymentLinkId: string
): Promise<LedgerInvariantResult[]> {
  const rows = await prisma.ledger_entries.groupBy({
    by: ['currency', 'entry_type'],
    where: { payment_link_id: paymentLinkId },
    _sum: { amount: true },
  });

  const byCurrency = new Map<
    string,
    { debit: Prisma.Decimal; credit: Prisma.Decimal }
  >();

  for (const row of rows) {
    const currency = row.currency;
    const existing =
      byCurrency.get(currency) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };

    const amount = row._sum.amount ?? new Prisma.Decimal(0);
    if (row.entry_type === 'DEBIT') {
      existing.debit = existing.debit.add(amount);
    } else {
      existing.credit = existing.credit.add(amount);
    }
    byCurrency.set(currency, existing);
  }

  const results: LedgerInvariantResult[] = Array.from(byCurrency.entries()).map(
    ([currency, totals]) => {
      const diff = totals.debit.minus(totals.credit);
      const balanced = diff.eq(0);
      return {
        balanced,
        paymentLinkId,
        currency,
        debitTotal: totals.debit.toString(),
        creditTotal: totals.credit.toString(),
        difference: diff.toString(),
      };
    }
  );

  for (const r of results) {
    if (!r.balanced) {
      loggers.ledger.error('Ledger invariant imbalance detected', undefined, {
        paymentLinkId: r.paymentLinkId,
        currency: r.currency,
        debitTotal: r.debitTotal,
        creditTotal: r.creditTotal,
        difference: r.difference,
      });
    }
  }

  return results;
}

