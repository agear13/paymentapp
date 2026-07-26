/**
 * Pinch Payments — payment source creation.
 *
 * Wraps PinchClient for POST /payers/{payerId}/sources (Create Payment Source).
 * Domain callers supply a typed request; this service maps it to the Pinch API
 * and returns the full API response unchanged.
 */

import { PinchClient } from '@/lib/payments/pinch/client';

export interface PinchCreateSourceRequest {
  /** Pinch payer ID (`pyr_…`) — sent as the `{id}` path parameter. */
  payerId: string;
  /** Short-lived token from CaptureJS `createToken()`. */
  token: string;
  /** Required by Pinch — omitting this causes the API to receive enum value `0`. */
  sourceType: PinchSourceType;
  bankAccountNumber?: string;
  bankAccountBsb?: string;
  bankAccountName?: string;
  ipAddress?: string;
}

export type PinchSourceType = 'bank-account' | 'credit-card' | 'payto-account';

export interface PinchCreateSourceResponse {
  id: string;
  payerId?: string;
  sourceType: string;
  last4?: string | null;
  expiryMonth?: number | null;
  expiryYear?: number | null;
  bankAccountNumber?: string | null;
  bankAccountBsb?: string | null;
  bankAccountName?: string | null;
  displayCardNumber?: string | null;
  cardScheme?: string | null;
  metadata?: Record<string, unknown> | string | null;
}

type PinchCreateSourceApiBody = {
  token: string;
  sourceType: PinchSourceType;
  bankAccountNumber?: string;
  bankAccountBsb?: string;
  bankAccountName?: string;
  ipAddress?: string;
};

function buildCreateSourcePath(payerId: string): string {
  return `/payers/${encodeURIComponent(payerId)}/sources`;
}

function mapCreateSourceRequest(request: PinchCreateSourceRequest): PinchCreateSourceApiBody {
  const body: PinchCreateSourceApiBody = {
    token: request.token,
    sourceType: request.sourceType,
  };
  if (request.bankAccountNumber !== undefined) {
    body.bankAccountNumber = request.bankAccountNumber;
  }
  if (request.bankAccountBsb !== undefined) {
    body.bankAccountBsb = request.bankAccountBsb;
  }
  if (request.bankAccountName !== undefined) {
    body.bankAccountName = request.bankAccountName;
  }
  if (request.ipAddress !== undefined) {
    body.ipAddress = request.ipAddress;
  }

  return body;
}

export class PinchSourceService {
  private readonly client: PinchClient;

  constructor(client: PinchClient) {
    this.client = client;
  }

  static fromEnv(): PinchSourceService {
    return new PinchSourceService(PinchClient.fromEnv());
  }

  /**
   * Vaults a CaptureJS token via POST /payers/{payerId}/sources.
   * @throws {PinchApiError} When the Pinch API returns a non-success response.
   */
  async createSource(request: PinchCreateSourceRequest): Promise<PinchCreateSourceResponse> {
    const path = buildCreateSourcePath(request.payerId);
    const apiBody = mapCreateSourceRequest(request);

    // TEMPORARY — verify outbound Pinch source payload during /dev/pinch sandbox testing.
    console.info('[pinch-source-service] Outbound POST body', { path, body: apiBody });

    return this.client.post<PinchCreateSourceResponse>(path, apiBody);
  }
}
