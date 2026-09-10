import { getPayoutRail } from '@/lib/payouts/rails/registry';
import { buildAirwallexBeneficiary } from '@/lib/payouts/rails/airwallex-beneficiary';
import {
  AIRWALLEX_QUOTES_CREATE_PATH,
  AIRWALLEX_SANDBOX_API_BASE,
  AIRWALLEX_TRANSFERS_CREATE_PATH,
  AIRWALLEX_TRANSFERS_VALIDATE_PATH,
  airwallexRequest,
  airwallexTransferCancelPath,
  airwallexTransferPath,
  assertAirwallexSandboxHost,
} from '@/lib/payouts/rails/airwallex-http';
import { airwallexQuoteRequestId, airwallexRequestId } from '@/lib/payouts/rails/airwallex-request-id';
import {
  airwallexProviderReference,
  airwallexStatusLabel,
  mapAirwallexStatusToProvvy,
  parseAirwallexTransferId,
} from '@/lib/payouts/rails/airwallex-status';
import {
  airwallexWebhookHeaders,
  verifyAirwallexSignature,
} from '@/lib/payouts/rails/airwallex-signature';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';
import type {
  AirwallexExecutionCredentials,
  CanonicalPayoutEvent,
  CanonicalPayoutInstruction,
  CanonicalPayoutStatus,
  PayoutAdapterSubmitResult,
  PayoutQuote,
  PayoutRailAdapter,
  PayoutRailExecutionContext,
} from '@/lib/payouts/rails/types';

export {
  AIRWALLEX_SANDBOX_API_BASE,
  AIRWALLEX_TRANSFERS_CREATE_PATH,
  AIRWALLEX_TRANSFERS_VALIDATE_PATH,
  AIRWALLEX_QUOTES_CREATE_PATH,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function publicAirwallexPayload(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!value) return {};
  const {
    token: _token,
    api_key: _apiKey,
    apiKey: _apiKey2,
    client_secret: _clientSecret,
    ...rest
  } = value;
  return rest;
}

function airwallexErrorMessage(body: Record<string, unknown> | null, fallback: string): string {
  if (typeof body?.message === 'string' && body.message.trim()) return body.message;
  if (typeof body?.code === 'string' && body.code.trim()) return `${fallback} (${body.code})`;
  return fallback;
}

async function resolveCredentials(
  instruction: CanonicalPayoutInstruction | null,
  context?: PayoutRailExecutionContext
): Promise<AirwallexExecutionCredentials> {
  if (context?.airwallex) return context.airwallex;
  const { getAirwallexConnection } = await import(
    '@/lib/payouts/rails/airwallex-connection.server'
  );
  const organizationId = instruction?.organizationId;
  const loaded = organizationId ? await getAirwallexConnection(organizationId) : null;
  if (!loaded) {
    throw new PayoutReleaseError(
      'AIRWALLEX_NOT_CONFIGURED',
      'Airwallex sandbox credentials are not configured for this organization'
    );
  }
  return loaded;
}

function assertAirwallexCanExecute(credentials: AirwallexExecutionCredentials): void {
  if (!credentials.clientId?.trim() || !credentials.apiKey?.trim()) {
    throw new PayoutReleaseError(
      'AIRWALLEX_NOT_CONFIGURED',
      'Airwallex API credentials are missing'
    );
  }
  if (credentials.environment !== 'sandbox') {
    throw new PayoutReleaseError(
      'AIRWALLEX_SANDBOX_ONLY',
      'Airwallex adapter is sandbox-only'
    );
  }
  if (!credentials.executionEnabled) {
    throw new PayoutReleaseError(
      'AIRWALLEX_EXECUTION_DISABLED',
      'Airwallex sandbox payout execution is not enabled. Set AIRWALLEX_PAYOUTS_ENABLED=true and enable the org connection.'
    );
  }
}

