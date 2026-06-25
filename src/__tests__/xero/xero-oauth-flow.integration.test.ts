/**
 * Integration: Xero OAuth connect → callback state continuity and token exchange.
 */

import { XeroClient } from 'xero-node';
import { signOAuthState, verifyOAuthState } from '@/lib/security/oauth-state';
import { hashOAuthState } from '@/lib/xero/oauth-state-trace';

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const REDIRECT_URI = 'https://app.example.com/api/xero/callback';

const mockBuildConsentUrl = jest.fn();
const mockApiCallback = jest.fn();

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

describe('Xero OAuth connect → callback integration', () => {
  let signedState: string;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OAUTH_STATE_SECRET = 'integration-test-oauth-secret';
    process.env.XERO_CLIENT_ID = 'client-id';
    process.env.XERO_CLIENT_SECRET = 'client-secret';
    process.env.XERO_REDIRECT_URI = REDIRECT_URI;

    signedState = signOAuthState({
      organizationId: ORG_ID,
      userId: USER_ID,
    });

    mockBuildConsentUrl.mockImplementation(async function buildConsentUrl(this: { config?: { state?: string } }) {
      const state = this.config?.state ?? '';
      return `https://login.xero.com/identity/connect/authorize?state=${encodeURIComponent(state)}`;
    });

    mockApiCallback.mockResolvedValue({
      access_token: 'integration-access-token',
      refresh_token: 'integration-refresh-token',
      expires_in: 1800,
    });
  });

  it('uses one signed state from connect through callback token exchange', async () => {
    const connectHash = hashOAuthState(signedState);

    const { generateAuthUrl, exchangeCodeForTokens } = await import('@/lib/xero/client');

    const authUrl = await generateAuthUrl(signedState);
    const stateFromConsentUrl = new URL(authUrl).searchParams.get('state');

    expect(stateFromConsentUrl).toBe(signedState);
    expect(hashOAuthState(stateFromConsentUrl!)).toBe(connectHash);

    const authCode = 'xero-auth-code-integration';
    const callbackUrl = `${REDIRECT_URI}?code=${authCode}&state=${encodeURIComponent(signedState)}`;
    const stateFromCallbackUrl = new URL(callbackUrl).searchParams.get('state');

    expect(stateFromCallbackUrl).toBe(signedState);
    expect(hashOAuthState(stateFromCallbackUrl!)).toBe(connectHash);

    const verified = verifyOAuthState<{ organizationId: string; userId: string }>(
      stateFromCallbackUrl!
    );
    expect(verified?.organizationId).toBe(ORG_ID);
    expect(verified?.userId).toBe(USER_ID);

    const tokens = await exchangeCodeForTokens(callbackUrl, stateFromCallbackUrl!);

    expect(tokens.accessToken).toBe('integration-access-token');
    expect(tokens.refreshToken).toBe('integration-refresh-token');
    expect(mockApiCallback).toHaveBeenCalledWith(callbackUrl);

    const clientCalls = (XeroClient as jest.Mock).mock.calls;
    expect(clientCalls.length).toBe(2);
    expect(clientCalls[0][0].state).toBe(signedState);
    expect(clientCalls[1][0].state).toBe(signedState);
    expect(hashOAuthState(clientCalls[0][0].state)).toBe(connectHash);
    expect(hashOAuthState(clientCalls[1][0].state)).toBe(connectHash);
  });

  it('rejects token exchange when callback URL state differs from signed state', async () => {
    const { generateAuthUrl, exchangeCodeForTokens } = await import('@/lib/xero/client');

    await generateAuthUrl(signedState);

    const otherState = signOAuthState({
      organizationId: ORG_ID,
      userId: 'different-user-id-000000000001',
    });

    const callbackUrl = `${REDIRECT_URI}?code=abc&state=${encodeURIComponent(otherState)}`;

    await expect(exchangeCodeForTokens(callbackUrl, signedState)).rejects.toThrow(
      'OAuth state mismatch'
    );
    expect(mockApiCallback).not.toHaveBeenCalled();
  });
});
