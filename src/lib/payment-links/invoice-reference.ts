import type { Prisma } from '@prisma/client';

export const AUTO_INVOICE_REFERENCE_PREFIX = 'INV-';
export const AUTO_INVOICE_REFERENCE_PAD_LENGTH = 4;

export function normalizeInvoiceReference(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function formatAutoInvoiceReference(sequence: number): string {
  return `${AUTO_INVOICE_REFERENCE_PREFIX}${String(sequence).padStart(
    AUTO_INVOICE_REFERENCE_PAD_LENGTH,
    '0'
  )}`;
}

export async function getNextInvoiceReferenceSequence(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ max_sequence: number }>>`
    SELECT COALESCE(MAX((substring(invoice_reference from '^INV-([0-9]+)$'))::int), 0) AS max_sequence
    FROM payment_links
    WHERE organization_id = ${organizationId}::uuid
      AND invoice_reference ~ '^INV-[0-9]+$'
  `;
  const currentMax = Number(rows[0]?.max_sequence ?? 0);
  return currentMax + 1;
}
