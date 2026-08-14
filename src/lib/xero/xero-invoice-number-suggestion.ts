/**
 * Pure helpers for inferring the next Xero ACCREC invoice number from recent numbers.
 * MVP: single dominant prefix only — no multi-prefix guessing.
 */

/** Printable ASCII prefix + numeric suffix (e.g. INV-00483, ORD-1045). */
const NUMBER_PATTERN = /^([A-Za-z0-9][A-Za-z0-9-]*?)(\d+)$/;

export type ParsedInvoiceNumber = {
  prefix: string;
  numeric: number;
  numericRaw: string;
  full: string;
};

export type XeroInvoiceNumberSuggestionResult =
  | {
      ok: true;
      suggestedNumber: string;
      prefix: string;
      nextSequence: number;
      padWidth: number;
    }
  | {
      ok: false;
      reason: 'no_numbers' | 'unparseable' | 'ambiguous_prefixes';
      prefixes?: string[];
    };

export function parseXeroStyleInvoiceNumber(value: string): ParsedInvoiceNumber | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 255) return null;
  const match = NUMBER_PATTERN.exec(trimmed);
  if (!match) return null;
  const prefix = match[1];
  const numericRaw = match[2];
  const numeric = Number.parseInt(numericRaw, 10);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return { prefix, numeric, numericRaw, full: trimmed };
}

export function formatNextInvoiceNumber(
  prefix: string,
  nextNumeric: number,
  padWidth: number
): string {
  const width = Math.max(padWidth, String(nextNumeric).length);
  return `${prefix}${String(nextNumeric).padStart(width, '0')}`;
}

/**
 * Infer the next invoice number when a single prefix dominates recent Xero ACCREC numbers.
 */
export function inferNextXeroInvoiceNumber(
  invoiceNumbers: readonly string[]
): XeroInvoiceNumberSuggestionResult {
  const parsed = invoiceNumbers
    .map((n) => parseXeroStyleInvoiceNumber(n))
    .filter((p): p is ParsedInvoiceNumber => p != null);

  if (parsed.length === 0) {
    return invoiceNumbers.length === 0
      ? { ok: false, reason: 'no_numbers' }
      : { ok: false, reason: 'unparseable' };
  }

  const byPrefix = new Map<string, ParsedInvoiceNumber[]>();
  for (const row of parsed) {
    const list = byPrefix.get(row.prefix) ?? [];
    list.push(row);
    byPrefix.set(row.prefix, list);
  }

  if (byPrefix.size > 1) {
    return {
      ok: false,
      reason: 'ambiguous_prefixes',
      prefixes: [...byPrefix.keys()].sort(),
    };
  }

  const [prefix, rows] = [...byPrefix.entries()][0]!;
  const maxNumeric = rows.reduce((max, row) => Math.max(max, row.numeric), 0);
  const padWidth = rows.reduce((max, row) => Math.max(max, row.numericRaw.length), 1);
  const nextSequence = maxNumeric + 1;

  return {
    ok: true,
    suggestedNumber: formatNextInvoiceNumber(prefix, nextSequence, padWidth),
    prefix,
    nextSequence,
    padWidth,
  };
}

/** Whether a merchant-entered value is eligible to be sent as Xero InvoiceNumber on create. */
export function isEligibleXeroInvoiceNumberCandidate(value: string | null | undefined): boolean {
  return parseXeroStyleInvoiceNumber(value ?? '') != null;
}
