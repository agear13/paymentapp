'use client';

import * as React from 'react';
import { useOperationalAuditStore } from '@/hooks/use-operational-audit-store';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { safeEventProjection } from '@/lib/operations/timeline/safe-event-projection';
import type { OperationalTimelineProjection } from '@/lib/operations/timeline/types';

export type UseOperationalTimelineProjectionOptions = {
  projectId?: string;
  enabled?: boolean;
};

/**
 * Client hook — derives replay-safe operational timeline projection from audit + workspace state.
 */
export function useOperationalTimelineProjection(
  options?: UseOperationalTimelineProjectionOptions
): OperationalTimelineProjection {
  const enabled = options?.enabled !== false;
  const auditTimeline = useOperationalAuditStore({
    projectId: options?.projectId,
  });
  const { workspaceContext, graphSnapshotConverged } = useOperationalCoordinationState({
    enabled,
  });

  return React.useMemo(
    () =>
      safeEventProjection({
        auditTimeline: enabled ? auditTimeline : [],
        workspace: workspaceContext,
        graphSnapshotConverged,
      }),
    [auditTimeline, enabled, graphSnapshotConverged, workspaceContext]
  );
}