export function buildAirwallexTransferBody(
  instruction: CanonicalPayoutInstruction,
  credentials: AirwallexExecutionCredentials,
  requestId = airwallexRequestId(instruction.idempotencyKey)
): Record<string, unknown> {
  if (instruction.destinationKind && instruction.destinationKind !== 'BANK_ACCOUNT') {
    throw new PayoutReleaseError(
      'AIRWALLEX_DESTINATION_UNSUPPORTED',
      'Airwallex sandbox payouts require a BANK_ACCOUNT destination'
    );
  }

  const beneficiary = buildAirwallexBeneficiary(instruction.destination);
  if (!beneficiary) {
    throw new PayoutReleaseError(
      'AIRWALLEX_DESTINATION_INCOMPLETE',
      'Airwallex payouts require beneficiary_id or bank account details (account name plus account number or IBAN)'
    );
  }

  const details = instruction.destination.details ?? null;
  const transferCurrency = (
    readString(details, 'transfer_currency', 'transferCurrency', 'account_currency', 'accountCurrency') ??
    instruction.currency
  ).toUpperCase();
  const sourceCurrency = (
    readString(details, 'source_currency', 'sourceCurrency') ??
    credentials.sourceCurrency ??
    transferCurrency
  ).toUpperCase();
  const transferMethod =
    readString(details, 'transfer_method', 'transferMethod') === 'SWIFT' ||
    credentials.transferMethod === 'SWIFT'
      ? 'SWIFT'
      : 'LOCAL';
  const reason =
    readString(details, 'reason') ?? credentials.transferReason ?? null;
  if (!reason) {
    throw new PayoutReleaseError(
      'AIRWALLEX_REASON_REQUIRED',
      'Airwallex transfers require a payout reason in destination details or connection credentials'
    );
  }

  const body: Record<string, unknown> = {
    request_id: requestId,
    transfer_amount: instruction.amount,
    transfer_currency: transferCurrency,
    source_currency: sourceCurrency,
    transfer_method: transferMethod,
    reason,
    reference: instruction.payoutId.replace(/-/g, '').slice(0, 18),
    fee_paid_by: credentials.feePaidBy === 'BENEFICIARY' ? 'BENEFICIARY' : 'PAYER',
    ...beneficiary,
  };
  if (transferMethod === 'SWIFT') {
    body.swift_charge_option = 'SHARED';
  }
  return body;
}

function transferFromUnknown(raw: unknown): Record<string, unknown> | null {
  const record = asRecord(raw);
  if (!record) return null;
  const data = asRecord(record.data);
  const object = asRecord(data?.object) ?? data;
  if (object && (object.id || object.status || object.request_id)) return object;
  if (record.id || record.status || record.request_id) return record;
  return null;
}

export function airwallexWebhookEventId(parsed: unknown): string | null {
  const record = asRecord(parsed);
  if (typeof record?.id === 'string' && record.id.trim()) return record.id.trim();
  return null;
}

export function normalizeAirwallexWebhook(raw: unknown): CanonicalPayoutEvent | null {
  const envelope = asRecord(raw);
  const transfer = transferFromUnknown(raw);
  if (!transfer) return null;

  const name = typeof envelope?.name === 'string' ? envelope.name : null;
  if (name && !name.startsWith('payout.transfer.')) return null;

  const mapped = mapAirwallexStatusToProvvy(transfer.status);
  if (!mapped) return null;

  const transferId = typeof transfer.id === 'string' && transfer.id.trim() ? transfer.id.trim() : null;
  const requestId =
    typeof transfer.request_id === 'string' && transfer.request_id.trim()
      ? transfer.request_id.trim()
      : null;
  if (!transferId && !requestId) return null;

  const createdAt =
    typeof envelope?.created_at === 'string'
      ? envelope.created_at
      : typeof transfer.updated_at === 'string'
        ? transfer.updated_at
        : null;

  return {
    payoutId: undefined,
    idempotencyKey: undefined,
    railId: 'airwallex',
    providerReference: transferId ? airwallexProviderReference(transferId) : null,
    status: mapped === 'SUBMITTED' ? 'PROCESSING' : mapped,
    failedReason: mapped === 'FAILED' ? airwallexStatusLabel(transfer.status) : null,
    occurredAt: createdAt ? new Date(createdAt) : new Date(),
    providerPayload: publicAirwallexPayload({
      ...transfer,
      event_name: name,
      request_id: requestId,
      airwallexPaidNotFinal: transfer.status === 'PAID',
    }),
  };
}

export async function verifyAirwallexWebhook(
  headers: Record<string, string | undefined>,
  rawBody: string,
  lookupSecret: (accountId?: string | null) => Promise<string | null> = async (accountId) => {
    const envSecret = process.env.AIRWALLEX_WEBHOOK_SECRET?.trim();
    if (envSecret) return envSecret;
    const { getAirwallexWebhookSecret } = await import(
      '@/lib/payouts/rails/airwallex-connection.server'
    );
    return getAirwallexWebhookSecret(accountId);
  }
): Promise<boolean> {
  const { timestamp, signature } = airwallexWebhookHeaders(headers);
  const envelope = asRecord(safeJson(rawBody));
  const accountId =
    typeof envelope?.account_id === 'string' ? envelope.account_id : null;
  const secret = await lookupSecret(accountId);
  if (!secret) return false;
  return verifyAirwallexSignature({ timestamp, signature, rawBody, secret });
}

function safeJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

