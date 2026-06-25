/**
 * OAuth state tracing for Xero connect/callback continuity checks.
 * Logs SHA-256 prefixes in development; never logs the raw state value.
 */

import crypto from 'crypto';
import { loggers } from '@/lib/logger';

/** Short hash for correlating the same state across connect and callback logs. */
export function hashOAuthState(oauthState: string): string {
  return crypto.createHash('sha256').update(oauthState).digest('hex').slice(0, 16);
}

/** Log state hash in non-production environments. */
export function traceOAuthState(phase: string, oauthState: string): string {
  const stateHash = hashOAuthState(oauthState);
  if (process.env.NODE_ENV !== 'production') {
    loggers.xero.debug('xero_oauth_state_trace', {
      phase,
      stateHash,
      stateLength: oauthState.length,
    });
  }
  return stateHash;
}

/**
 * Ensure the state passed to token exchange is byte-identical to the callback URL param.
 */
export function assertOAuthStateMatchesCallbackUrl(
  callbackUrl: string,
  oauthState: string
): void {
  const urlState = new URL(callbackUrl).searchParams.get('state');
  const paramHash = hashOAuthState(oauthState);
  const urlHash = urlState ? hashOAuthState(urlState) : 'missing';

  if (!urlState || urlState !== oauthState) {
    loggers.xero.error('xero_oauth_state_mismatch', undefined, {
      paramHash,
      urlHash,
      paramLength: oauthState.length,
      urlLength: urlState?.length ?? 0,
    });
    throw new Error(
      'OAuth state mismatch: exchange parameter must match callback URL state query param'
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    loggers.xero.debug('xero_oauth_state_match', { stateHash: paramHash });
  }
}

/**
 * After buildConsentUrl, confirm Xero echoed the same state we configured on the client.
 */
export function assertConsentUrlStateMatches(
  consentUrl: string,
  oauthState: string
): void {
  const urlState = new URL(consentUrl).searchParams.get('state');
  const expectedHash = hashOAuthState(oauthState);
  const urlHash = urlState ? hashOAuthState(urlState) : 'missing';

  if (!urlState || urlState !== oauthState) {
    loggers.xero.error('xero_oauth_consent_state_mismatch', undefined, {
      expectedHash,
      urlHash,
    });
    throw new Error(
      'OAuth consent URL state does not match signed state passed to generateAuthUrl'
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    loggers.xero.debug('xero_oauth_consent_state_match', { stateHash: expectedHash });
  }
}
