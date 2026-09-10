import { getPayoutRail } from '@/lib/payouts/rails/registry';
import { CREGIS_SUCCESS_CODE, cregisSignedPost } from '@/lib/payouts/rails/cregis-http';
import { verifyCregisSignature } from '@/lib/payouts/rails/cregis-signature';
import {
  cregisProviderReference,
  cregisStatusLabel,
  mapCregisStatusToProvvy,
  parseCregisCid,
} from '@/lib/payouts/rails/cregis-status';
import {
  resolveCregisDestination,
  resolveCregisSubmitAmount,
} from '@/lib/payouts/rails/cregis-currency';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';
import type {
  CanonicalPayoutEvent,
  CanonicalPayoutInstruction,
  CanonicalPayoutStatus,
  CregisExecutionCredentials,
  PayoutAdapterSubmitResult,
  PayoutRailAdapter,
  PayoutRailExecutionContext,
} from '@/lib/payouts/rails/types';

export const CREGIS_PAYOUT_CREATE_PATH = '/api/v2/payout';
export const CREGIS_PAYOUT_QUERY_PATH = '/api/v1/payout/query';
export { CREGIS_SUCCESS_CODE };
export const CREGIS_DUPLICATE_CODES = new Set(['E0009', 'E0018']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function publicCregisPayload(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!value) return {};
  const { sign: _sign, apiKey: _apiKey, api_key: _api_key, ...rest } = value;
  return rest;
}

async function resolveCredentials(
  instruction: CanonicalPayoutInstruction | null,
  context?: PayoutRailExecutionContext
): Promise<CregisExecutionCredentials> {
  if (context?.cregis) return context.cregis;
  const { getCregisConnection } = await import('@/lib/payouts/rails/cregis-connection.server');
  const organizationId = instruction?.organizationId;
  const loaded = organizationId ? await getCregisConnection(organizationId) : null;
  if (!loaded) {
    throw new PayoutReleaseError(
      'CREGIS_NOT_CONFIGURED',
      'Cregis payout credentials are not configured for this organization'
    );
  }
  return loaded;
}

function assertCregisCanExecute(credentials: CregisExecutionCredentials): void {
  if (!credentials.apiKey?.trim()) {
    throw new PayoutReleaseError(
      'CREGIS_NOT_CONFIGURED',
      'Cregis API credentials are missing'
    );
  }
  if (!credentials.gatewayBaseUrl?.trim()) {
    throw new PayoutReleaseError(
      'CREGIS_NOT_CONFIGURED',
      'Cregis gateway URL is missing'
    );
  }
  if (credentials.pid == null || !Number.isFinite(credentials.pid)) {
    throw new PayoutReleaseError('CREGIS_NOT_CONFIGURED', 'Cregis pid is missing');
  }
  if (
    credentials.environment === 'production' &&
    process.env.CREGIS_PRODUCTION_PAYOUTS_ENABLED !== 'true'
  ) {
    throw new PayoutReleaseError(
      'CREGIS_PRODUCTION_BLOCKED',
      'Cregis production execution is disabled'
    );
  }
  if (!credentials.executionEnabled) {
    throw new PayoutReleaseError(
      'CREGIS_EXECUTION_DISABLED',
      'Cregis payout execution is not enabled. Set CREGIS_PAYOUTS_ENABLED=true and enable the org connection.'
    );
  }
}

export function buildCregisPayoutCreateBody(
  instruction: CanonicalPayoutInstruction,
  credentials: CregisExecutionCredentials
): Record<string, unknown> {
  if (instruction.idempotencyKey.length > 128) {
    throw new PayoutReleaseError(
      'CREGIS_IDEMPOTENCY_TOO_LONG',
      'Cregis third_party_id must be 128 characters or fewer'
    );
  }

  const destination = resolveCregisDestination(instruction.destination);
  if (!destination) {
    throw new PayoutReleaseError(
      'CREGIS_DESTINATION_INCOMPLETE',
      'Cregis payouts require a wallet address and a documented Cregis currency (asset + network, or chain_id@token_id)'
    );
  }

  const amount = resolveCregisSubmitAmount({
    payoutAmount: instruction.amount,
    payoutCurrency: instruction.currency,
    details: instruction.destination.details,
    record: destination.record,
  });
  if (!amount) {
    throw new PayoutReleaseError(
      'CREGIS_AMOUNT_AMBIGUOUS',
      'Cregis amount is token units. Provide destination tokenAmount/cregisAmount, set amountIsTokenUnits, or use a USD payout to USDT/USDC.'
    );
  }

  const body: Record<string, unknown> = {
    pid: credentials.pid,
    currency: destination.currency,
    to_address: destination.address,
    amount: amount.amount,
    third_party_id: instruction.idempotencyKey,
  };
  if (credentials.walletId != null) body.wallet_id = credentials.walletId;
  if (credentials.fromAddress) body.from_address = credentials.fromAddress;
  const callbackUrl = credentials.callbackUrl;
  if (callbackUrl) body.callback_url = callbackUrl;
  if (destination.memo) body.memo = destination.memo;
  body.remark = `Provvy payout ${instruction.payoutId}`.slice(0, 256);
  return body;
}

export function cregisWebhookEventId(parsed: unknown): string | null {
  const record = asRecord(parsed);
  if (!record) return null;
  const cid = record.cid;
  const status = record.status;
  if (cid == null || status == null) return null;
  return `cregis:${cid}:${status}`;
}

