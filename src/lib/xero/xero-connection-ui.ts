export type XeroConnectionUiMode = 'disconnected' | 'connected' | 'needs_reauthorization';

export function resolveXeroConnectionUiMode(status: {
  connected?: boolean;
  stale?: boolean;
} | null | undefined): XeroConnectionUiMode {
  if (status?.connected && status.stale) return 'needs_reauthorization';
  if (status?.connected) return 'connected';
  return 'disconnected';
}

/** Shown only when a persisted connection cannot be refreshed. */
export const XERO_REAUTHORIZATION_MESSAGE =
  'Xero needs to be reconnected. You can disconnect and reconnect Xero from Connected Systems.';

export const XERO_ACCOUNTS_STALE_MESSAGE = XERO_REAUTHORIZATION_MESSAGE;
