/**
 * Resolve a payment link UUID from an invoice reference or short code.
 * Uses existing list API — no new backend endpoints.
 */

import { isPaymentLinkUuid } from '@/lib/payment-links/invoice-display-status';

type ListRow = {
  id: string;
  invoiceReference?: string | null;
  shortCode?: string | null;
};

function exactMatch(row: ListRow, reference: string): boolean {
  const key = reference.trim().toLowerCase();
  return (
    row.invoiceReference?.trim().toLowerCase() === key ||
    row.shortCode?.trim().toLowerCase() === key
  );
}

export async function resolvePaymentLinkId(options: {
  organizationId: string;
  reference: string;
  knownId?: string | null;
}): Promise<string | null> {
  const { organizationId, reference, knownId } = options;
  const trimmedRef = reference.trim();

  if (knownId && isPaymentLinkUuid(knownId)) {
    return knownId;
  }

  if (isPaymentLinkUuid(trimmedRef)) {
    return trimmedRef;
  }

  const params = new URLSearchParams({
    organizationId,
    search: trimmedRef,
    limit: '20',
  });
  const response = await fetch(`/api/payment-links?${params.toString()}`);
  if (!response.ok) return null;

  const result = (await response.json()) as { data?: ListRow[] };
  const rows = result.data ?? [];
  const matches = rows.filter((row) => exactMatch(row, trimmedRef));
  if (matches.length === 1) return matches[0]!.id;
  return null;
}
