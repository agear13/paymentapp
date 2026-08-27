export type XeroConnectionUiMode =
  | 'disconnected'
  | 'connected'
  | 'needs_reauthorization'
  | 'refresh_error';

export function resolveXeroConnectionUiMode(status: {
  connected?: boolean;
  stale?: boolean;
  reauthorizationRequired?: boolean;
  transientRefreshFailure?: boolean;
  internalFailure?: boolean;
  connectionState?: string;
} | null | undefined): XeroConnectionUiMode {
  if (
    status?.connectionState === 'AUTH_REAUTH_REQUIRED' ||
    status?.reauthorizationRequired ||
    (status?.connected && status.stale)
  ) {
    return 'needs_reauthorization';
  }
  if (
    status?.connectionState === 'ERROR' ||
    status?.transientRefreshFailure ||
    status?.internalFailure
  ) {
    return 'refresh_error';
  }
  if (status?.connected) return 'connected';
  return 'disconnected';
}

/** Shown only when a persisted connection cannot be refreshed. */
export const XERO_REAUTHORIZATION_MESSAGE =
  'Your Xero connection needs to be authorized again before Provvy can sync accounting data.';

export const XERO_ACCOUNTS_STALE_MESSAGE = XERO_REAUTHORIZATION_MESSAGE;
