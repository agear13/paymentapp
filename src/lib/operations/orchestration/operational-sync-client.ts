'use client';

import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalSyncScope } from '@/lib/operations/orchestration/synchronize-operational-state';
import { applyOperationalSyncConvergence } from '@/lib/operations/orchestration/operational-sync-convergence';
import type {
  OperationalSyncConvergenceOptions,
  OperationalSyncHandlers,
  OperationalSyncPayload,
  OperationalSyncResponse,
  OperationalSyncTraceContext,
} from '@/lib/operations/sync/operational-sync-types';
import { subscribeOperationalWindowEvents } from '@/lib/operations/sync/operational-sync-events';
import { parseOperationalSync } from '@/lib/operations/sync/operational-sync-helpers';
import type { WorkspaceRefreshScope } from '@/lib/projects/workspace-refresh-controller';

export type {
  OperationalSyncConvergenceOptions,
  OperationalSyncHandlers,
  OperationalSyncMutationKind,
  OperationalSyncPayload,
  OperationalSyncResponse,
  OperationalSyncTraceContext,
} from '@/lib/operations/sync/operational-sync-types';
export { parseOperationalSync };

export function toOperationalSyncHandlers(handlers: {
  invalidate: (scope?: WorkspaceRefreshScope | 'all') => void;
  refreshSilent: (scope?: WorkspaceRefreshScope | 'all') => Promise<void>;
  reloadCoordinationSnapshot?: () => Promise<void>;
  notifyActivation?: () => void;
  onAudit?: (entry: OperationalAuditEntry) => void;
}): OperationalSyncHandlers {
  return {
    invalidate: handlers.invalidate,
    refreshWorkspace: (scope) => handlers.refreshSilent(scope ?? 'all'),
    reloadCoordinationSnapshot: handlers.reloadCoordinationSnapshot,
    notifyActivation: handlers.notifyActivation,
    onAudit: handlers.onAudit,
  };
}

export async function applyOperationalSyncRefresh(
  handlers: OperationalSyncHandlers,
  sync?: OperationalSyncPayload,
  trace?: OperationalSyncTraceContext,
  verifyOrOptions?: (() => void | Promise<void>) | OperationalSyncConvergenceOptions
): Promise<void> {
  await applyOperationalSyncConvergence(
    handlers,
    sync,
    trace ?? { mutation: 'other', projectId: sync?.operationalEvent?.projectId ?? null },
    verifyOrOptions
  );
}

export function applyOperationalSyncRefreshFireAndForget(
  handlers: OperationalSyncHandlers,
  sync?: OperationalSyncPayload
): void {
  void applyOperationalSyncRefresh(handlers, sync);
}

export function subscribeProjectOperationalEvents(
  projectId: string,
  handlers: {
    invalidate: (scope?: WorkspaceRefreshScope | 'all') => void;
    refreshSilent: (scope?: WorkspaceRefreshScope | 'all') => Promise<void>;
    reloadCoordinationSnapshot?: () => Promise<void>;
    notifyActivation?: () => void;
    onAudit?: (entry: OperationalAuditEntry) => void;
  }
): () => void {
  const convergenceHandlers = toOperationalSyncHandlers(handlers);
  return subscribeOperationalWindowEvents((event) => {
    if (event.projectId && event.projectId !== projectId) return;
    if (event.notificationOnly) {
      const auditFromPayload = event.payload?.auditEntry as OperationalAuditEntry | undefined;
      if (auditFromPayload) {
        handlers.onAudit?.(auditFromPayload);
      }
      return;
    }
    void applyOperationalSyncRefresh(
      convergenceHandlers,
      { invalidatedScopes: ['funding'], operationalEvent: event },
      { mutation: 'other', projectId: event.projectId ?? projectId }
    );
  });
}
