jest.mock('server-only', () => ({}));

const mockDealFindMany = jest.fn();
const mockParticipantFindMany = jest.fn();
const mockParticipantUpdate = jest.fn();
const mockParticipantUpsert = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    deal_network_pilot_deals: {
      findMany: (...args: unknown[]) => mockDealFindMany(...args),
    },
    deal_network_pilot_participants: {
      findMany: (...args: unknown[]) => mockParticipantFindMany(...args),
      update: (...args: unknown[]) => mockParticipantUpdate(...args),
      upsert: (...args: unknown[]) => mockParticipantUpsert(...args),
    },
  },
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { needsScalarRevenueShareProfileRepair } from '@/lib/participants/repair-scalar-compensation-profile';

const USER = 'user-1';

const legacyPayload = {
  name: 'Legacy Partner',
  participationModel: 'revenue_share',
  commissionKind: 'pct_deal_value',
  commissionValue: 10,
  role: 'Partner',
  status: 'Pending',
  approvalStatus: 'Pending approval',
};

const configuredPayload = {
  name: 'Configured Partner',
  participationModel: 'revenue_share',
  commissionKind: 'pct_deal_value',
  commissionValue: 15,
  compensationProfile: {
    compensationType: 'REVENUE_SHARE',
    percentage: 15,
    configured: true,
    configuredAt: '2026-01-01T00:00:00.000Z',
    revenueSources: [],
  },
  role: 'Partner',
  status: 'Pending',
  approvalStatus: 'Pending approval',
};

function dealRow(id: string) {
  return {
    id,
    deal_payload: { id, dealName: 'Launch Event' },
  };
}

function participantRow(
  id: string,
  dealId: string,
  payload: Record<string, unknown>
) {
  return {
    id,
    deal_id: dealId,
    invite_token: `${id}-token`,
    participant_payload: payload,
    name: payload.name,
    email: null,
    approval_status: 'Pending approval',
    approved_at: null,
  };
}

describe('getPilotSnapshotForUser read-only hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDealFindMany.mockResolvedValue([dealRow('deal-1'), dealRow('deal-2')]);
    mockParticipantFindMany.mockResolvedValue([
      participantRow('p-legacy', 'deal-1', legacyPayload),
      participantRow('p-ok', 'deal-2', configuredPayload),
    ]);
  });

  it('returns a repair candidate in the repaired shape without writing', async () => {
    const snapshot = await getPilotSnapshotForUser(USER);
    const legacy = snapshot.participants.find((p) => p.id === 'p-legacy');

    expect(legacy?.compensationProfile?.compensationType).toBe('REVENUE_SHARE');
    expect(legacy?.compensationProfile?.percentage).toBe(10);
    expect(legacy?.compensationProfile?.configured).toBe(true);
    expect(legacy?.participationModel).toBe('revenue_share');
    expect(legacy?.commissionKind).toBe('pct_deal_value');
    expect(mockParticipantUpdate).not.toHaveBeenCalled();
    expect(mockParticipantUpsert).not.toHaveBeenCalled();
  });

  it('does not update unrelated participant rows', async () => {
    await getPilotSnapshotForUser(USER);

    expect(mockParticipantUpdate).not.toHaveBeenCalled();
    expect(mockParticipantFindMany).toHaveBeenCalledWith({
      where: { deal_id: { in: ['deal-1', 'deal-2'] } },
    });
  });

  it('is write-free and idempotent across repeated reads', async () => {
    const first = await getPilotSnapshotForUser(USER);
    const second = await getPilotSnapshotForUser(USER);

    expect(first.participants[0]?.compensationProfile?.percentage).toBe(
      second.participants[0]?.compensationProfile?.percentage
    );
    expect(mockParticipantUpdate).not.toHaveBeenCalled();
    expect(mockDealFindMany).toHaveBeenCalledTimes(2);
  });

  it('leaves stored scalar-only rows as repair candidates for an explicit backfill', () => {
    expect(
      needsScalarRevenueShareProfileRepair({
        ...legacyPayload,
        id: 'p-legacy',
        dealId: 'deal-1',
        inviteToken: 'p-legacy-token',
      } as never)
    ).toBe(true);
  });
});

describe('getPilotSnapshotForUser surface', () => {
  it('does not persist participant_payload during snapshot load', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/deal-network-demo/pilot-snapshot.server.ts'),
      'utf8'
    );
    const getter = source.slice(
      source.indexOf('export async function getPilotSnapshotForUser'),
      source.indexOf('export type SyncPilotSnapshotSourceStamp')
    );
    expect(getter).toContain('repairScalarCompensationProfile');
    expect(getter).not.toContain('.update(');
  });
});

describe('high-frequency read surfaces stay compatible at the helper', () => {
  it('keeps snapshot participants usable without a persisted profile write', async () => {
    mockDealFindMany.mockResolvedValue([dealRow('deal-1')]);
    mockParticipantFindMany.mockResolvedValue([
      participantRow('p-legacy', 'deal-1', legacyPayload),
    ]);

    const snapshot = await getPilotSnapshotForUser(USER);
    const participant = snapshot.participants[0];

    expect(participant?.compensationProfile?.configured).toBe(true);
    expect(snapshot.deals[0]?.id).toBe('deal-1');
    expect(mockParticipantUpdate).not.toHaveBeenCalled();
  });
});