function mapTransferResult(
  body: Record<string, unknown> | null,
  fallbackStatus: CanonicalPayoutStatus['status']
): { status: CanonicalPayoutStatus['status']; providerReference: string | null; failedReason: string | null } {
  const transferId = typeof body?.id === 'string' ? body.id : null;
  const mapped = mapAirwallexStatusToProvvy(body?.status);
  return {
    status: mapped && mapped !== 'SUBMITTED' ? mapped : fallbackStatus,
    providerReference: transferId ? airwallexProviderReference(transferId) : null,
    failedReason: mapped === 'FAILED' ? airwallexStatusLabel(body?.status) : null,
  };
}

async function getTransferByRequestId(
  credentials: AirwallexExecutionCredentials,
  requestId: string,
  fetchImpl?: typeof fetch
): Promise<Record<string, unknown> | null> {
  const byPath = await airwallexRequest({
    credentials,
    method: 'GET',
    path: airwallexTransferPath(requestId),
    fetchImpl,
  });
  if (byPath.status < 400 && byPath.body?.id) return byPath.body;

  const listed = await airwallexRequest({
    credentials,
    method: 'GET',
    path: `/api/v1/transfers?request_id=${encodeURIComponent(requestId)}`,
    fetchImpl,
  });
  const items = Array.isArray(listed.body?.items) ? listed.body.items : [];
  const first = asRecord(items[0]);
  return first;
}

