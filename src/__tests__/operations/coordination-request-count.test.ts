import {
  beginCoordinationRequestCount,
  flushCoordinationRequestCount,
  recordCoordinationActivationRequest,
  recordCoordinationSnapshotRequest,
  resetCoordinationRequestCountForTests,
} from '@/lib/operations/dev/coordination-request-count';
import { isWorkspaceCoordinationRoute } from '@/lib/operations/routing/is-workspace-coordination-route';
import { requiresLocalOperationalInstance } from '@/contexts/operational-coordination-context';

describe('coordination request deduplication helpers', () => {
  beforeEach(() => {
    resetCoordinationRequestCountForTests();
  });

  it('tracks activation and snapshot counts per page load', () => {
    beginCoordinationRequestCount('payout-obligations');
    recordCoordinationActivationRequest();
    recordCoordinationSnapshotRequest();

    const snapshot = flushCoordinationRequestCount();
    expect(snapshot).toEqual({
      page: 'payout-obligations',
      activation: 1,
      coordinationSnapshot: 1,
    });
  });

  it('gates workspace provider routes', () => {
    expect(isWorkspaceCoordinationRoute('/dashboard/payouts/obligations')).toBe(true);
    expect(isWorkspaceCoordinationRoute('/dashboard')).toBe(false);
    expect(isWorkspaceCoordinationRoute('/dashboard/projects/abc-123')).toBe(false);
  });

  it('requires local instance for project-scoped overrides', () => {
    expect(requiresLocalOperationalInstance({ traceSurface: 'x' })).toBe(false);
    expect(
      requiresLocalOperationalInstance({
        project: { id: 'p1', name: 'Deal', partner: 'X', status: 'Approved' },
      })
    ).toBe(true);
    expect(
      requiresLocalOperationalInstance({
        participants: [{ id: 'p1', name: 'A', role: 'Partner' }],
      })
    ).toBe(true);
  });
});
