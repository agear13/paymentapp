/**
 * Observability helpers for Wise account-details API responses.
 * Does not affect resolution, mapping, or payer-instruction logic.
 */

import { loggers } from '@/lib/logger';
import type { WiseAccountDetailsEntry } from '@/lib/wise/wise-account-details';

const SENSITIVE_DETAIL_TYPES = new Set([
  'IBAN',
  'ACCOUNT_NUMBER',
  'BSB',
  'SORT_CODE',
  'ROUTING_NUMBER',
  'SWIFT_CODE',
  'BIC',
  'SWIFT/BIC',
  'BANK_CODE',
]);

function maskDetailBody(type: string, body?: string): string | undefined {
  if (body == null || body === '') return body;
  const normalized = type.toUpperCase();
  if (!SENSITIVE_DETAIL_TYPES.has(normalized) && !normalized.includes('ACCOUNT')) {
    return body;
  }
  const compact = body.replace(/\s/g, '');
  if (compact.length <= 4) return '****';
  return `${compact.slice(0, 2)}***${compact.slice(-2)}`;
}

/** Redact payer-sensitive fields while preserving status / structure for diagnostics. */
export function maskAccountDetailsEntriesForLog(
  entries: WiseAccountDetailsEntry[]
): Record<string, unknown>[] {
  return entries.map((entry) => ({
    id: entry.id,
    currency: entry.currency,
    status: entry.status,
    deprecated: entry.deprecated ?? false,
    title: entry.title ?? null,
    subtitle: entry.subtitle ?? null,
    receiveOptions: (entry.receiveOptions ?? []).map((option) => ({
      type: option.type,
      title: option.title ?? null,
      details: (option.details ?? []).map((detail) => ({
        type: detail.type,
        title: detail.title ?? null,
        body: maskDetailBody(detail.type, detail.body),
        hidden: detail.hidden ?? false,
      })),
    })),
  }));
}

/**
 * Log masked account-details payload (currency.code, status, receiveOptions, etc.).
 */
export function logMaskedAccountDetailsAudit(input: {
  profileId: string;
  requestedCurrency: string;
  entries: WiseAccountDetailsEntry[];
  source: string;
}): void {
  const masked = maskAccountDetailsEntriesForLog(input.entries);
  const matching = masked.filter(
    (entry) =>
      String((entry.currency as { code?: string } | undefined)?.code ?? '').toUpperCase() ===
      input.requestedCurrency.trim().toUpperCase()
  );

  loggers.payment.info(
    {
      wiseAccountDetailsAudit: true,
      source: input.source,
      profileId: input.profileId,
      requestedCurrency: input.requestedCurrency.toUpperCase(),
      entryCount: masked.length,
      matchingCurrencyEntries: matching,
      allEntriesSummary: masked.map((entry) => ({
        currencyCode: (entry.currency as { code?: string } | undefined)?.code ?? null,
        status: entry.status,
        deprecated: entry.deprecated,
        id: entry.id,
        receiveOptionTypes: (entry.receiveOptions as Array<{ type?: string }> | undefined)?.map(
          (option) => option.type
        ),
      })),
      fullMaskedPayload: masked,
    },
    'WISE_ACCOUNT_DETAILS_AUDIT masked account-details response'
  );
}