export const AirwallexPayoutRailAdapter: PayoutRailAdapter = {
  railId: 'airwallex',

  getCapabilities() {
    return getPayoutRail('airwallex');
  },

  async quote(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<PayoutQuote> {
    const credentials = await resolveCredentials(instruction, context);
    if (!credentials.clientId || !credentials.apiKey) {
      throw new PayoutReleaseError(
        'AIRWALLEX_NOT_CONFIGURED',
        'Airwallex sandbox credentials are not configured'
      );
    }

    const body = buildAirwallexTransferBody(
      instruction,
      credentials,
      airwallexQuoteRequestId(instruction.idempotencyKey)
    );
    const sourceCurrency = String(body.source_currency);
    const transferCurrency = String(body.transfer_currency);
    const raw: Record<string, unknown> = {
      source_currency: sourceCurrency,
      transfer_currency: transferCurrency,
      fundsModel: 'unconfirmed',
      onBehalfOf: Boolean(credentials.onBehalfOfAccountId),
    };

    if (sourceCurrency !== transferCurrency) {
      const quote = await airwallexRequest({
        credentials,
        method: 'POST',
        path: AIRWALLEX_QUOTES_CREATE_PATH,
        body: {
          sell_currency: sourceCurrency,
          buy_currency: transferCurrency,
          sell_amount: instruction.amount,
          validity: 'HR_1',
        },
        fetchImpl: context?.fetchImpl,
      });
      if (quote.status >= 400 || !quote.body) {
        throw new PayoutReleaseError(
          'AIRWALLEX_QUOTE_FAILED',
          airwallexErrorMessage(quote.body, 'Airwallex FX quote failed'),
          502
        );
      }
      raw.quote = publicAirwallexPayload(quote.body);
      if (typeof quote.body.id === 'string') body.quote_id = quote.body.id;
    }

    const validated = await airwallexRequest({
      credentials,
      method: 'POST',
      path: AIRWALLEX_TRANSFERS_VALIDATE_PATH,
      body,
      fetchImpl: context?.fetchImpl,
    });
    if (validated.status >= 400 || !validated.body) {
      throw new PayoutReleaseError(
        'AIRWALLEX_QUOTE_FAILED',
        airwallexErrorMessage(validated.body, 'Airwallex transfer validate failed'),
        502
      );
    }

    const feeAmount =
      validated.body.fee_amount != null ? String(validated.body.fee_amount) : '0';
    const feeCurrency =
      typeof validated.body.fee_currency === 'string'
        ? validated.body.fee_currency
        : sourceCurrency;
    raw.validate = publicAirwallexPayload(validated.body);

    return {
      railId: 'airwallex',
      feeAmount,
      feeCurrency,
      estimatedSettlementHint: getPayoutRail('airwallex').typicalSettlementHint,
      fxCostHint:
        sourceCurrency === transferCurrency
          ? 'Same-currency transfer; no FX quote created'
          : typeof asRecord(raw.quote)?.client_rate === 'number' ||
              typeof asRecord(raw.quote)?.client_rate === 'string'
            ? `Airwallex client_rate ${String(asRecord(raw.quote)?.client_rate)}`
            : 'FX quote returned by Airwallex',
      raw,
    };
  },

  async submit(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<PayoutAdapterSubmitResult> {
    const existingId = parseAirwallexTransferId(instruction.providerReference);
    if (existingId) {
      return {
        providerReference: airwallexProviderReference(existingId),
        status: instruction.status === 'PAID' ? 'PAID' : 'PROCESSING',
        providerPayload: { reusedExistingReference: true },
      };
    }

    const credentials = await resolveCredentials(instruction, context);
    assertAirwallexCanExecute(credentials);
    const requestId = airwallexRequestId(instruction.idempotencyKey);
    const body = buildAirwallexTransferBody(instruction, credentials, requestId);

    const response = await airwallexRequest({
      credentials,
      method: 'POST',
      path: AIRWALLEX_TRANSFERS_CREATE_PATH,
      body,
      fetchImpl: context?.fetchImpl,
    });

    const code = typeof response.body?.code === 'string' ? response.body.code : null;
    if (
      response.status === 409 ||
      code === 'request_pending' ||
      code === 'request_id_duplicate'
    ) {
      const existing = await getTransferByRequestId(
        credentials,
        requestId,
        context?.fetchImpl
      );
      const mapped = mapTransferResult(existing, 'PROCESSING');
      return {
        providerReference: mapped.providerReference ?? instruction.providerReference,
        status: 'PROCESSING',
        providerPayload: {
          request_id: requestId,
          duplicateOrPending: true,
          code,
          ...publicAirwallexPayload(existing),
        },
      };
    }

    if (response.status >= 400 || !response.body?.id) {
      throw new PayoutReleaseError(
        'AIRWALLEX_SUBMIT_FAILED',
        airwallexErrorMessage(response.body, 'Airwallex transfer create failed'),
        502,
        { code, httpStatus: response.status }
      );
    }

    const mapped = mapTransferResult(response.body, 'PROCESSING');
    return {
      providerReference: mapped.providerReference,
      status: mapped.status,
      providerPayload: publicAirwallexPayload({
        ...response.body,
        request_id: requestId,
        provvy_idempotency_key: instruction.idempotencyKey,
        on_behalf_of: credentials.onBehalfOfAccountId ?? null,
        funds_model: 'unconfirmed',
      }),
    };
  },

  async syncStatus(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<CanonicalPayoutStatus> {
    const transferId = parseAirwallexTransferId(instruction.providerReference);
    const credentials = await resolveCredentials(instruction, context);
    const requestId = airwallexRequestId(instruction.idempotencyKey);

    const body = transferId
      ? (
          await airwallexRequest({
            credentials,
            method: 'GET',
            path: airwallexTransferPath(transferId),
            fetchImpl: context?.fetchImpl,
          })
        ).body
      : await getTransferByRequestId(credentials, requestId, context?.fetchImpl);

    if (!body?.id && !body?.status) {
      return {
        status:
          instruction.status === 'PAID' || instruction.status === 'FAILED'
            ? instruction.status
            : 'PROCESSING',
        providerReference: instruction.providerReference,
        failedReason: 'Airwallex transfer is not stored yet; waiting for webhook or a successful submit',
      };
    }

    const mapped = mapTransferResult(body, 'PROCESSING');
    return {
      status: mapped.status,
      providerReference: mapped.providerReference ?? instruction.providerReference,
      failedReason: mapped.failedReason,
      providerPayload: publicAirwallexPayload({
        ...body,
        request_id: requestId,
        airwallexPaidNotFinal: body?.status === 'PAID',
      }),
    };
  },

  async cancel(instruction: CanonicalPayoutInstruction, context?: PayoutRailExecutionContext) {
    const transferId = parseAirwallexTransferId(instruction.providerReference);
    if (!transferId) {
      throw new PayoutReleaseError(
        'AIRWALLEX_CANCEL_UNAVAILABLE',
        'Airwallex cancel requires a stored transfer id'
      );
    }
    const credentials = await resolveCredentials(instruction, context);
    const response = await airwallexRequest({
      credentials,
      method: 'POST',
      path: airwallexTransferCancelPath(transferId),
      fetchImpl: context?.fetchImpl,
    });
    if (response.status >= 400) {
      throw new PayoutReleaseError(
        'AIRWALLEX_CANCEL_FAILED',
        airwallexErrorMessage(response.body, 'Airwallex transfer cancel failed'),
        502
      );
    }
  },

  async verifyWebhook(headers: Record<string, string | undefined>, rawBody: string) {
    return verifyAirwallexWebhook(headers, rawBody);
  },

  webhookEventId(parsed: unknown) {
    return airwallexWebhookEventId(parsed);
  },

  normalizeWebhook(raw: unknown) {
    return normalizeAirwallexWebhook(raw);
  },
};

export function assertAirwallexAdapterSandboxUrl(url: string): void {
  assertAirwallexSandboxHost(url);
}
