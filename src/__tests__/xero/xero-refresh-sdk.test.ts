/**
 * Uses the installed xero-node SDK (not a full-module mock) so a missing
 * openIdClient cannot be hidden. Issuer.discover is stubbed so refresh does
 * not call identity.xero.com.
 */

const mockRefresh = jest.fn();
const mockDiscover = jest.fn();

jest.mock('openid-client', () => {
  const actual = jest.requireActual<typeof import('openid-client')>('openid-client');
  return {
    ...actual,
    Issuer: {
      discover: (...args: unknown[]) => mockDiscover(...args),
    },
  };
});

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

import { XeroClient } from 'xero-node';
import { refreshAccessToken } from '@/lib/xero/client';

describe('xero-node refresh SDK contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.XERO_CLIENT_ID = 'client-id';
    process.env.XERO_CLIENT_SECRET = 'client-secret';
    process.env.XERO_REDIRECT_URI = 'https://app.example.com/api/xero/callback';
    process.env.XERO_ENCRYPTION_KEY = 'test-xero-refresh-sdk-key';
    process.env.ENCRYPTION_KEY = 'test-session-secret-for-xero-config';

    mockDiscover.mockResolvedValue({
      Client: class {
        refresh = (...args: unknown[]) => mockRefresh(...args);
      },
    });
    mockRefresh.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 1800,
      token_type: 'Bearer',
      scope: 'offline_access accounting.transactions',
    });
  });

  it('throws the production TypeError when refreshToken runs before initialize', async () => {
    const client = new XeroClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUris: ['https://app.example.com/api/xero/callback'],
      scopes: ['offline_access'],
    });
    client.setTokenSet({
      access_token: 'old-access',
      refresh_token: 'old-refresh',
      token_type: 'Bearer',
      scope: 'offline_access',
    });

    expect(client.openIdClient).toBeUndefined();
    await expect(client.refreshToken()).rejects.toThrow(
      /Cannot read propert(?:y|ies) of undefined \(reading 'refresh'\)/
    );
    expect(mockDiscover).not.toHaveBeenCalled();
  });

  it('initializes the OpenID client then refreshes with the stored refresh token', async () => {
    const result = await refreshAccessToken({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      idToken: 'old-id',
      scope: 'offline_access accounting.transactions accounting.contacts accounting.settings.read',
      tokenType: 'Bearer',
    });

    expect(mockDiscover).toHaveBeenCalledWith('https://identity.xero.com');
    expect(mockRefresh).toHaveBeenCalledWith('old-refresh');
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
  });
});
