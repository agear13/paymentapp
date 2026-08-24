const mockFindMany = jest.fn();
const mockUpdate = jest.fn();

const mockPrisma = {
  deal_network_pilot_participants: {
    findMany: (...args: unknown[]) => mockFindMany(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
};

import {
  classifyScalarCompensationBackfillCandidate,
  runScalarCompensationProfileBackfill,
} from '@/lib/participants/repair-scalar-compensation-backfill';
import {
  needsScalarRevenueShareProfileRepair,
  repairScalarCompensationProfile,
} from '@/lib/participants/repair-scalar-compensation-profile';

const revenueShareLegacy = {
  id: 'p-a',
  dealId: 'deal-a',
  inviteToken: 'tok-a',
  name: 'RS',
  participationModel: 'revenue_share' as const,
  commissionKind: 'pct_deal_value' as const,
  commissionValue: 10,
};

const pctWithoutModel = {
  id: 'p-b',
  dealId: 'deal-b',
  inviteToken: 'tok-b',
  name: 'Edge',
  participationModel: 'fixed_payout' as const,
  commissionKind: 'pct_deal_value' as const,
  commissionValue: 8,
};

describe('scalar compensation backfill command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('uses the unchanged predicate to group revenue_share vs pct_deal_value-only', () => {
    expect(needsScalarRevenueShareProfileRepair(revenueShareLegacy as never)).toBe(true);
    expect(needsScalarRevenueShareProfileRepair(pctWithoutModel as never)).toBe(true);
    expect(classifyScalarCompensationBackfillCandidate(revenueShareLegacy as never)).toBe(
      'revenue_share'
    );
    expect(classifyScalarCompensationBackfillCandidate(pctWithoutModel as never)).toBe(
      'pct_deal_value_without_revenue_share'
    );
  });

  it('dry-run reports candidates and writes nothing', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p-a',
        deal_id: 'deal-a',
        invite_token: 'tok-a',
        participant_payload: revenueShareLegacy,
      },
      {
        id: 'p-b',
        deal_id: 'deal-b',
        invite_token: 'tok-b',
        participant_payload: pctWithoutModel,
      },
    ]);

    const result = await runScalarCompensationProfileBackfill({
      prisma: mockPrisma as never,
    });

    expect(result.totalCandidates).toBe(2);
    expect(result.wouldChange).toBe(2);
    expect(result.changed).toBe(0);
    expect(result.revenueShareCount).toBe(1);
    expect(result.pctDealValueWithoutRevenueShareCount).toBe(1);
    expect(result.candidates).toEqual([
      { participantId: 'p-a', dealId: 'deal-a', group: 'revenue_share' },
      {
        participantId: 'p-b',
        dealId: 'deal-b',
        group: 'pct_deal_value_without_revenue_share',
      },
    ]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('execute writes only using the existing repair function', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p-a',
        deal_id: 'deal-a',
        invite_token: 'tok-a',
        participant_payload: revenueShareLegacy,
      },
    ]);

    const expected = repairScalarCompensationProfile({
      ...revenueShareLegacy,
      id: 'p-a',
      dealId: 'deal-a',
      inviteToken: 'tok-a',
    } as never);

    const result = await runScalarCompensationProfileBackfill({
      prisma: mockPrisma as never,
      execute: true,
    });

    expect(result.changed).toBe(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'p-a' },
      data: {
        participant_payload: expect.objectContaining({
          compensationProfile: expect.objectContaining({
            compensationType: expected.participant.compensationProfile?.compensationType,
            percentage: 10,
            configured: true,
          }),
        }),
      },
    });
  });
});
