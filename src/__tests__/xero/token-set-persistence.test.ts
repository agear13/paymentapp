import {
  buildTokenSetParameters,
  describeTokenSetPresence,
  tokenSetParametersFromApiCallback,
} from '@/lib/xero/token-set-trace';
import { encryptToken, decryptToken } from '@/lib/xero/encryption';

describe('Xero token set persistence', () => {
  beforeEach(() => {
    process.env.XERO_ENCRYPTION_KEY = 'test-encryption-key-for-round-trip';
  });

  it('maps apiCallback TokenSet fields without losing presence', () => {
    const raw = {
      access_token: 'access-token-value',
      refresh_token: 'refresh-token-value',
      id_token: 'id-token-value',
      scope: 'offline_access accounting.transactions',
      token_type: 'Bearer',
      expires_in: 1800,
    };

    const parsed = tokenSetParametersFromApiCallback(raw);
    const params = buildTokenSetParameters({
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
      idToken: parsed.idToken,
      scope: parsed.scope,
      tokenType: parsed.tokenType,
    });

    const rawPresence = describeTokenSetPresence('raw', raw);
    const paramsPresence = describeTokenSetPresence('params', params);

    expect(paramsPresence.hasAccessToken).toBe(true);
    expect(paramsPresence.hasRefreshToken).toBe(true);
    expect(paramsPresence.hasIdToken).toBe(true);
    expect(paramsPresence.hasScope).toBe(true);
    expect(paramsPresence.hasTokenType).toBe(true);
    expect(paramsPresence.hasExpiresAt).toBe(true);
    expect(paramsPresence.accessTokenLength).toBe(rawPresence.accessTokenLength);
    expect(paramsPresence.refreshTokenLength).toBe(rawPresence.refreshTokenLength);
    expect(paramsPresence.tokenTypeValue).toBe('Bearer');
  });

  it('encrypt/decrypt round trip preserves token string lengths', () => {
    const tokens = {
      access: 'access-token-abc123',
      refresh: 'refresh-token-xyz789',
      id: 'id-token-jwt-segment',
    };

    const encryptedAccess = encryptToken(tokens.access);
    const encryptedRefresh = encryptToken(tokens.refresh);
    const encryptedId = encryptToken(tokens.id);

    expect(decryptToken(encryptedAccess)).toBe(tokens.access);
    expect(decryptToken(encryptedRefresh)).toBe(tokens.refresh);
    expect(decryptToken(encryptedId)).toBe(tokens.id);

    const before = describeTokenSetPresence('before_encrypt', {
      access_token: tokens.access,
      refresh_token: tokens.refresh,
      id_token: tokens.id,
    });
    const after = describeTokenSetPresence('after_decrypt', {
      access_token: decryptToken(encryptedAccess),
      refresh_token: decryptToken(encryptedRefresh),
      id_token: decryptToken(encryptedId),
    });

    expect(after.accessTokenLength).toBe(before.accessTokenLength);
    expect(after.refreshTokenLength).toBe(before.refreshTokenLength);
    expect(after.idTokenLength).toBe(before.idTokenLength);
  });

  it('detects pre-migration rows missing scope and token_type', () => {
    const { isLegacyIncompleteXeroConnectionRow } = require('@/lib/xero/token-set-trace');
    expect(isLegacyIncompleteXeroConnectionRow({ scope: null, token_type: null })).toBe(true);
    expect(isLegacyIncompleteXeroConnectionRow({ scope: '', token_type: '' })).toBe(true);
    expect(
      isLegacyIncompleteXeroConnectionRow({
        scope: 'offline_access accounting.transactions',
        token_type: 'Bearer',
      })
    ).toBe(false);
  });

  it('uses seconds (not ms) for expires_at in TokenSetParameters', () => {
    const expiresAt = new Date('2026-06-25T12:00:00.000Z');
    const params = buildTokenSetParameters({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt,
    });

    expect(params.expires_at).toBe(Math.floor(expiresAt.getTime() / 1000));
    expect(params.expires_at).not.toBe(expiresAt.getTime());
  });
});
