import fs from 'node:fs';
import path from 'node:path';
import {
  AIRWALLEX_SANDBOX_API_BASE,
  AIRWALLEX_TRANSFERS_CREATE_PATH,
  AirwallexPayoutRailAdapter,
  buildAirwallexTransferBody,
  normalizeAirwallexWebhook,
} from '@/lib/payouts/rails/airwallex.adapter';
import { airwallexRequestId } from '@/lib/payouts/rails/airwallex-request-id';
import { resetAirwallexTokenCache } from '@/lib/payouts/rails/airwallex-http';
import { signAirwallexWebhook } from '@/lib/payouts/rails/airwallex-signature';
import { selectPayoutRail } from '@/lib/payouts/select-payout-rail';
import type {
  AirwallexExecutionCredentials,
  CanonicalPayoutInstruction,
} from '@/lib/payouts/rails/types';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';

const credentials: AirwallexExecutionCredentials = {
  clientId: 'client-sandbox',
  apiKey: 'key-sandbox',
  webhookSecret: 'whsec-sandbox',
  executionEnabled: true,
  environment: 'sandbox',
  transferReason: 'professional_business_services',
  sourceCurrency: 'SGD',
};

function instruction(
  overrides: Partial<CanonicalPayoutInstruction> = {}
): CanonicalPayoutInstruction {
  return {
    payoutId: '550e8400-e29b-41d4-a716-446655440000',
    organizationId: 'org-1',
    batchId: 'batch-1',
    payeeUserId: 'payee-1',
    amount: '50',
    currency: 'SGD',
    destinationKind: 'BANK_ACCOUNT',
    railId: 'airwallex',
    idempotencyKey: 'payout:org-1:payout-1',
    providerReference: null,
    status: 'SUBMITTED',
    destination: {
      kind: 'BANK_ACCOUNT',
      payoutMethodId: 'method-1',
      methodType: 'BANK_TRANSFER',
      handle: null,
      details: {
        accountName: 'Acme Pte Ltd',
        accountNumber: '12345678',
        bsb: '013-943',
        reason: 'professional_business_services',
      },
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchImplFor(handlers: {
  login?: () => Response;
  other: (url: string, init?: RequestInit) => Response | Promise<Response>;
}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/v1/authentication/login')) {
      return (
        handlers.login?.() ??
        jsonResponse({ token: 'sandbox-token', expires_at: '2099-01-01T00:00:00+0000' }, 201)
      );
    }
    return handlers.other(url, init);
  }) as unknown as typeof fetch;
}

describe('Airwallex adapter capabilities', () => {
  it('advertises sandbox bank-account capabilities without assuming a funds model', () => {
    const capabilities = AirwallexPayoutRailAdapter.getCapabilities();
    expect(capabilities.railId).toBe('airwallex');
    expect(capabilities.implemented).toBe(true);
    expect(capabilities.supportsQuote).toBe(true);
    expect(capabilities.supportsCancel).toBe(true);
    expect(capabilities.acceptsInboundWebhooks).toBe(true);
    expect(capabilities.supportedDestinationKinds).toEqual(['BANK_ACCOUNT']);
    expect(AirwallexPayoutRailAdapter.quote).toBeDefined();
  });

  it('is never auto-selected while the customer-funds model is unconfirmed', () => {
    expect(
      selectPayoutRail({
        currency: 'SGD',
        methodType: 'BANK_TRANSFER',
        merchantHederaReady: false,
      })
    ).toBe('manual');
  });

  it('does not write canonical payout or obligation state', () => {
    const adapter = fs.readFileSync(
      path.join(process.cwd(), 'lib/payouts/rails/airwallex.adapter.ts'),
      'utf8'
    );
    const http = fs.readFileSync(
      path.join(process.cwd(), 'lib/payouts/rails/airwallex-http.ts'),
      'utf8'
    );
    expect(adapter).not.toMatch(/prisma\.(payouts|payout_batches|commission_|deal_network|ledger_)/);
    expect(adapter).not.toContain('executePayoutRelease');
    expect(http).toContain('api.sandbox.airwallex.com');
    expect(http).toContain('AIRWALLEX_SANDBOX_ONLY');
    expect(http).not.toContain('https://api.airwallex.com');
  });
});

