/**
 * Loaded before tests so config validation and optional Xero side-effects do not abort suites.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.TEST_MODE = process.env.TEST_MODE || 'true';
if (!process.env.XERO_ENCRYPTION_KEY) {
  process.env.XERO_ENCRYPTION_KEY = 'jest-placeholder-xero-key';
}
