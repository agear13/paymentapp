import { NextRequest } from 'next/server';
import { signOAuthState } from '@/lib/security/oauth-state';

const mockGetUser = jest.fn();
const mockExchangeCodeForTokens = jest.fn();
const mockGetXeroTenants = jest.fn();
const mockStoreXeroConnection = jest.fn();
const mockGetXeroConnection = jest.fn();
const mockApplyDefaults = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

jest.mock('@/lib/xero', () => ({
  exchangeCodeForTokens: (...args: unknown[]) => mockExchangeCodeForTokens(...args),
  getXeroTenants: (...args: unknown[]) => mockGetXeroTenants(...args),
  storeXeroConnection: (...args: unknown[]) => mockStoreXeroConnection(...args),
}));

jest.mock('@/lib/xero/connection-service', () => ({
  getXeroConnection: (...args: unknown[]) => mockGetXeroConnection(...args),
  storeXeroConnection: (...args: unknown[]) => mockStoreXeroConnection(...args),
}));

jest.mock('@/lib/xero/xero-config', () => ({
  assertXeroConfigured: jest.fn(),
  XeroConfigurationError: class XeroConfigurationError extends Error {},
}));

jest.mock('@/lib/xero/default-accounting-mappings', () => ({
  applyXeroDefaultAccountingMappingsIfEmpty: (...args: unknown[]) => mockApplyDefaults(...args),
}));

jest.mock('@/lib/xero/oauth-redirect', () => ({
  buildXeroOAuthCallbackUrl: jest.fn(
    () => 'https://app.example.com/api/xero/callback?code=auth-code&state=signed'
  ),
  xeroIntegrationsRedirectUrl: jest.fn(
    (_request: unknown, query: Record<string, string>) =>
      `https://app.example.com/workspace?${new URLSearchParams(query).toString()}`
  ),
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    xero: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
}));

import { GET as xeroCallback } from '@/app/api/xero/callback/route';

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('Xero OAuth callback session binding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OAUTH_STATE_SECRET = 'callback-session-test-secret';

    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 1800_000),
      scope: 'offline_access accounting.transactions',
      tokenType: 'Bearer',
    });
    mockGetXeroTenants.mockResolvedValue([
      { tenantId: 'tenant-1', tenantName: 'Demo Org', tenantType: 'ORGANISATION' },
    ]);
    mockStoreXeroConnection.mockResolvedValue({ organizationId: ORG_ID, tenantId: 'tenant-1' });
    mockGetXeroConnection.mockResolvedValue(null);
    mockApplyDefaults.mockResolvedValue({ status: 'applied', recommendations: [] });
  });

  function callbackRequest(state: string) {
    return new NextRequest(
      `https://app.example.com/api/xero/callback?code=auth-code&state=${encodeURIComponent(state)}`
    );
  }

  it('persists the connection when the signed state is valid even if the browser session cookie is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    const state = signOAuthState({ organizationId: ORG_ID, userId: USER_ID });

    const response = await xeroCallback(callbackRequest(state));

    expect(mockStoreXeroConnection).toHaveBeenCalledWith(
      ORG_ID,
      'tenant-1',
      expect.objectContaining({
        accessToken: 'access',
        refreshToken: 'refresh',
      })
    );
    expect(response.headers.get('location')).toContain('xero_success=connected');
    expect(response.headers.get('location')).not.toContain('xero_error=unauthorized');
  });

  it('does not persist when a different signed-in user hits the callback', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'cccccccccccccccccccccccccccccccc' } },
      error: null,
    });
    const state = signOAuthState({ organizationId: ORG_ID, userId: USER_ID });

    const response = await xeroCallback(callbackRequest(state));

    expect(mockStoreXeroConnection).not.toHaveBeenCalled();
    expect(mockExchangeCodeForTokens).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('xero_error=unauthorized');
  });
});
