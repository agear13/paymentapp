/**
 * Canonical Xero connection/readiness state.
 * Distinguishes OAuth health from accounting configuration.
 */

export type XeroConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTED_UNVERIFIED'
  | 'AUTHENTICATED'
  | 'AUTH_REAUTH_REQUIRED'
  | 'TENANT_SELECTION_REQUIRED'
  | 'ACCOUNT_MAPPINGS_REQUIRED'
  | 'READY'
  | 'ERROR';

export type XeroConnectionStateInput = {
  connected?: boolean;
  stale?: boolean;
  reauthorizationRequired?: boolean;
  transientRefreshFailure?: boolean;
  tenantId?: string | null;
  invoiceMappingsComplete?: boolean | null;
};

export function computeXeroConnectionState(
  input: XeroConnectionStateInput
): XeroConnectionState {
  const reauthorizationRequired = Boolean(
    input.reauthorizationRequired || (input.connected && input.stale)
  );
  const connected = Boolean(input.connected);
  const tenantSelected = Boolean(input.tenantId?.trim());

  if (reauthorizationRequired) return 'AUTH_REAUTH_REQUIRED';
  if (input.transientRefreshFailure && connected) return 'ERROR';
  if (!connected && tenantSelected) return 'CONNECTED_UNVERIFIED';
  if (!connected) return 'DISCONNECTED';
  if (!tenantSelected) return 'TENANT_SELECTION_REQUIRED';
  if (input.invoiceMappingsComplete === true) return 'READY';
  if (input.invoiceMappingsComplete === false) return 'ACCOUNT_MAPPINGS_REQUIRED';
  return 'AUTHENTICATED';
}

export type XeroConnectionPresentation = {
  state: XeroConnectionState;
  badge: 'connected' | 'action_required';
  badgeLabel: string;
  detail: string;
  ctaLabel: string;
  bannerTitle: string;
  bannerMessage: string;
  bannerTone: 'default' | 'success' | 'warning';
};

export function presentXeroConnectionState(
  state: XeroConnectionState
): XeroConnectionPresentation {
  switch (state) {
    case 'DISCONNECTED':
      return {
        state,
        badge: 'action_required',
        badgeLabel: 'Not connected',
        detail: 'Accounting · not connected',
        ctaLabel: 'Connect Xero',
        bannerTitle: 'Connect accounting',
        bannerMessage: 'Connect Xero so Provvy can sync invoices and payments.',
        bannerTone: 'default',
      };
    case 'CONNECTED_UNVERIFIED':
    case 'AUTH_REAUTH_REQUIRED':
      return {
        state,
        badge: 'action_required',
        badgeLabel: 'Action required',
        detail: 'Reconnect Xero to restore accounting sync',
        ctaLabel: 'Reconnect',
        bannerTitle: 'Xero authorization expired',
        bannerMessage:
          'Your Xero connection needs to be authorized again before Provvy can sync accounting data.',
        bannerTone: 'warning',
      };
    case 'ERROR':
      return {
        state,
        badge: 'action_required',
        badgeLabel: 'Action required',
        detail: "Couldn't reach Xero just now",
        ctaLabel: 'Try again',
        bannerTitle: 'Xero is temporarily unavailable',
        bannerMessage: 'Provvy could not refresh the connection. Try again shortly — you do not need to reconnect yet.',
        bannerTone: 'warning',
      };
    case 'TENANT_SELECTION_REQUIRED':
      return {
        state,
        badge: 'connected',
        badgeLabel: 'Connected',
        detail: 'Setup incomplete · choose your Xero business',
        ctaLabel: 'Continue setup',
        bannerTitle: 'Accounting connected',
        bannerMessage: 'Choose which Xero business Provvy should use.',
        bannerTone: 'default',
      };
    case 'ACCOUNT_MAPPINGS_REQUIRED':
    case 'AUTHENTICATED':
      return {
        state,
        badge: 'connected',
        badgeLabel: 'Connected',
        detail: 'Setup incomplete',
        ctaLabel: 'Continue setup',
        bannerTitle: 'Accounting connected',
        bannerMessage: 'Choose where invoices and payments should be recorded in Xero.',
        bannerTone: 'default',
      };
    case 'READY':
      return {
        state,
        badge: 'connected',
        badgeLabel: 'Connected',
        detail: 'Ready to sync',
        ctaLabel: 'Manage',
        bannerTitle: 'Connected · Ready to sync',
        bannerMessage: 'Xero is authorized and invoice accounts are configured.',
        bannerTone: 'success',
      };
  }
}
