'use client';

import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalSyncScope } from '@/lib/operations/orchestration/synchronize-operational-state';
import {
  applyOperationalSyncConvergence,
  type OperationalSyncConvergenceOptions,
  type OperationalSyncHandlers,
  type OperationalSyncTraceContext,
} from '@/lib/operations/orchestration/operational-sync-convergence';
import { subscribeOperationalWindowEvents } from '@/lib/operations/orchestration/operational-event-bus';
import type { WorkspaceRefreshScope } from '@/lib/projects/workspace-refresh-controller';
import { createPostConvergenceVerifier } from '@/lib/operations/orchestration/fetch-post-convergence-verification';

export { createPostConvergenceVerifier };

export type OperationalSyncResponse = {
  operationalSync?: {
    invalidatedScopes?: OperationalSyncScope[];
    releaseEligibleCount?: number;
    payoutReadyCount?: number;
    obligationCount?: number;
    releaseEligibleObligationCount?: number;
    operationalEvent?: OperationalEvent;
    completionEvent?: OperationalEvent;
    auditEntry?: OperationalAuditEntry | null;
    syncCompletedAt?: string;
  };
};

/** Map legacy refreshSilent handlers into convergence handlers. */
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

/** Apply canonical invalidation + awaited refresh after any operational mutation response. */
export async function applyOperationalSyncRefresh(
  handlers: OperationalSyncHandlers,
  sync?: OperationalSyncResponse['operationalSync'],
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

/** Fire-and-forget variant for legacy call sites. Prefer awaited applyOperationalSyncRefresh. */
export function applyOperationalSyncRefreshFireAndForget(
  handlers: OperationalSyncHandlers,
  sync?: OperationalSyncResponse['operationalSync']
): void {
  void applyOperationalSyncRefresh(handlers, sync);
}

export function parseOperationalSync(json: unknown): OperationalSyncResponse['operationalSync'] {
  if (!json || typeof json !== 'object') return undefined;
  const raw = (json as OperationalSyncResponse).operationalSync;
  if (!raw || typeof raw !== 'object') return undefined;
  return raw;
}

/** Subscribe project workspace to operational events — event-driven, not page-driven. */
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
    void applyOperationalSyncRefresh(
      convergenceHandlers,
      { invalidatedScopes: ['all'], operationalEvent: event },
      { mutation: 'other', projectId: event.projectId ?? projectId }
    );
  });
}
