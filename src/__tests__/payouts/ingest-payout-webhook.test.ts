import { ingestPayoutWebhook } from '@/lib/payouts/ingest-payout-webhook.server';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';

const mockWebhookRows: Array<Record<string, unknown>> = [];
const mockExecutePayoutRelease = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    webhook_events: {
      findFirst: jest.fn(async ({ where }: { where: { provider: string; provider_event_id: string } }) =>
        mockWebhookRows.find(
          (row) => row.provider === where.provider && row.provider_event_id === where.provider_event_id
        ) ?? null
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 'wh-1', ...data, payout_id: null };
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

describe('ingestPayoutWebhook', () => {
  beforeEach(() => {
    mockWebhookRows.length = 0;
    mockExecutePayoutRelease.mockReset();
  });

  it('records then ignores rails that do not accept inbound webhooks', async () => {
    const result = await ingestPayoutWebhook({
      railId: 'manual',
      rawBody: '{"id":"evt_1"}',
      headers: { 'user-agent': 'test' },
    });
    expect(result.ignored).toBe(true);
    expect(result.reason).toBe('rail_does_not_accept_webhooks');
    expect(mockExecutePayoutRelease).not.toHaveBeenCalled();
    expect(mockWebhookRows[0]?.status).toBe('IGNORED');
  });

  it('does not apply status for unknown rails', async () => {
    await expect(
      ingestPayoutWebhook({
        railId: 'not-a-rail',
        rawBody: '{}',
        headers: {},
      })
    ).rejects.toBeInstanceOf(PayoutReleaseError);
    expect(mockExecutePayoutRelease).not.toHaveBeenCalled();
  });

  it('rejects unimplemented future rails without executing payouts', async () => {
    await expect(
      ingestPayoutWebhook({
        railId: 'stripe_treasury',
        rawBody: '{"id":"treasury-1"}',
        headers: {},
      })
    ).rejects.toThrow(/not implemented/);
    expect(mockExecutePayoutRelease).not.toHaveBeenCalled();
  });
});
