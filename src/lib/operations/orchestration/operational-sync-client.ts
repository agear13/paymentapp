'use client';

import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalSyncScope } from '@/lib/operations/orchestration/synchronize-operational-state';
import { workspaceScopesFromOperationalSync } from '@/lib/operations/orchestration/synchronize-operational-state';
import {
  dispatchOperationalEvent,
  subscribeOperationalWindowEvents,
} from '@/lib/operations/orchestration/operational-event-bus';
import type { WorkspaceRefreshScope } from '@/lib/projects/workspace-refresh-controller';

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

/** Apply canonical invalidation + event dispatch after any operational mutation response. */
export function applyOperationalSyncRefresh(handlers: {
  invalidate: (scope?: WorkspaceRefreshScope) => void;
  refreshSilent: (scope?: WorkspaceRefreshScope) => Promise<void>;
  notifyActivation?: () => void;
  onAudit?: (entry: OperationalAuditEntry) => void;
}, sync?: OperationalSyncResponse['operationalSync']): void {
  const scopes = sync?.invalidatedScopes ?? (['all'] as OperationalSyncScope[]);
  const workspaceScopes = workspaceScopesFromOperationalSync(scopes);
  for (const scope of workspaceScopes) {
    handlers.invalidate(scope);
  }

  if (sync?.operationalEvent) {
    dispatchOperationalEvent({ ...sync.operationalEvent, source: 'client' });
  }
  if (sync?.completionEvent) {
    dispatchOperationalEvent({ ...sync.completionEvent, source: 'client' });
  }
  if (sync?.auditEntry) {
    handlers.onAudit?.(sync.auditEntry);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('operational-sync', { detail: { auditEntry: sync.auditEntry } })
      );
    }
  }

  void handlers.refreshSilent('all');
  handlers.notifyActivation?.();
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
    invalidate: (scope?: WorkspaceRefreshScope) => void;
    refreshSilent: (scope?: WorkspaceRefreshScope) => Promise<void>;
    notifyActivation?: () => void;
    onAudit?: (entry: OperationalAuditEntry) => void;
  }
): () => void {
  return subscribeOperationalWindowEvents((event) => {
    if (event.projectId && event.projectId !== projectId) return;
    applyOperationalSyncRefresh(handlers, {
      invalidatedScopes: ['all'],
      operationalEvent: event,
    });
  });
}
