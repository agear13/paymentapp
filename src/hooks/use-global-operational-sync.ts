'use client';

import * as React from 'react';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import {
  applyOperationalSyncRefresh,
  parseOperationalSync,
} from '@/lib/operations/orchestration/operational-sync-client';

/** Sync handlers for surfaces outside project workspace context (payouts hub, settlements, etc.). */
export function useGlobalOperationalSyncHandlers() {
  return React.useMemo(
    () => ({
      invalidate: () => {},
      refreshSilent: async () => {},
      notifyActivation: notifyWorkspaceActivationRefresh,
      onAudit: appendOperationalAuditEntry,
    }),
    []
  );
}

export function applyGlobalOperationalSync(
  handlers: ReturnType<typeof useGlobalOperationalSyncHandlers>,
  json: unknown
): void {
  applyOperationalSyncRefresh(handlers, parseOperationalSync(json));
}
