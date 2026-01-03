/**
 * Short Code Validation Utilities (CLIENT-SAFE)
 * 
 * This module contains ONLY validation logic and constants.
 * No database access - safe to import in client components.
 * 
 * For database operations (generate/check availability), use:
 * @/lib/server/short-code (server-only)
 */

/**
 * Short code validation regex
 * Accepts: A-Z, a-z, 0-9, dash (-), underscore (_)
 * Length: exactly 8 characters
 * Compatible with base64url encoding
 */
export const SHORT_CODE_REGEX = /^[a-zA-Z0-9_-]{8}$/;

/**
 * Valid length for short codes
 */
export const SHORT_CODE_LENGTH = 8;

/**
 * Validates if a short code matches the required format
 * @param code Short code to validate
 * @returns boolean True if valid format
 */
export const isValidShortCode = (code: string): boolean => {
  if (!code || code.length !== SHORT_CODE_LENGTH) {
    return false;
  }
  
  return SHORT_CODE_REGEX.test(code);
};

/**
 * Asserts that a short code is valid, throwing an error if not
 * @param code Short code to validate
 * @throws Error if short code is invalid
 */
export const assertValidShortCode = (code: string): void => {
  if (!isValidShortCode(code)) {
    throw new Error(`Invalid short code format: "${code}". Expected 8 characters matching [a-zA-Z0-9_-]`);
  }
};
