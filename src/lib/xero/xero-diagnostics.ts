/**
 * Admin-only Xero connection diagnostics (no secrets in response).
 */

import { decryptToken } from './encryption';
import { getXeroEnvStatus } from './xero-config';
import {
  getXeroConnectionRow,
  getValidAccessToken,
} from './connection-service';
import { loggers } from '@/lib/logger';

export type XeroDiagnosticsResult = {
  organizationId: string;
  environment: ReturnType<typeof getXeroEnvStatus>;
  connectionRecordExists: boolean;
  tenantIdPresent: boolean;
  tokensDecryptSuccessfully: boolean;
  decryptError: string | null;
  refreshTokenValid: boolean;
  refreshError: string | null;
  tokenExpiresAt: string | null;
  tokenExpired: boolean | null;
  connectedAt: string | null;
};

export async function runXeroDiagnostics(
  organizationId: string
): Promise<XeroDiagnosticsResult> {
  loggers.xero.info('xero_diagnostics_start', { organizationId, step: 'load_connection_row' });

  const row = await getXeroConnectionRow(organizationId);
  const environment = getXeroEnvStatus();

  let tokensDecryptSuccessfully = false;
  let decryptError: string | null = null;

  if (row) {
    loggers.xero.info('xero_diagnostics_decrypt_tokens', { organizationId, step: 'decrypt_tokens' });
    try {
      decryptToken(row.access_token);
      decryptToken(row.refresh_token);
      tokensDecryptSuccessfully = true;
    } catch (error) {
      decryptError = error instanceof Error ? error.message : String(error);
      loggers.xero.error('xero_diagnostics_decrypt_failed', error, { organizationId });
    }
  }

  let refreshTokenValid = false;
  let refreshError: string | null = null;

  if (tokensDecryptSuccessfully) {
    loggers.xero.info('xero_diagnostics_refresh_probe', {
      organizationId,
      step: 'refresh_access_token',
    });
    try {
      const accessToken = await getValidAccessToken(organizationId);
      refreshTokenValid = Boolean(accessToken);
      if (!accessToken) {
        refreshError = 'Access token could not be obtained (refresh may have failed)';
      }
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
      loggers.xero.error('xero_diagnostics_refresh_failed', error, { organizationId });
    }
  }

  const expiresAt = row?.expires_at ?? null;
  const tokenExpired = expiresAt ? expiresAt.getTime() < Date.now() : null;

  loggers.xero.info('xero_diagnostics_complete', {
    organizationId,
    connectionRecordExists: Boolean(row),
    tokensDecryptSuccessfully,
    refreshTokenValid,
  });

  return {
    organizationId,
    environment,
    connectionRecordExists: Boolean(row),
    tenantIdPresent: Boolean(row?.tenant_id?.trim()),
    tokensDecryptSuccessfully,
    decryptError,
    refreshTokenValid,
    refreshError,
    tokenExpiresAt: expiresAt?.toISOString() ?? null,
    tokenExpired,
    connectedAt: row?.connected_at?.toISOString() ?? null,
  };
}
