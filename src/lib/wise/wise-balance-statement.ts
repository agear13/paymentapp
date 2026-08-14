/**
 * Wise Balance Statement API — retrieve customer payment reference for incoming transfers.
 *
 * Documented contract (Wise API reference, balancestatementget):
 *   GET /v1/profiles/{profileId}/balance-statements/{balanceId}/statement.json
 *   Query: currency (required), intervalStart (required), intervalEnd (required), type?, statementLocale?
 *
 * Lookup strategy (Wise receive-money guide):
 *   Cross-reference incoming transfer id with transactions[].referenceNumber prefixed TRANSFER-{id}.
 *
 * Customer payment reference field:
 *   transactions[].details.paymentReference — "Deposit payment reference text" (sender-provided).
 */

import { wiseFetchV1 } from '@/lib/wise/wise-http';

export type WiseBalanceStatementTransaction = {
  type: 'DEBIT' | 'CREDIT';
  date: string;
  amount: {
    value: number;
    currency: string;
  };
  details?: {
    type?: string;
    paymentReference?: string;
    senderName?: string;
    senderAccount?: string;
  };
  referenceNumber?: string;
};

export type WiseBalanceStatementResponse = {
  transactions?: WiseBalanceStatementTransaction[];
  query?: {
    intervalStart?: string;
    intervalEnd?: string;
    currency?: string;
    accountId?: number;
  };
};

/** Wise prefixes swift-in / incoming transfer ids in statement referenceNumber. */
export function wiseStatementReferenceNumberForTransfer(
  transferId: string | number
): string {
  return `TRANSFER-${transferId}`;
}

function parseOccurredAt(iso?: string | null): Date | null {
  if (!iso?.trim()) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

/** Statement interval around webhook occurred_at (fallback: last 7 days). Max 469 days per Wise. */
export function buildBalanceStatementInterval(occurredAt?: string | null): {
  intervalStart: string;
  intervalEnd: string;
} {
  const anchor = parseOccurredAt(occurredAt) ?? new Date();
  const start = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(Math.max(anchor.getTime() + 60 * 60 * 1000, Date.now()));
  return {
    intervalStart: start.toISOString(),
    intervalEnd: end.toISOString(),
  };
}

export async function getBalanceStatement(input: {
  profileId: string | number;
  balanceId: string | number;
  currency: string;
  intervalStart: string;
  intervalEnd: string;
  type?: 'COMPACT' | 'FLAT';
}): Promise<WiseBalanceStatementResponse> {
  const params = new URLSearchParams({
    currency: input.currency.trim().toUpperCase(),
    intervalStart: input.intervalStart,
    intervalEnd: input.intervalEnd,
    type: input.type ?? 'COMPACT',
    statementLocale: 'en',
  });

  return wiseFetchV1<WiseBalanceStatementResponse>(
    `/profiles/${input.profileId}/balance-statements/${input.balanceId}/statement.json?${params.toString()}`,
    {},
    {
      requestLabel: 'balance_statement',
      profileId: String(input.profileId),
      accountId: input.balanceId,
      currency: input.currency,
    }
  );
}

export function findStatementTransactionForTransferId(
  statement: WiseBalanceStatementResponse,
  transferId: string | number
): WiseBalanceStatementTransaction | null {
  const expectedRef = wiseStatementReferenceNumberForTransfer(transferId);
  const transactions = statement.transactions ?? [];

  const exact = transactions.find(
    (tx) =>
      tx.type === 'CREDIT' &&
      tx.referenceNumber?.trim().toUpperCase() === expectedRef.toUpperCase()
  );
  if (exact) return exact;

  // Some corridors may omit TRANSFER- prefix; match trailing numeric id only when unambiguous.
  const idStr = String(transferId);
  const candidates = transactions.filter(
    (tx) =>
      tx.type === 'CREDIT' &&
      (tx.referenceNumber === idStr ||
        tx.referenceNumber?.endsWith(`-${idStr}`) ||
        tx.referenceNumber?.includes(idStr))
  );
  if (candidates.length === 1) {
    return candidates[0] ?? null;
  }

  return null;
}

export async function fetchCustomerPaymentReferenceForTransfer(input: {
  profileId: string | number;
  balanceId: string | number;
  currency: string;
  transferId: string | number;
  occurredAt?: string | null;
}): Promise<{
  paymentReference: string | null;
  statementTransaction: WiseBalanceStatementTransaction | null;
  wiseTransferReferenceNumber: string;
}> {
  const interval = buildBalanceStatementInterval(input.occurredAt);
  const statement = await getBalanceStatement({
    profileId: input.profileId,
    balanceId: input.balanceId,
    currency: input.currency,
    intervalStart: interval.intervalStart,
    intervalEnd: interval.intervalEnd,
  });

  const statementTransaction = findStatementTransactionForTransferId(
    statement,
    input.transferId
  );
  const paymentReference = statementTransaction?.details?.paymentReference?.trim() ?? null;
  const wiseTransferReferenceNumber = wiseStatementReferenceNumberForTransfer(input.transferId);

  return {
    paymentReference,
    statementTransaction,
    wiseTransferReferenceNumber,
  };
}
