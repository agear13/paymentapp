import { XeroClient } from 'xero-node';

const mockSetTokenSet = jest.fn();
const mockRefreshToken = jest.fn();
const mockReadTokenSet = jest.fn(() => ({}));

jest.mock('xero-node', () => ({
  XeroClient: jest.fn().mockImplementation(() => ({
    setTokenSet: mockSetTokenSet,
    refreshToken: mockRefreshToken,
    readTokenSet: mockReadTokenSet,
  })),
}));

jest.mock('@/lib/xero/xero-config', () => ({
  assertXeroConfigured: jest.fn(),
  getMissingXeroEnvVars: jest.fn(() => []),
  XeroConfigurationError: class XeroConfigurationError extends Error {},
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

describe('Xero refreshAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.XERO_CLIENT_ID = 'client-id';
    process.env.XERO_CLIENT_SECRET = 'client-secret';
    process.env.XERO_REDIRECT_URI = 'https://app.example.com/api/xero/callback';
  });

  it('applies the full persisted token set before calling Xero refresh', async () => {
    mockRefreshToken.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 1800,
      scope: 'offline_access accounting.transactions',
      token_type: 'Bearer',
    });

    const { refreshAccessToken } = await import('@/lib/xero/client');
    const expiresAt = new Date('2026-01-01T00:00:00.000Z');

    const result = await refreshAccessToken({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt,
      idToken: 'old-id',
      scope: 'offline_access accounting.transactions accounting.contacts accounting.settings.read',
      tokenType: 'Bearer',
    });

    expect(XeroClient).toHaveBeenCalled();
    expect(mockSetTokenSet).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'old-access',
        refresh_token: 'old-refresh',
        id_token: 'old-id',
        scope: 'offline_access accounting.transactions accounting.contacts accounting.settings.read',
        token_type: 'Bearer',
      })
    );
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
  });

  it('keeps the previous refresh token when Xero omits one', async () => {
    mockRefreshToken.mockResolvedValue({
      access_token: 'new-access',
      expires_in: 1800,
    });

    const { refreshAccessToken } = await import('@/lib/xero/client');
    const result = await refreshAccessToken({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: new Date(),
      scope: 'offline_access accounting.transactions',
      tokenType: 'Bearer',
    });

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('old-refresh');
    expect(result.scope).toBe('offline_access accounting.transactions');
    expect(result.tokenType).toBe('Bearer');
  });
});
