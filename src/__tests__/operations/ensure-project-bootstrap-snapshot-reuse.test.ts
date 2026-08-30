import { ensureProjectBootstrapComplete } from '@/lib/operations/onboarding/operational-onboarding-barriers.server';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {},
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: jest.fn(),
}));

const getPilotSnapshotForUserMock = getPilotSnapshotForUser as jest.MockedFunction<
  typeof getPilotSnapshotForUser
>;

describe('ensureProjectBootstrapComplete snapshot reuse', () => {
  beforeEach(() => {
    getPilotSnapshotForUserMock.mockReset();
  });

  it('reuses a provided snapshot instead of loading the pilot graph again', async () => {
    const snapshot = {
      deals: [{ id: 'deal-1', archived: false } as RecentDeal],
      participants: [],
    };

    const result = await ensureProjectBootstrapComplete('user-1', null, { snapshot });

    expect(result).toEqual({ ready: true, projectId: 'deal-1' });
    expect(getPilotSnapshotForUserMock).not.toHaveBeenCalled();
  });

  it('loads the snapshot when none is provided', async () => {
    getPilotSnapshotForUserMock.mockResolvedValue({
      deals: [{ id: 'deal-2', archived: false } as RecentDeal],
      participants: [],
    });

    const result = await ensureProjectBootstrapComplete('user-1');

    expect(result).toEqual({ ready: true, projectId: 'deal-2' });
    expect(getPilotSnapshotForUserMock).toHaveBeenCalledWith('user-1');
  });
});
