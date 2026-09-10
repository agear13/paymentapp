import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';
import { cregisNonce, signCregisPayload } from '@/lib/payouts/rails/cregis-signature';
import type { CregisExecutionCredentials } from '@/lib/payouts/rails/types';

export const CREGIS_SUCCESS_CODE = '00000';

export type CregisApiEnvelope = {
  code?: string;
  msg?: string;
  data?: Record<string, unknown> | null;
};

export async function cregisSignedPost(input: {
  credentials: CregisExecutionCredentials;
  path: string;
  body: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<CregisApiEnvelope> {
  const signed = {
    ...input.body,
    nonce: cregisNonce(),
    timestamp: Date.now(),
  };
  const sign = signCregisPayload(signed, input.credentials.apiKey);
  const response = await (input.fetchImpl ?? fetch)(
    `${input.credentials.gatewayBaseUrl}${input.path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...signed, sign }),
    }
  );
  const raw = (await response.json().catch(() => null)) as CregisApiEnvelope | null;
  if (!raw) {
    throw new PayoutReleaseError(
      'CREGIS_HTTP_ERROR',
      `Cregis request failed with HTTP ${response.status}`,
      response.status >= 400 ? response.status : 502
    );
  }
  return raw;
}
