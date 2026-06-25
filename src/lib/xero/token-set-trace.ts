/**
 * Structured token-set tracing — field presence only, never secret values.
 */

import type { TokenSetParameters } from 'xero-node';
import { loggers } from '@/lib/logger';

export type XeroOAuthTokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  idToken?: string | null;
  tokenType?: string | null;
  scope?: string | null;
};

/** Scopes we request — persisted when Xero omits scope in token response. */
export const XERO_OAUTH_SCOPES_PERSISTED =
  'offline_access accounting.transactions accounting.contacts accounting.settings.read';

/**
 * Pre-migration rows have NULL scope + token_type. New OAuth always persists both.
 * Do not refresh legacy rows — force re-authorization.
 */
export function isLegacyIncompleteXeroConnectionRow(row: {
  scope?: string | null;
  token_type?: string | null;
}): boolean {
  return !row.scope?.trim() && !row.token_type?.trim();
}

export type TokenSetFieldPresence = {
  phase: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasIdToken: boolean;
  hasExpiresAt: boolean;
  hasExpiresIn: boolean;
  hasScope: boolean;
  hasTokenType: boolean;
  accessTokenLength: number;
  refreshTokenLength: number;
  idTokenLength: number;
  scopeLength: number;
  tokenTypeValue: string | null;
  expiresAtValue: number | null;
  expiresInValue: number | null;
};

function readStringField(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function readNumberField(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

/** Describe which OAuth token fields are present (no secret values logged). */
export function describeTokenSetPresence(phase: string, tokenSet: unknown): TokenSetFieldPresence {
  const obj =
    tokenSet && typeof tokenSet === 'object'
      ? (tokenSet as Record<string, unknown>)
      : {};

  const accessToken = readStringField(obj, ['access_token', 'accessToken']);
  const refreshToken = readStringField(obj, ['refresh_token', 'refreshToken']);
  const idToken = readStringField(obj, ['id_token', 'idToken']);
  const scope = readStringField(obj, ['scope']);
  const tokenType = readStringField(obj, ['token_type', 'tokenType']);
  const expiresAt = readNumberField(obj, ['expires_at', 'expiresAt']);
  const expiresIn = readNumberField(obj, ['expires_in', 'expiresIn']);

  return {
    phase,
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    hasIdToken: Boolean(idToken),
    hasExpiresAt: expiresAt != null,
    hasExpiresIn: expiresIn != null,
    hasScope: Boolean(scope),
    hasTokenType: Boolean(tokenType),
    accessTokenLength: accessToken?.length ?? 0,
    refreshTokenLength: refreshToken?.length ?? 0,
    idTokenLength: idToken?.length ?? 0,
    scopeLength: scope?.length ?? 0,
    tokenTypeValue: tokenType ?? null,
    expiresAtValue: expiresAt ?? null,
    expiresInValue: expiresIn ?? null,
  };
}

export function logTokenSetTrace(phase: string, tokenSet: unknown): TokenSetFieldPresence {
  const presence = describeTokenSetPresence(phase, tokenSet);
  loggers.xero.info('xero_token_set_trace', presence);
  return presence;
}

export function compareTokenSetTrace(
  phase: string,
  source: unknown,
  loaded: unknown
): void {
  const sourcePresence = describeTokenSetPresence(`${phase}_source`, source);
  const loadedPresence = describeTokenSetPresence(`${phase}_loaded`, loaded);

  loggers.xero.info('xero_token_set_compare', {
    phase,
    source: sourcePresence,
    loaded: loadedPresence,
    accessTokenMatch:
      sourcePresence.hasAccessToken === loadedPresence.hasAccessToken &&
      sourcePresence.accessTokenLength === loadedPresence.accessTokenLength,
    refreshTokenMatch:
      sourcePresence.hasRefreshToken === loadedPresence.hasRefreshToken &&
      sourcePresence.refreshTokenLength === loadedPresence.refreshTokenLength,
    idTokenMatch:
      sourcePresence.hasIdToken === loadedPresence.hasIdToken &&
      sourcePresence.idTokenLength === loadedPresence.idTokenLength,
    scopeMatch:
      sourcePresence.hasScope === loadedPresence.hasScope &&
      sourcePresence.scopeLength === loadedPresence.scopeLength,
    tokenTypeMatch: sourcePresence.tokenTypeValue === loadedPresence.tokenTypeValue,
    expiresAtMatch: sourcePresence.expiresAtValue === loadedPresence.expiresAtValue,
  });
}

/** Normalize apiCallback TokenSet / connection row into openid-client TokenSetParameters. */
export function buildTokenSetParameters(input: {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  idToken?: string | null;
  scope?: string | null;
  tokenType?: string | null;
}): TokenSetParameters {
  const params: TokenSetParameters = {
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    expires_at: Math.floor(input.expiresAt.getTime() / 1000),
  };

  if (input.idToken) {
    params.id_token = input.idToken;
  }
  if (input.scope) {
    params.scope = input.scope;
  }
  if (input.tokenType) {
    params.token_type = input.tokenType;
  }

  return params;
}

export function tokenSetParametersFromApiCallback(tokenSet: TokenSetParameters): {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  idToken?: string;
  scope?: string;
  tokenType?: string;
} {
  if (!tokenSet.access_token || !tokenSet.refresh_token) {
    throw new Error('TokenSet missing access_token or refresh_token');
  }

  let expiresAt: Date;
  if (tokenSet.expires_at != null) {
    expiresAt = new Date(Number(tokenSet.expires_at) * 1000);
  } else if (tokenSet.expires_in != null) {
    expiresAt = new Date(Date.now() + Number(tokenSet.expires_in) * 1000);
  } else {
    throw new Error('TokenSet missing expires_at and expires_in');
  }

  return {
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    expiresAt,
    idToken: tokenSet.id_token ?? undefined,
    scope: tokenSet.scope ?? undefined,
    tokenType: tokenSet.token_type ?? undefined,
  };
}
