/**
 * Provvy payment reference helpers for Wise bank-transfer correlation.
 * Reference format: PROVVY-{shortCode} (8-char short code).
 */

import { isValidShortCode } from '@/lib/short-code';

export const PROVVY_WISE_REFERENCE_PREFIX = 'PROVVY-';

export function buildProvvyWiseReference(shortCode: string): string {
  return `${PROVVY_WISE_REFERENCE_PREFIX}${shortCode}`;
}

/** Extract payment-link short code from a Wise transfer reference (case-insensitive). */
export function parseProvvyPaymentReference(
  reference: string | null | undefined
): string | null {
  if (!reference || typeof reference !== 'string') {
    return null;
  }

  const trimmed = reference.trim();
  const match = trimmed.match(/PROVVY[-_\s]?([A-Za-z0-9_-]{8})/i);
  if (!match?.[1]) {
    return null;
  }

  const shortCode = match[1];
  return isValidShortCode(shortCode) ? shortCode : null;
}
