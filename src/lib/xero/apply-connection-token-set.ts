/**
 * Apply persisted connection tokens to a XeroClient with structured tracing.
 */

import type { XeroClient } from 'xero-node';
import type { XeroConnection } from './connection-service';
import {
  buildTokenSetParameters,
  compareTokenSetTrace,
  logTokenSetTrace,
} from './token-set-trace';

export async function applyConnectionToXeroClient(
  client: XeroClient,
  connection: XeroConnection,
  phase: string
): Promise<void> {
  const params = buildTokenSetParameters({
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
    idToken: connection.idToken,
    scope: connection.scope,
    tokenType: connection.tokenType,
  });

  logTokenSetTrace(`${phase}_before_setTokenSet`, params);
  await client.setTokenSet(params);
  logTokenSetTrace(`${phase}_after_setTokenSet`, client.readTokenSet());
}

export function traceConnectionVsTokenSet(
  phase: string,
  apiCallbackTokenSet: unknown,
  connection: XeroConnection
): void {
  compareTokenSetTrace(
    phase,
    apiCallbackTokenSet,
    buildTokenSetParameters({
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.expiresAt,
      idToken: connection.idToken,
      scope: connection.scope,
      tokenType: connection.tokenType,
    })
  );
}
