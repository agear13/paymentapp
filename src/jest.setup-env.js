/**
 * Loaded before tests so config validation and optional Xero side-effects do not abort suites.
 */
const { TextEncoder, TextDecoder } = require('util');

// viem (and other Web Crypto–adjacent libs) expect WHATWG TextEncoder/TextDecoder on globalThis.
// jest-environment-node does not always expose them, even when Node provides them via `util`.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.TEST_MODE = process.env.TEST_MODE || 'true';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://jest:jest@localhost:5432/jest_placeholder?schema=public';
}
if (!process.env.DIRECT_DATABASE_URL) {
  process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
}
if (!process.env.XERO_ENCRYPTION_KEY) {
  process.env.XERO_ENCRYPTION_KEY = 'jest-placeholder-xero-key';
}
