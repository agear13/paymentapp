import { NextRequest } from 'next/server';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

jest.mock('@/lib/auth/middleware', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: jest.fn(),
  syncPilotSnapshotForUser: jest.fn(),
  participantRowToDemo: jest.fn((row: { id: string; deal_id: string; invite_token: string; participant_payload: unknown }) => ({
    ...(row.participant_payload as object),
    id: row.id,
    dealId: row.deal_id,
    inviteToken: row.invite_token,
  })),
}));

const mockCreate = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    deal_network_pilot_participants: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/operations/orchestration/operational-mutation-orchestrator.server', () => ({
  orchestrateOperationalMutation: jest.fn().mockResolvedValue({}),
  operationalSyncJson: () => ({}),
}));

import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { POST as createParticipant } from '@/app/api/deal-network-pilot/participants/route';
import { POST as importSnapshot } from '@/app/api/deal-network-pilot/snapshot/route';

const mockRequireAuth = requireAuth as jest.Mock;
const mockGetSnapshot = getPilotSnapshotForUser as jest.Mock;
const mockSync = syncPilotSnapshotForUser as jest.Mock;

function baseParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p-1',
    dealId: 'deal-1',
    inviteToken: 'tok-1',
    name: 'Alex',
    email: 'alex@example.com',
    role: 'Partner',
    commissionKind: 'pct_deal_value',
    commissionValue: 10,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    participationModel: 'revenue_share',
    ...overrides,
  };
}

function participantRequest(participant: DemoParticipant) {
  return new NextRequest('http://localhost/api/deal-network-pilot/participants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant }),
  });
}

function importRequest(participants: DemoParticipant[]) {
  return new NextRequest('http://localhost/api/deal-network-pilot/snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'workspace_import_replace',
      deals: [{ id: 'deal-1', dealName: 'Launch Event' }],
      participants,
    }),
  });
}

describe('POST /api/deal-network-pilot/participants compensation normalize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'user-1' });
    mockGetSnapshot.mockResolvedValue({
      deals: [{ id: 'deal-1', dealName: 'Launch Event' }],
      participants: [],
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: data.id,
      deal_id: data.deal_id,
      invite_token: data.invite_token,
      participant_payload: data.participant_payload,
      name: data.name,
      email: data.email,
      approval_status: data.approval_status,
      approved_at: data.approved_at,
    }));
  });

  it('persists a canonical profile for scalar revenue_share without a profile', async () => {
    const response = await createParticipant(
      participantRequest(baseParticipant({ compensationProfile: undefined }))
    );
    expect(response.status).toBe(200);
    const payload = mockCreate.mock.calls[0][0].data.participant_payload as DemoParticipant;
    expect(payload.compensationProfile?.compensationType).toBe('REVENUE_SHARE');
    expect(payload.compensationProfile?.percentage).toBe(10);
    expect(payload.compensationProfile?.configured).toBe(true);
    expect(payload.commissionValue).toBe(10);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('follows the existing pct_deal_value predicate when the model is not revenue_share', async () => {
    await createParticipant(
      participantRequest(
        baseParticipant({
          participationModel: 'fixed_payout',
          commissionKind: 'pct_deal_value',
          commissionValue: 8,
        })
      )
    );
    const payload = mockCreate.mock.calls[0][0].data.participant_payload as DemoParticipant;
    expect(payload.participationModel).toBe('revenue_share');
    expect(payload.compensationProfile?.percentage).toBe(8);
  });

  it('preserves a canonical supplied profile', async () => {
    const profile = {
      compensationType: 'REVENUE_SHARE' as const,
      percentage: 12,
      configured: true,
      configuredAt: '2026-01-01T00:00:00.000Z',
      revenueSources: ['ticket_sales'],
    };
    await createParticipant(
      participantRequest(baseParticipant({ compensationProfile: profile, commissionValue: 12 }))
    );
    const payload = mockCreate.mock.calls[0][0].data.participant_payload as DemoParticipant;
    expect(payload.compensationProfile).toEqual(profile);
  });

  it('does not misclassify referral-commerce attribution as revenue share', async () => {
    await createParticipant(
      participantRequest(
        baseParticipant({
          participationModel: 'customer_attribution',
          commissionKind: 'pct_deal_value',
          commissionValue: 10,
          referralCommerce: {
            createReferralLink: true,
            commissionMode: 'referral_commerce',
            commerceCommissionPct: 10,
          },
        })
      )
    );
    const payload = mockCreate.mock.calls[0][0].data.participant_payload as DemoParticipant;
    expect(payload.participationModel).toBe('customer_attribution');
    expect(payload.compensationProfile).toBeUndefined();
    expect(payload.referralCommerce?.commissionMode).toBe('referral_commerce');
  });

  it('leaves a zero-value onboarding participant unchanged', async () => {
    await createParticipant(
      participantRequest(
        baseParticipant({
          commissionValue: 0,
          compensationProfile: undefined,
        })
      )
    );
    const payload = mockCreate.mock.calls[0][0].data.participant_payload as DemoParticipant;
    expect(payload.commissionValue).toBe(0);
    expect(payload.compensationProfile).toBeUndefined();
  });

  it('does not touch unrelated existing participants', async () => {
    await createParticipant(participantRequest(baseParticipant()));
    expect(mockGetSnapshot).toHaveBeenCalledWith('user-1');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].data.id).toBe('p-1');
  });
});

