/**
 * Bank settlement view — consumes payment_settlements, not bank feeds.
 */

import type { BankSettlementView } from '@/lib/commercial-reconciliation/types';

export type SettlementRecordInput = {
  status: string;
  settledAt?: Date | string | null;
  reference?: string | null;
  provider?: string | null;
};

/** Map payment settlement records to bank settlement view. */
export function deriveBankSettlement(
  settlements: SettlementRecordInput[]
): BankSettlementView | null {
  if (settlements.length === 0) return null;

  const settled = settlements.find(
    (s) => s.status === 'SETTLED' || s.status === 'RECONCILED'
  );
  if (settled) {
    const settledAt =
      settled.settledAt instanceof Date
        ? settled.settledAt.toISOString()
        : settled.settledAt ?? null;
    return {
      status: 'cleared',
      settledAt,
      reference: settled.reference ?? null,
      provider: settled.provider ?? null,
    };
  }

  const failed = settlements.find((s) => s.status === 'FAILED');
  if (failed) {
    return {
      status: 'failed',
      settledAt: null,
      reference: failed.reference ?? null,
      provider: failed.provider ?? null,
    };
  }

  const pending = settlements[0];
  return {
    status: 'pending',
    settledAt: null,
    reference: pending?.reference ?? null,
    provider: pending?.provider ?? null,
  };
}

/** Aggregate bank settlement from multiple settlement rows — prefer most advanced. */
export function deriveBankSettlementFromList(
  settlements: SettlementRecordInput[]
): BankSettlementView | null {
  if (settlements.length === 0) return null;

  const byPriority = [...settlements].sort((a, b) => {
    const rank = (s: string) =>
      s === 'RECONCILED' ? 4 : s === 'SETTLED' ? 3 : s === 'IN_PROGRESS' ? 2 : s === 'FAILED' ? 0 : 1;
    return rank(b.status) - rank(a.status);
  });

  return deriveBankSettlement(byPriority);
}
