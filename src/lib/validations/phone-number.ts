/**
 * Phone number parsing for invoice / payment-link customer contact fields.
 * Accepts common Australian formats and normalizes to E.164 for storage.
 */

export const PHONE_VALIDATION_MESSAGE =
  'Enter a valid phone number (e.g. 0412 345 678 or +61412345678).';

/** E.164: + followed by 1–15 digits, first digit non-zero. */
const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

/** Australian national number after removing trunk 0: [23478] + 8 digits (10 digits total with 0). */
const AU_LOCAL_PATTERN = /^0([23478]\d{8})$/;

/** Australian country code without +: 61 + 9-digit national number. */
const AU_INTERNATIONAL_NO_PLUS_PATTERN = /^61([23478]\d{8})$/;

export function stripPhoneFormatting(phone: string): string {
  return phone.trim().replace(/[\s().-]/g, '');
}

export function isValidE164Phone(phone: string): boolean {
  return E164_PATTERN.test(phone);
}

/**
 * Normalize a phone input to E.164 when it is a valid Australian or international number.
 * Returns null for empty/invalid input — never blindly prepends +61.
 */
export function normalizePhoneToE164(phone: string): string | null {
  if (!phone || typeof phone !== 'string') return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  const compact = stripPhoneFormatting(trimmed);
  if (!compact || compact.length > 50) return null;

  // Already E.164 (any country)
  if (compact.startsWith('+')) {
    return isValidE164Phone(compact) ? compact : null;
  }

  // Digits only from here — reject mixed/alphanumeric garbage early
  if (!/^\d+$/.test(compact)) return null;

  // Australian international without +: 61412345678
  const auIntl = compact.match(AU_INTERNATIONAL_NO_PLUS_PATTERN);
  if (auIntl) {
    const e164 = `+61${auIntl[1]}`;
    return isValidE164Phone(e164) ? e164 : null;
  }

  // Australian local: 0412345678, 02 1234 5678, etc.
  const auLocal = compact.match(AU_LOCAL_PATTERN);
  if (auLocal) {
    const e164 = `+61${auLocal[1]}`;
    return isValidE164Phone(e164) ? e164 : null;
  }

  return null;
}