describe('POST /api/deal-network-pilot/snapshot workspace_import_replace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'user-1' });
    mockSync.mockResolvedValue(undefined);
  });

  it('normalizes imported legacy candidates before persistence', async () => {
    const response = await importSnapshot(
      importRequest([
        baseParticipant({ id: 'p-legacy', inviteToken: 'tok-legacy' }),
        baseParticipant({
          id: 'p-canonical',
          inviteToken: 'tok-can',
          commissionValue: 15,
          compensationProfile: {
            compensationType: 'REVENUE_SHARE',
            percentage: 15,
            configured: true,
            configuredAt: '2026-01-01T00:00:00.000Z',
            revenueSources: [],
          },
        }),
      ])
    );
    expect(response.status).toBe(200);
    expect(mockGetSnapshot).not.toHaveBeenCalled();
    const persisted = mockSync.mock.calls[0][2] as DemoParticipant[];
    const legacy = persisted.find((p) => p.id === 'p-legacy');
    const canonical = persisted.find((p) => p.id === 'p-canonical');
    expect(legacy?.compensationProfile?.compensationType).toBe('REVENUE_SHARE');
    expect(legacy?.compensationProfile?.percentage).toBe(10);
    expect(canonical?.compensationProfile?.percentage).toBe(15);
    expect(canonical?.compensationProfile?.configuredAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not load or repair unrelated existing workspace participants', async () => {
    await importSnapshot(importRequest([baseParticipant()]));
    expect(mockGetSnapshot).not.toHaveBeenCalled();
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect((mockSync.mock.calls[0][2] as DemoParticipant[]).map((p) => p.id)).toEqual(['p-1']);
  });

  it('is idempotent for an already canonical import', async () => {
    const canonical = baseParticipant({
      compensationProfile: {
        compensationType: 'REVENUE_SHARE',
        percentage: 10,
        configured: true,
        configuredAt: '2026-01-01T00:00:00.000Z',
        revenueSources: [],
      },
    });
    await importSnapshot(importRequest([canonical]));
    await importSnapshot(importRequest([canonical]));
    const first = (mockSync.mock.calls[0][2] as DemoParticipant[])[0];
    const second = (mockSync.mock.calls[1][2] as DemoParticipant[])[0];
    expect(second?.compensationProfile).toEqual(first?.compensationProfile);
    expect(second?.compensationProfile).toEqual(canonical.compensationProfile);
  });
});
