/**
 * xero-node requires config.state on XeroClient for both buildConsentUrl and apiCallback.
 * See node_modules/xero-node/dist/XeroClient.js — apiCallback uses check = { state: this.config.state }.
 */

import { XeroClient } from 'xero-node';

const mockBuildConsentUrl = jest.fn().mockResolvedValue('https://login.xero.com/consent?state=signed');
const mockApiCallback = jest.fn().mockResolvedValue({
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 1800,
});

jest.mock('xero-node', () => ({
  XeroClient: jest.fn().mockImplementation((config) => ({
    config,
    buildConsentUrl: mockBuildConsentUrl,
    apiCallback: mockApiCallback,
  })),
}));

jest.mock('@/lib/xero/xero-config', () => ({
  assertXeroConfigured: jest.fn(),
  getMissingXeroEnvVars: jest.fn(() => []),
  XeroConfigurationError: class XeroConfigurationError extends Error {},
}));

describe('Xero OAuth state handling', () => {
  const oauthState = 'signed-state-token';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.XERO_CLIENT_ID = 'client-id';
    process.env.XERO_CLIENT_SECRET = 'client-secret';
    process.env.XERO_REDIRECT_URI = 'https://app.example.com/api/xero/callback';

    mockBuildConsentUrl.mockImplementation(async function buildConsentUrl(this: { config?: { state?: string } }) {
      const state = this.config?.state ?? '';
      return `https://login.xero.com/consent?state=${encodeURIComponent(state)}`;
    });
  });

  it('passes oauth state into XeroClient for generateAuthUrl', async () => {
    const { generateAuthUrl } = await import('@/lib/xero/client');
    const url = await generateAuthUrl(oauthState);

    expect(XeroClient).toHaveBeenCalledWith(
      expect.objectContaining({ state: oauthState })
    );
    expect(mockBuildConsentUrl).toHaveBeenCalled();
    expect(url).toContain('consent');
  });

  it('passes oauth state into XeroClient for exchangeCodeForTokens', async () => {
    const { exchangeCodeForTokens } = await import('@/lib/xero/client');
    const callbackUrl =
      'https://app.example.com/api/xero/callback?code=abc&state=signed-state-token';

    const tokens = await exchangeCodeForTokens(callbackUrl, oauthState);

    expect(XeroClient).toHaveBeenCalledWith(
      expect.objectContaining({ state: oauthState })
    );
    expect(mockApiCallback).toHaveBeenCalledWith(callbackUrl);
    expect(tokens.accessToken).toBe('access');
    expect(tokens.refreshToken).toBe('refresh');
  });

  it('rejects token exchange without oauth state', async () => {
    const { exchangeCodeForTokens } = await import('@/lib/xero/client');

    await expect(
      exchangeCodeForTokens('https://app.example.com/api/xero/callback?code=abc', '')
    ).rejects.toThrow('OAuth state is required');
  });
});
