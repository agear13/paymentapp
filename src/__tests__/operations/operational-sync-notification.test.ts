/**
 * @jest-environment jsdom
 */

import { dispatchOperationalEvent } from '@/lib/operations/sync/operational-sync-events';
import { subscribeProjectOperationalEvents } from '@/lib/operations/orchestration/operational-sync-client';
import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';

describe('operational sync notification-only events (1H)', () => {
  it('delivers audit without workspace refresh for notification-only events', () => {
    const refreshSilent = jest.fn().mockResolvedValue(undefined);
    const onAudit = jest.fn();

    const unsubscribe = subscribeProjectOperationalEvents('proj-1', {
      invalidate: jest.fn(),
      refreshSilent,
      onAudit,
    });

    const notificationEvent: OperationalEvent = {
      type: 'FUNDING_SOURCE_UPDATED',
      projectId: 'proj-1',
      timestamp: '2026-05-20T10:00:00.000Z',
      source: 'client',
      notificationOnly: true,
      payload: { auditEntry: { id: 'audit-1', type: 'funding_linked', title: 'x', description: 'y', timestamp: '2026-05-20T10:00:00.000Z' } },
    };

    dispatchOperationalEvent(notificationEvent);

    expect(onAudit).toHaveBeenCalled();
    expect(refreshSilent).not.toHaveBeenCalled();

    unsubscribe();
  });
});
