import {
  commercialOsXeroOAuthReturnPath,
  isAllowedXeroOAuthReturnPath,
  legacyXeroOAuthDefaultReturnPath,
  normalizeXeroOAuthReturnPath,
  resolveXeroOAuthReturnPath,
} from '@/lib/xero/oauth-return-path';
import { xeroIntegrationsRedirectUrl } from '@/lib/xero/oauth-redirect';
import { NextRequest } from 'next/server';
import { formatXeroOAuthError } from '@/lib/xero/xero-customer-messages';

describe('normalizeXeroOAuthReturnPath', () => {
  it('allows Commercial OS workspace routes', () => {
    expect(normalizeXeroOAuthReturnPath('/workspace/connected/xero')).toBe(
      '/workspace/connected/xero'
    );
    expect(normalizeXeroOAuthReturnPath('/workspace/receivables/create')).toBe(
      '/workspace/receivables/create'
    );
    expect(normalizeXeroOAuthReturnPath('/workspace/invoice/INV-001?id=abc')).toBe(
      '/workspace/invoice/INV-001'
    );
  });

  it('allows legacy integrations route', () => {
    expect(normalizeXeroOAuthReturnPath('/dashboard/settings/integrations')).toBe(
      '/dashboard/settings/integrations'
    );
  });

  it('rejects external and malformed paths', () => {
    expect(normalizeXeroOAuthReturnPath('https://evil.example/phish')).toBeUndefined();
    expect(normalizeXeroOAuthReturnPath('//evil.example/phish')).toBeUndefined();
    expect(normalizeXeroOAuthReturnPath('/auth/login')).toBeUndefined();
  });
});

describe('resolveXeroOAuthReturnPath', () => {
  it('falls back to legacy integrations when return path is missing or invalid', () => {
    expect(resolveXeroOAuthReturnPath(undefined)).toBe(legacyXeroOAuthDefaultReturnPath());
    expect(resolveXeroOAuthReturnPath('/auth/login')).toBe(legacyXeroOAuthDefaultReturnPath());
  });

  it('preserves allowlisted workspace return paths', () => {
    expect(resolveXeroOAuthReturnPath('/workspace/connected/xero')).toBe(
      '/workspace/connected/xero'
    );
  });
});

describe('commercialOsXeroOAuthReturnPath', () => {
  it('points to the new accounting setup screen', () => {
    expect(commercialOsXeroOAuthReturnPath()).toBe('/workspace/connected/xero');
    expect(isAllowedXeroOAuthReturnPath(commercialOsXeroOAuthReturnPath())).toBe(true);
  });
});

describe('xeroIntegrationsRedirectUrl', () => {
  const origin = 'https://app.example.com';

  it('A. successful connection → Commercial OS setup when returnTo is in state', () => {
    const request = new NextRequest(`${origin}/api/xero/callback`);
    const url = xeroIntegrationsRedirectUrl(
      request,
      { xero_success: 'connected', xero_accounting: 'configured' },
      '/workspace/connected/xero'
    );
    expect(url).toBe(
      `${origin}/workspace/connected/xero?xero_success=connected&xero_accounting=configured`
    );
  });

  it('B. access_denied → setup page when returnTo was signed in state', () => {
    const request = new NextRequest(`${origin}/api/xero/callback`);
    const url = xeroIntegrationsRedirectUrl(
      request,
      { xero_error: 'access_denied' },
      '/workspace/connected/xero'
    );
    expect(url).toBe(`${origin}/workspace/connected/xero?xero_error=access_denied`);
  });

  it('C. OAuth error with valid returnTo → same allowlisted destination', () => {
    const request = new NextRequest(`${origin}/api/xero/callback`);
    const url = xeroIntegrationsRedirectUrl(
      request,
      { xero_error: 'connection_failed' },
      '/workspace/connected/xero'
    );
    expect(url).toBe(`${origin}/workspace/connected/xero?xero_error=connection_failed`);
  });

  it('D. missing/invalid state (no returnPath) → legacy integrations fallback', () => {
    const request = new NextRequest(`${origin}/api/xero/callback`);
    const url = xeroIntegrationsRedirectUrl(request, { xero_error: 'invalid_state' });
    expect(url).toBe(`${origin}/dashboard/settings/integrations?xero_error=invalid_state`);
  });

  it('E. missing returnTo in state → legacy integrations fallback', () => {
    const request = new NextRequest(`${origin}/api/xero/callback`);
    const url = xeroIntegrationsRedirectUrl(request, { xero_success: 'connected' });
    expect(url).toBe(`${origin}/dashboard/settings/integrations?xero_success=connected`);
  });

  it('legacy dashboard explicit returnTo → legacy integrations', () => {
    const request = new NextRequest(`${origin}/api/xero/callback`);
    const url = xeroIntegrationsRedirectUrl(
      request,
      { xero_success: 'connected' },
      '/dashboard/settings/integrations'
    );
    expect(url).toBe(`${origin}/dashboard/settings/integrations?xero_success=connected`);
  });
});

describe('formatXeroOAuthError', () => {
  it('maps OAuth cancellation to merchant-friendly copy', () => {
    expect(formatXeroOAuthError('access_denied').message).toBe(
      'Xero connection was cancelled.'
    );
  });

  it('maps connection failures to retry guidance', () => {
    expect(formatXeroOAuthError('connection_failed').message).toBe(
      'Provvy could not finish linking your Xero account.'
    );
  });
});