export function normalizeCregisWebhook(raw: unknown): CanonicalPayoutEvent | null {
  const record = asRecord(raw);
  if (!record) return null;
  const mapped = mapCregisStatusToProvvy(record.status);
  if (!mapped) return null;

  const thirdPartyId =
    typeof record.third_party_id === 'string' && record.third_party_id.trim()
      ? record.third_party_id.trim()
      : null;
  const cid = record.cid;
  if (cid == null && !thirdPartyId) return null;

  return {
    payoutId: undefined,
    idempotencyKey: thirdPartyId ?? undefined,
    railId: 'cregis',
    providerReference: cid != null ? cregisProviderReference(String(cid)) : null,
    status: mapped,
    failedReason: mapped === 'FAILED' ? cregisStatusLabel(record.status) : null,
    occurredAt:
      typeof record.block_time === 'number' ? new Date(record.block_time) : new Date(),
    providerPayload: publicCregisPayload(record),
  };
}

export async function verifyCregisWebhookBody(
  rawBody: string,
  lookupCredentials: (pid: number) => Promise<CregisExecutionCredentials | null> = async (pid) => {
    const { getCregisConnectionByPid } = await import(
      '@/lib/payouts/rails/cregis-connection.server'
    );
    return getCregisConnectionByPid(pid);
  }
): Promise<boolean> {
  const parsed = asRecord(safeJson(rawBody));
  if (!parsed) return false;
  const pid = Number(parsed.pid);
  if (!Number.isFinite(pid)) return false;
  const credentials = await lookupCredentials(pid);
  if (!credentials) return false;
  return verifyCregisSignature(parsed, credentials.apiKey);
}

function safeJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

export const CregisPayoutRailAdapter: PayoutRailAdapter = {
  railId: 'cregis',

  getCapabilities() {
    return getPayoutRail('cregis');
  },

  async submit(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<PayoutAdapterSubmitResult> {
    const existingCid = parseCregisCid(instruction.providerReference);
    if (existingCid) {
      return {
        providerReference: cregisProviderReference(existingCid),
        status: instruction.status === 'PAID' ? 'PAID' : 'PROCESSING',
        providerPayload: { reusedExistingReference: true },
      };
    }

    const credentials = await resolveCredentials(instruction, context);
    assertCregisCanExecute(credentials);
    const body = buildCregisPayoutCreateBody(instruction, credentials);
    const response = await cregisSignedPost({
      credentials,
      path: CREGIS_PAYOUT_CREATE_PATH,
      body,
      fetchImpl: context?.fetchImpl,
    });

    if (response.code && CREGIS_DUPLICATE_CODES.has(response.code)) {
      return {
        providerReference: instruction.providerReference,
        status: 'PROCESSING',
        providerPayload: {
          duplicateBusinessNumber: true,
          code: response.code,
          msg: response.msg ?? null,
        },
      };
    }

    if (response.code !== CREGIS_SUCCESS_CODE || !response.data) {
      throw new PayoutReleaseError(
        'CREGIS_SUBMIT_FAILED',
        response.msg || `Cregis payout create failed (${response.code ?? 'unknown'})`,
        502,
        { code: response.code ?? null }
      );
    }

    const cid = response.data.cid;
    if (cid == null) {
      throw new PayoutReleaseError(
        'CREGIS_SUBMIT_FAILED',
        'Cregis payout create succeeded without a cid'
      );
    }

    return {
      providerReference: cregisProviderReference(String(cid)),
      status: 'PROCESSING',
      providerPayload: publicCregisPayload({
        cid,
        third_party_id: instruction.idempotencyKey,
      }),
    };
  },

  async syncStatus(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<CanonicalPayoutStatus> {
    const cid = parseCregisCid(instruction.providerReference);
    if (!cid) {
      return {
        status:
          instruction.status === 'PAID' || instruction.status === 'FAILED'
            ? instruction.status
            : 'PROCESSING',
        providerReference: instruction.providerReference,
        failedReason: 'Cregis cid is not stored yet; waiting for webhook or a successful submit',
      };
    }

    const credentials = await resolveCredentials(instruction, context);
    const response = await cregisSignedPost({
      credentials,
      path: CREGIS_PAYOUT_QUERY_PATH,
      body: { pid: credentials.pid, cid: Number(cid) },
      fetchImpl: context?.fetchImpl,
    });

    if (response.code !== CREGIS_SUCCESS_CODE || !response.data) {
      throw new PayoutReleaseError(
        'CREGIS_QUERY_FAILED',
        response.msg || `Cregis payout query failed (${response.code ?? 'unknown'})`,
        502
      );
    }

    const mapped = mapCregisStatusToProvvy(response.data.status);
    if (!mapped) {
      return {
        status:
          instruction.status === 'PAID' ||
          instruction.status === 'FAILED' ||
          instruction.status === 'PROCESSING' ||
          instruction.status === 'SUBMITTED'
            ? instruction.status
            : 'PROCESSING',
        providerReference: cregisProviderReference(cid),
        failedReason: `Unknown Cregis status ${String(response.data.status)}`,
        providerPayload: publicCregisPayload(response.data),
      };
    }

    return {
      status: mapped,
      providerReference: cregisProviderReference(cid),
      failedReason: mapped === 'FAILED' ? cregisStatusLabel(response.data.status) : null,
      providerPayload: publicCregisPayload(response.data),
    };
  },

  async verifyWebhook(_headers: Record<string, string | undefined>, rawBody: string) {
    return verifyCregisWebhookBody(rawBody);
  },

  webhookEventId(parsed: unknown) {
    return cregisWebhookEventId(parsed);
  },

  webhookAcknowledgement() {
    return { body: 'success', contentType: 'text/plain; charset=utf-8' };
  },

  normalizeWebhook(raw: unknown) {
    return normalizeCregisWebhook(raw);
  },
};