describe('Airwallex request mapping', () => {
  it('maps Provvy idempotency_key to a UUID v5 request_id and keeps the original key', () => {
    const body = buildAirwallexTransferBody(instruction(), credentials);
    expect(body.request_id).toBe(airwallexRequestId('payout:org-1:payout-1'));
    expect(body.request_id).not.toBe('payout:org-1:payout-1');
    expect(String(body.request_id)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(body.transfer_amount).toBe('50');
    expect(body.transfer_currency).toBe('SGD');
    expect(body.source_currency).toBe('SGD');
    expect(body.transfer_method).toBe('LOCAL');
    expect(body.fee_paid_by).toBe('PAYER');
    expect(body.beneficiary).toMatchObject({
      entity_type: 'COMPANY',
      company_name: 'Acme Pte Ltd',
      bank_details: {
        account_name: 'Acme Pte Ltd',
        account_number: '12345678',
        account_routing_type1: 'bsb',
        account_routing_value1: '013943',
        bank_country_code: 'AU',
      },
    });
  });

  it('uses beneficiary_id when destination details already have one', () => {
    const body = buildAirwallexTransferBody(
      instruction({
        destination: {
          kind: 'BANK_ACCOUNT',
          payoutMethodId: 'method-1',
          methodType: 'BANK_TRANSFER',
          handle: null,
          details: {
            beneficiary_id: '9a45987e-cffc-4f0a-81d7-82e80f0ce336',
            reason: 'travel',
          },
        },
      }),
      credentials
    );
    expect(body.beneficiary_id).toBe('9a45987e-cffc-4f0a-81d7-82e80f0ce336');
    expect(body.beneficiary).toBeUndefined();
  });
});

describe('Airwallex submit mapping', () => {
  beforeEach(() => {
    resetAirwallexTokenCache();
  });

  it('logs in once, posts to the sandbox host, and maps SCHEDULED to PROCESSING', async () => {
    const fetchImpl = fetchImplFor({
      other: (url, init) => {
        expect(url).toBe(`${AIRWALLEX_SANDBOX_API_BASE}${AIRWALLEX_TRANSFERS_CREATE_PATH}`);
        const posted = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(posted.request_id).toBe(airwallexRequestId('payout:org-1:payout-1'));
        return jsonResponse({
          id: 'tr_sandbox_1',
          status: 'SCHEDULED',
          request_id: posted.request_id,
        });
      },
    });

    const result = await AirwallexPayoutRailAdapter.submit(instruction(), {
      airwallex: credentials,
      fetchImpl,
    });
    expect(result).toMatchObject({
      providerReference: 'airwallex:tr_sandbox_1',
      status: 'PROCESSING',
    });
    expect(result.providerPayload).toMatchObject({
      request_id: airwallexRequestId('payout:org-1:payout-1'),
      provvy_idempotency_key: 'payout:org-1:payout-1',
      funds_model: 'unconfirmed',
      on_behalf_of: null,
    });
  });

  it('sends x-on-behalf-of only when a connected account id is supplied', async () => {
    const headers: string[] = [];
    const fetchImpl = fetchImplFor({
      other: (_url, init) => {
        const h = init?.headers as Record<string, string>;
        if (h['x-on-behalf-of']) headers.push(h['x-on-behalf-of']);
        return jsonResponse({ id: 'tr_ca', status: 'PROCESSING' });
      },
    });

    await AirwallexPayoutRailAdapter.submit(instruction(), {
      airwallex: { ...credentials, onBehalfOfAccountId: 'acct_connected' },
      fetchImpl,
    });
    expect(headers).toEqual(['acct_connected']);

    resetAirwallexTokenCache();
    headers.length = 0;
    await AirwallexPayoutRailAdapter.submit(instruction(), {
      airwallex: credentials,
      fetchImpl,
    });
    expect(headers).toEqual([]);
  });

  it('reuses an existing transfer id instead of creating another request', async () => {
    const fetchImpl = jest.fn();
    const result = await AirwallexPayoutRailAdapter.submit(
      instruction({ providerReference: 'airwallex:tr_existing' }),
      { airwallex: credentials, fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.providerReference).toBe('airwallex:tr_existing');
    expect(result.status).toBe('PROCESSING');
  });

  it('fails closed when credentials, sandbox, or execution gates are missing', async () => {
    await expect(
      AirwallexPayoutRailAdapter.submit(instruction(), {
        airwallex: { ...credentials, executionEnabled: false },
        fetchImpl: jest.fn() as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: 'AIRWALLEX_EXECUTION_DISABLED' });

    await expect(
      AirwallexPayoutRailAdapter.submit(instruction(), {
        airwallex: { ...credentials, clientId: '' },
        fetchImpl: jest.fn() as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: 'AIRWALLEX_NOT_CONFIGURED' });

    await expect(
      AirwallexPayoutRailAdapter.submit(instruction(), {
        airwallex: { ...credentials, environment: 'production' as unknown as 'sandbox' },
        fetchImpl: jest.fn() as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: 'AIRWALLEX_SANDBOX_ONLY' });

    await expect(
      AirwallexPayoutRailAdapter.submit(instruction(), {
        airwallex: credentials,
        fetchImpl: fetchImplFor({
          other: () => jsonResponse({ code: 'balance_insufficient', message: 'no funds' }, 400),
        }),
      })
    ).rejects.toBeInstanceOf(PayoutReleaseError);
  });
});

describe('Airwallex status and webhooks', () => {
  beforeEach(() => {
    resetAirwallexTokenCache();
  });

  it('maps documented transfer statuses and leaves SENT as PROCESSING', async () => {
    const query = async (status: string) =>
      AirwallexPayoutRailAdapter.syncStatus(
        instruction({ providerReference: 'airwallex:tr_55' }),
        {
          airwallex: credentials,
          fetchImpl: fetchImplFor({
            other: () => jsonResponse({ id: 'tr_55', status }),
          }),
        }
      );

    await expect(query('SCHEDULED')).resolves.toMatchObject({ status: 'PROCESSING' });
    await expect(query('SENT')).resolves.toMatchObject({ status: 'PROCESSING' });
    await expect(query('PAID')).resolves.toMatchObject({ status: 'PAID' });
    await expect(query('FAILED')).resolves.toMatchObject({ status: 'FAILED' });
    await expect(query('CANCELLED')).resolves.toMatchObject({ status: 'FAILED' });
  });

  it('verifies HMAC(timestamp + rawBody) and normalizes payout.transfer events', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_transfer_paid',
      name: 'payout.transfer.paid',
      account_id: 'acct_1',
      created_at: '2026-09-10T00:00:00+0000',
      data: {
        object: {
          id: 'tr_55',
          status: 'PAID',
          request_id: airwallexRequestId('payout:org-1:payout-1'),
        },
      },
    });
    const timestamp = String(Date.now());
    const previous = process.env.AIRWALLEX_WEBHOOK_SECRET;
    process.env.AIRWALLEX_WEBHOOK_SECRET = credentials.webhookSecret ?? 'whsec-sandbox';
    try {
      const verified = await AirwallexPayoutRailAdapter.verifyWebhook?.(
        {
          'x-timestamp': timestamp,
          'x-signature': signAirwallexWebhook(timestamp, rawBody, process.env.AIRWALLEX_WEBHOOK_SECRET),
        },
        rawBody
      );
      expect(verified).toBe(true);
      expect(
        await AirwallexPayoutRailAdapter.verifyWebhook?.(
          { 'x-timestamp': timestamp, 'x-signature': 'deadbeef' },
          rawBody
        )
      ).toBe(false);
    } finally {
      process.env.AIRWALLEX_WEBHOOK_SECRET = previous;
    }

    expect(normalizeAirwallexWebhook(JSON.parse(rawBody))).toMatchObject({
      railId: 'airwallex',
      status: 'PAID',
      providerReference: 'airwallex:tr_55',
    });
    expect(normalizeAirwallexWebhook(JSON.parse(rawBody))?.providerPayload).toMatchObject({
      airwallexPaidNotFinal: true,
    });
    expect(
      normalizeAirwallexWebhook({
        id: 'evt_sent',
        name: 'payout.transfer.sent',
        data: { object: { id: 'tr_55', status: 'SENT' } },
      })
    ).toMatchObject({ status: 'PROCESSING' });
  });
});
