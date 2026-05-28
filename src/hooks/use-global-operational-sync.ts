'use client';

import * as React from 'react';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import {
  applyOperationalSyncRefresh,
  parseOperationalSync,
  toOperationalSyncHandlers,
} from '@/lib/operations/orchestration/operational-sync-client';
import type { OperationalSyncTraceContext } from '@/lib/operations/orchestration/operational-sync-convergence';

/** Sync handlers for surfaces outside project workspace context (payouts hub, settlements, etc.). */
export function useGlobalOperationalSyncHandlers() {
  return React.useMemo(
    () =>
      toOperationalSyncHandlers({
        invalidate: () => notifyWorkspaceActivationRefresh(),
        refreshSilent: async () => {
          notifyWorkspaceActivationRefresh();
        },
        reloadCoordinationSnapshot: async () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('operational-coordination-reload'));
          }
        },
        notifyActivation: notifyWorkspaceActivationRefresh,
        onAudit: appendOperationalAuditEntry,
      }),
    []
  );
}

export async function applyGlobalOperationalSync(
  handlers: ReturnType<typeof useGlobalOperationalSyncHandlers>,
  json: unknown,
  trace?: OperationalSyncTraceContext,
  verify?: () => void | Promise<void>
): Promise<void> {
  await applyOperationalSyncRefresh(handlers, parseOperationalSync(json), trace, verify);
}
