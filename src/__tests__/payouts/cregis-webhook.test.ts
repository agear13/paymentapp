import { signCregisPayload } from '@/lib/payouts/rails/cregis-signature';
import {
  cregisWebhookEventId,
  normalizeCregisWebhook,
  verifyCregisWebhookBody,
} from '@/lib/payouts/rails/cregis.adapter';
import { ingestPayoutWebhook } from '@/lib/payouts/ingest-payout-webhook.server';

const API_KEY = 'test-cregis-api-key';
const PID = 1382528827416576;

const mockWebhookRows: Array<Record<string, unknown>> = [];
const mockExecutePayoutRelease = jest.fn();
const mockGetCregisConnectionByPid = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    webhook_events: {
      findFirst: jest.fn(async ({ where }: { where: { provider: string; provider_event_id: string } }) =>
        mockWebhookRows.find(
          (row) => row.provider === where.provider && row.provider_event_id === where.provider_event_id
        ) ?? null
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `wh-${mockWebhookRows.length + 1}`, ...data, payout_id: null };
        mockWebhookRows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = mockWebhookRows.find((item) => item.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
    },
  },
}));

jest.mock('@/lib/payouts/execute-payout-release.server', () => ({
  executePayoutRelease: (...args: unknown[]) => mockExecutePayoutRelease(...args),
}));

jest.mock('@/lib/payouts/rails/cregis-connection.server', () => ({
  getCregisConnectionByPid: (...args: unknown[]) => mockGetCregisConnectionByPid(...args),
}));

function unsignedCallback(overrides: Record<string, unknown> = {}) {
  return {
    pid: PID,
    cid: 1391751691788288,
    address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
    chain_id: '195',
    token_id: '195',
    currency: 'TRX',
    amount: '1.1',
    third_party_id: 'payout:org-1:payout-1',
    remark: 'payout',
    status: 6,
    txid: '6dd05b0972075542219a3fcc116c58feaf9480f1f698cc46c4367ded83955cfd',
    nonce: 'ubqso3',
    timestamp: 1687850657960,
    ...overrides,
  };
}

function signedBody(overrides: Record<string, unknown> = {}) {
  const payload = unsignedCallback(overrides);
  return JSON.stringify({
    ...payload,
    sign: signCregisPayload(payload, API_KEY),
  });
}

describe('Cregis webhook normalization', () => {
  it('maps documented callback statuses to canonical events', () => {
    expect(normalizeCregisWebhook(unsignedCallback({ status: 6 }))).toMatchObject({
      railId: 'cregis',
      status: 'PAID',
      idempotencyKey: 'payout:org-1:payout-1',
      providerReference: 'cregis:1391751691788288',
    });
    expect(normalizeCregisWebhook(unsignedCallback({ status: 7 }))?.status).toBe('FAILED');
    expect(normalizeCregisWebhook(unsignedCallback({ status: 2 }))?.status).toBe('FAILED');
    expect(normalizeCregisWebhook(unsignedCallback({ status: 0 }))?.status).toBe('PROCESSING');
    expect(normalizeCregisWebhook(unsignedCallback({ status: 99 }))).toBeNull();
    expect(cregisWebhookEventId(unsignedCallback({ status: 6 }))).toBe(
      'cregis:1391751691788288:6'
    );
  });

  it('never includes the signature in retained provider payload', () => {
    const event = normalizeCregisWebhook({
      ...unsignedCallback({ status: 6 }),
      sign: 'secret-sign',
      apiKey: 'should-not-store',
    });
    expect(event?.providerPayload).not.toHaveProperty('sign');
    expect(event?.providerPayload).not.toHaveProperty('apiKey');
  });
});

describe('Cregis webhook verification', () => {
  it('accepts a valid body sign and rejects a bad one', async () => {
    const lookup = async () => ({
      apiKey: API_KEY,
      pid: PID,
      gatewayBaseUrl: 'https://gateway.example.test',
      executionEnabled: true,
    });
    await expect(verifyCregisWebhookBody(signedBody(), lookup)).resolves.toBe(true);
    const tampered = JSON.parse(signedBody()) as Record<string, unknown>;
    tampered.amount = '9.9';
    await expect(verifyCregisWebhookBody(JSON.stringify(tampered), lookup)).resolves.toBe(false);
    await expect(verifyCregisWebhookBody('{"pid":1}', lookup)).resolves.toBe(false);
  });
});

describe('Cregis webhook ingest', () => {
  beforeEach(() => {
    mockWebhookRows.length = 0;
    mockExecutePayoutRelease.mockReset();
    mockExecutePayoutRelease.mockResolvedValue({
      payoutIds: ['payout-1'],
      statuses: ['PAID'],
    });
    mockGetCregisConnectionByPid.mockReset();
    mockGetCregisConnectionByPid.mockResolvedValue({
      apiKey: API_KEY,
      pid: PID,
      gatewayBaseUrl: 'https://gateway.example.test',
      executionEnabled: true,
    });
  });

  it('verifies, normalizes, and applies a PAID callback through the orchestrator', async () => {
    const result = await ingestPayoutWebhook({
      railId: 'cregis',
      rawBody: signedBody({ status: 6 }),
      headers: {},
    });
    expect(result.ignored).toBe(false);
    expect(result.acknowledgement).toEqual({
      body: 'success',
      contentType: 'text/plain; charset=utf-8',
    });
    expect(mockExecutePayoutRelease).toHaveBeenCalledWith({
      type: 'apply_events',
      events: [
        expect.objectContaining({
          status: 'PAID',
          idempotencyKey: 'payout:org-1:payout-1',
          providerReference: 'cregis:1391751691788288',
        }),
      ],
    });
  });

  it('is a no-op when the identical webhook is replayed', async () => {
    const rawBody = signedBody({ status: 0 });
    mockExecutePayoutRelease.mockResolvedValue({
      payoutIds: ['payout-1'],
      statuses: ['PROCESSING'],
    });
    const first = await ingestPayoutWebhook({ railId: 'cregis', rawBody, headers: {} });
    const second = await ingestPayoutWebhook({ railId: 'cregis', rawBody, headers: {} });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.acknowledgement?.body).toBe('success');
    expect(mockExecutePayoutRelease).toHaveBeenCalledTimes(1);
  });

  it('leaves canonical state unchanged for unknown provider statuses', async () => {
    const result = await ingestPayoutWebhook({
      railId: 'cregis',
      rawBody: signedBody({ status: 99 }),
      headers: {},
    });
    expect(result.ignored).toBe(true);
    expect(result.reason).toBe('no_canonical_event');
    expect(result.acknowledgement?.body).toBe('success');
    expect(mockExecutePayoutRelease).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature without applying payout state or ACKing success', async () => {
    await expect(
      ingestPayoutWebhook({
        railId: 'cregis',
        rawBody: JSON.stringify({ ...unsignedCallback({ status: 6 }), sign: 'nope' }),
        headers: {},
      })
    ).rejects.toThrow(/signature/);
    expect(mockExecutePayoutRelease).not.toHaveBeenCalled();
  });
});
