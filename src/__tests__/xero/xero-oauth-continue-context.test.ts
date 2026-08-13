/** @jest-environment jsdom */

import {
  clearXeroOAuthContinueFrom,
  readXeroOAuthContinueFrom,
  storeXeroOAuthContinueFrom,
} from '@/lib/xero/xero-oauth-continue-context';

describe('xero oauth continue context', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and reads allowlisted continue-from paths', () => {
    storeXeroOAuthContinueFrom('/workspace/receivables/create');
    expect(readXeroOAuthContinueFrom()).toBe('/workspace/receivables/create');
    clearXeroOAuthContinueFrom();
    expect(readXeroOAuthContinueFrom()).toBeNull();
  });

  it('preserves allowlisted query strings such as invoice id', () => {
    storeXeroOAuthContinueFrom('/workspace/invoice/INV-001?id=abc-123');
    expect(readXeroOAuthContinueFrom()).toBe('/workspace/invoice/INV-001?id=abc-123');
  });

  it('ignores disallowed continue-from paths', () => {
    storeXeroOAuthContinueFrom('https://evil.example');
    expect(readXeroOAuthContinueFrom()).toBeNull();
  });
});
