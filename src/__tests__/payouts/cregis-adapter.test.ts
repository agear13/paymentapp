import fs from 'node:fs';
import path from 'node:path';
import {
  CREGIS_DUPLICATE_CODES,
  CREGIS_PAYOUT_CREATE_PATH,
  CREGIS_PAYOUT_QUERY_PATH,
  CregisPayoutRailAdapter,
  buildCregisPayoutCreateBody,
} from '@/lib/payouts/rails/cregis.adapter';
import { signCregisPayload } from '@/lib/payouts/rails/cregis-signature';
import type {
  CanonicalPayoutInstruction,
  CregisExecutionCredentials,
} from '@/lib/payouts/rails/types';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';

const credentials: CregisExecutionCredentials = {
  apiKey: 'test-cregis-api-key',
  pid: 1382528827416576,
  gatewayBaseUrl: 'https://gateway.example.test',
  callbackUrl: 'https://app.example.test/api/payouts/webhooks/cregis',
  executionEnabled: true,
};

function instruction(
  overrides: Partial<CanonicalPayoutInstruction> = {}
): CanonicalPayoutInstruction {
  return {
    payoutId: 'payout-1',
    organizationId: 'org-1',
    batchId: 'batch-1',
    payeeUserId: 'payee-1',
    amount: '25',
    currency: 'USD',
    destinationKind: 'WALLET',
    railId: 'cregis',
    idempotencyKey: 'payout:org-1:payout-1',
    providerReference: null,
    status: 'SUBMITTED',
    destination: {
      kind: 'WALLET',
      payoutMethodId: 'method-1',
      methodType: 'CRYPTO',
      handle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      details: { asset: 'USDT', network: 'tron' },
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

describe('Cregis adapter capabilities', () => {
  it('advertises only documented executable capabilities', () => {
    const capabilities = CregisPayoutRailAdapter.getCapabilities();
    expect(capabilities.railId).toBe('cregis');
    expect(capabilities.implemented).toBe(true);
    expect(capabilities.supportsQuote).toBe(false);
    expect(capabilities.supportsPrepare).toBe(false);
    expect(capabilities.supportsCancel).toBe(false);
    expect(capabilities.acceptsInboundWebhooks).toBe(true);
    expect(capabilities.supportedDestinationKinds).toEqual(['WALLET']);
    expect(CregisPayoutRailAdapter.quote).toBeUndefined();
    expect(CregisPayoutRailAdapter.prepare).toBeUndefined();
  });

  it('does not write canonical payout or obligation state', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/payouts/rails/cregis.adapter.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/prisma\.(payouts|payout_batches|commission_|deal_network|ledger_)/);
    expect(source).not.toContain('executePayoutRelease');
  });
});

describe('Cregis request mapping', () => {
  it('maps Provvy idempotency_key to Cregis third_party_id', () => {
    const body = buildCregisPayoutCreateBody(instruction(), credentials);
    expect(body.third_party_id).toBe('payout:org-1:payout-1');
    expect(body.currency).toBe('195@TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    expect(body.to_address).toBe('TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS');
    expect(body.amount).toBe('25');
    expect(body.pid).toBe(credentials.pid);
    expect(body.callback_url).toBe(credentials.callbackUrl);
  });

  it('uses an explicit token amount instead of inventing FX', () => {
    const body = buildCregisPayoutCreateBody(
      instruction({
        currency: 'AUD',
        amount: '100',
        destination: {
          kind: 'WALLET',
          payoutMethodId: 'method-1',
          methodType: 'CRYPTO',
          handle: 'bc1qexample',
          details: { asset: 'BTC', network: 'bitcoin', tokenAmount: '0.01' },
        },
      }),
      credentials
    );
    expect(body.amount).toBe('0.01');
    expect(body.currency).toBe('0@0');
  });

  it('refuses BTC amounts that would invent FX', () => {
    expect(() =>
      buildCregisPayoutCreateBody(
        instruction({
          destination: {
            kind: 'WALLET',
            payoutMethodId: 'method-1',
            methodType: 'CRYPTO',
            handle: 'bc1qexample',
            details: { asset: 'BTC', network: 'bitcoin' },
          },
        }),
        credentials
      )
    ).toThrow(/token units/);
  });
});

describe('Cregis submit mapping', () => {
  it('maps a successful create to PROCESSING and cregis:{cid}', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ code: '00000', msg: 'ok', data: { cid: 1382688606330880 } })
    );
    const result = await CregisPayoutRailAdapter.submit(instruction(), {
      cregis: credentials,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({
      providerReference: 'cregis:1382688606330880',
      status: 'PROCESSING',
      providerPayload: {
        cid: 1382688606330880,
        third_party_id: 'payout:org-1:payout-1',
      },
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://gateway.example.test${CREGIS_PAYOUT_CREATE_PATH}`);
    const posted = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(posted.third_party_id).toBe('payout:org-1:payout-1');
    expect(posted.sign).toBe(signCregisPayload({ ...posted, sign: undefined }, credentials.apiKey));
  });

  it('maps duplicate business-number errors to PROCESSING without a new id', async () => {
    for (const code of CREGIS_DUPLICATE_CODES) {
      const result = await CregisPayoutRailAdapter.submit(instruction(), {
        cregis: credentials,
        fetchImpl: (async () =>
          jsonResponse({ code, msg: 'duplicate' })) as unknown as typeof fetch,
      });
      expect(result.status).toBe('PROCESSING');
      expect(result.providerReference).toBeNull();
      expect(result.providerPayload).toMatchObject({ duplicateBusinessNumber: true, code });
    }
  });

  it('reuses an existing cid instead of generating a new request id', async () => {
    const fetchImpl = jest.fn();
    const result = await CregisPayoutRailAdapter.submit(
      instruction({ providerReference: 'cregis:999' }),
      { cregis: credentials, fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.providerReference).toBe('cregis:999');
    expect(result.status).toBe('PROCESSING');
  });

  it('fails closed when credentials, gateway, production, or execution gates are missing', async () => {
    await expect(
      CregisPayoutRailAdapter.submit(instruction(), {
        cregis: { ...credentials, executionEnabled: false },
        fetchImpl: jest.fn() as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: 'CREGIS_EXECUTION_DISABLED' });

    await expect(
      CregisPayoutRailAdapter.submit(instruction(), {
        cregis: { ...credentials, apiKey: '' },
        fetchImpl: jest.fn() as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: 'CREGIS_NOT_CONFIGURED' });

    await expect(
      CregisPayoutRailAdapter.submit(instruction(), {
        cregis: { ...credentials, gatewayBaseUrl: '' },
        fetchImpl: jest.fn() as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: 'CREGIS_NOT_CONFIGURED' });

    const previousProduction = process.env.CREGIS_PRODUCTION_PAYOUTS_ENABLED;
    process.env.CREGIS_PRODUCTION_PAYOUTS_ENABLED = 'false';
    try {
      await expect(
        CregisPayoutRailAdapter.submit(instruction(), {
          cregis: { ...credentials, environment: 'production', executionEnabled: true },
          fetchImpl: jest.fn() as unknown as typeof fetch,
        })
      ).rejects.toMatchObject({ code: 'CREGIS_PRODUCTION_BLOCKED' });
    } finally {
      process.env.CREGIS_PRODUCTION_PAYOUTS_ENABLED = previousProduction;
    }

    await expect(
      CregisPayoutRailAdapter.submit(instruction(), {
        cregis: credentials,
        fetchImpl: (async () =>
          jsonResponse({ code: 'E0006', msg: 'amount' })) as unknown as typeof fetch,
      })
    ).rejects.toBeInstanceOf(PayoutReleaseError);
  });
});

describe('Cregis status synchronization', () => {
  it('maps documented query statuses and leaves unknown statuses unchanged', async () => {
    const query = async (status: unknown) =>
      CregisPayoutRailAdapter.syncStatus(instruction({ providerReference: 'cregis:55' }), {
        cregis: credentials,
        fetchImpl: (async () =>
          jsonResponse({
            code: '00000',
            data: { cid: 55, status },
          })) as unknown as typeof fetch,
      });

    await expect(query(0)).resolves.toMatchObject({ status: 'PROCESSING' });
    await expect(query(6)).resolves.toMatchObject({ status: 'PAID' });
    await expect(query(7)).resolves.toMatchObject({
      status: 'FAILED',
      failedReason: 'Transaction failed',
    });
    await expect(query(99)).resolves.toMatchObject({
      status: 'SUBMITTED',
      failedReason: 'Unknown Cregis status 99',
    });
  });

  it('queries by cid and stays PROCESSING when cid is missing', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ code: '00000', data: { status: 1 } })
    );
    const withCid = await CregisPayoutRailAdapter.syncStatus(
      instruction({ providerReference: 'cregis:77' }),
      { cregis: credentials, fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(withCid.status).toBe('PROCESSING');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://gateway.example.test${CREGIS_PAYOUT_QUERY_PATH}`);
    expect(JSON.parse(String(init.body))).toMatchObject({ cid: 77, pid: credentials.pid });

    const withoutCid = await CregisPayoutRailAdapter.syncStatus(instruction(), {
      cregis: credentials,
      fetchImpl: jest.fn() as unknown as typeof fetch,
    });
    expect(withoutCid.status).toBe('PROCESSING');
  });
});
