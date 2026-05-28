'use client';

import { dispatchOperationalEvent } from '@/lib/operations/sync/operational-sync-events';
import type {
  OperationalConvergencePhase,
  OperationalSyncConvergenceOptions,
  OperationalSyncHandlers,
  OperationalSyncPayload,
  OperationalSyncTraceContext,
} from '@/lib/operations/sync/operational-sync-types';
import {
  OPERATIONAL_CONVERGENCE_PHASE_ORDER,
} from '@/lib/operations/sync/operational-sync-types';
import { workspaceScopesFromOperationalSync } from '@/lib/operations/orchestration/synchronize-operational-state';
import type { OperationalSyncScope } from '@/lib/operations/orchestration/synchronize-operational-state';
import {
  recoverFromConvergenceTimeout,
  withConvergenceTimeout,
  type ConvergenceRecoveryTelemetryEvent,
} from '@/lib/operations/orchestration/operational-convergence-resilience';
import { fetchCoordinationSnapshotAfterConvergence } from '@/lib/operations/sync/fetch-coordination-snapshot-data';
import { recordOperationalSyncLog } from '@/lib/operations/dev/operational-diagnostics-snapshot';
import { emitOperationalTelemetry } from '@/lib/operations/telemetry/operational-telemetry';

export type {
  OperationalConvergencePhase,
  OperationalSyncConvergenceOptions,
  OperationalSyncHandlers,
  OperationalSyncMutationKind,
  OperationalSyncPayload,
  OperationalSyncResponse,
  OperationalSyncTraceContext,
} from '@/lib/operations/sync/operational-sync-types';

export { OPERATIONAL_CONVERGENCE_PHASE_ORDER };

let convergenceChain: Promise<void> = Promise.resolve();
let convergenceInFlight = 0;
let lastRefreshSequence = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function recordPhase(
  phase: OperationalConvergencePhase,
  options: OperationalSyncConvergenceOptions | undefined
): void {
  options?.onPhase?.(phase);
}

export function logOperationalSyncConvergence(
  phase:
    | 'mutation-start'
    | 'mutation-success'
    | 'server-commit-complete'
    | 'refresh-trigger'
    | 'coordination-snapshot-response'
    | 'selector-recompute'
    | 'ui-render-convergence',
  context: OperationalSyncTraceContext,
  detail?: Record<string, unknown>
): void {
  recordOperationalSyncLog({
    phase,
    mutation: context.mutation,
    projectId: context.projectId ?? null,
    detail,
  });

  if (process.env.NODE_ENV === 'production') return;
  console.groupCollapsed(`[operational-sync] ${phase}`);
  console.log('at', nowIso());
  console.log('mutation', context.mutation);
  console.log('projectId', context.projectId ?? null);
  console.log('participantId', context.participantId ?? null);
  console.log('surface', context.surface ?? null);
  if (detail) console.log('detail', detail);
  console.groupEnd();
}

export function resetOperationalConvergenceQueueForTests(): void {
  convergenceChain = Promise.resolve();
  convergenceInFlight = 0;
  lastRefreshSequence = 0;
}

export function getOperationalConvergenceInFlightCount(): number {
  return convergenceInFlight;
}

function buildRecoveryDeps(
  handlers: OperationalSyncHandlers,
  trace: OperationalSyncTraceContext
) {
  return {
    handlers,
    trace,
    fetchAuthoritativeSnapshot: async (projectId: string | null) => {
      const fetched = await fetchCoordinationSnapshotAfterConvergence(projectId);
      return Boolean(fetched?.snapshot?.summary?.participantCount);
    },
    emitTelemetry: (event: ConvergenceRecoveryTelemetryEvent) => {
      emitOperationalTelemetry(event);
    },
  };
}

async function runOperationalSyncConvergence(
  handlers: OperationalSyncHandlers,
  sync: OperationalSyncPayload | undefined,
  trace: OperationalSyncTraceContext,
  options?: OperationalSyncConvergenceOptions
): Promise<void> {
  const scopes: OperationalSyncScope[] = sync?.invalidatedScopes ?? ['all'];
  const workspaceScopes = workspaceScopesFromOperationalSync(scopes);
  const refreshSequence = ++lastRefreshSequence;
  const convergenceStarted = performance.now();
  let timedOut = false;
  let recovered = false;
  const recoveryDeps = buildRecoveryDeps(handlers, trace);

  recordPhase('server-commit-complete', options);
  logOperationalSyncConvergence('server-commit-complete', trace, {
    invalidatedScopes: scopes,
    syncCompletedAt: sync?.syncCompletedAt ?? null,
    payoutReadyCount: sync?.payoutReadyCount,
    obligationCount: sync?.obligationCount,
  });

  recordPhase('invalidate-caches', options);
  for (const scope of workspaceScopes) {
    handlers.invalidate(scope);
  }

  recordPhase('refresh-trigger', options);
  logOperationalSyncConvergence('refresh-trigger', trace, { workspaceScopes, refreshSequence });

  const refreshStarted = performance.now();
  const refreshWork = async () => {
    const results = await Promise.allSettled([
      handlers.refreshWorkspace('all'),
      handlers.reloadCoordinationSnapshot?.() ?? Promise.resolve(),
    ]);
    const rejected = results.filter((r) => r.status === 'rejected');
    if (rejected.length > 0) {
      emitOperationalTelemetry({
        type: 'operational_event_ordering_anomaly',
        anomaly: 'out_of_order_refresh',
        mutation: trace.mutation,
        projectId: trace.projectId ?? null,
        detail: {
          partialFailureCount: rejected.length,
          reasons: rejected.map((r) =>
            r.status === 'rejected' ? String(r.reason) : 'ok'
          ),
        },
      });
      await recoverFromConvergenceTimeout(recoveryDeps);
    }
  };

  const timeoutResult = await withConvergenceTimeout(refreshWork);
  if (timeoutResult.timedOut) {
    timedOut = true;
    emitOperationalTelemetry({
      type: 'convergence_timeout',
      mutation: trace.mutation,
      projectId: trace.projectId ?? null,
      surface: trace.surface ?? null,
      thresholdMs: timeoutResult.thresholdMs,
      recoveryAttempted: true,
    });
    logOperationalSyncConvergence('coordination-snapshot-response', trace, {
      refreshElapsedMs: Math.round(performance.now() - refreshStarted),
      timedOut: true,
      refreshSequence,
    });
    await recoverFromConvergenceTimeout(recoveryDeps);
    recovered = true;
  } else {
    recordPhase('coordination-snapshot-response', options);
    logOperationalSyncConvergence('coordination-snapshot-response', trace, {
      refreshElapsedMs: Math.round(performance.now() - refreshStarted),
      refreshSequence,
    });
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

  recordPhase('activation-sync', options);
  handlers.notifyActivation?.();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('operational-coordination-reload'));
  }

  if (options?.verify) {
    await options.verify();
    recordPhase('selector-recompute', options);
    logOperationalSyncConvergence('selector-recompute', trace, { verified: true });
  }

  recordPhase('ui-render-convergence', options);
  logOperationalSyncConvergence('ui-render-convergence', trace, {
    totalElapsedMs: Math.round(performance.now() - convergenceStarted),
    timedOut,
    recovered,
    refreshSequence,
  });

  recordPhase('mutation-success', options);
  logOperationalSyncConvergence('mutation-success', trace, {
    totalElapsedMs: Math.round(performance.now() - convergenceStarted),
  });

  emitOperationalTelemetry({
    type: 'convergence_duration',
    mutation: trace.mutation,
    projectId: trace.projectId ?? null,
    surface: trace.surface ?? null,
    durationMs: Math.round(performance.now() - convergenceStarted),
    timedOut,
    recovered,
  });
}

export async function applyOperationalSyncConvergence(
  handlers: OperationalSyncHandlers,
  sync: OperationalSyncPayload | undefined,
  trace: OperationalSyncTraceContext,
  verifyOrOptions?: (() => void | Promise<void>) | OperationalSyncConvergenceOptions
): Promise<void> {
  const options: OperationalSyncConvergenceOptions | undefined =
    typeof verifyOrOptions === 'function' ? { verify: verifyOrOptions } : verifyOrOptions;

  if (convergenceInFlight > 0) {
    emitOperationalTelemetry({
      type: 'operational_event_ordering_anomaly',
      anomaly: 'convergence_overlap',
      mutation: trace.mutation,
      projectId: trace.projectId ?? null,
      detail: { inFlight: convergenceInFlight },
    });
  }

  const run = async () => {
    convergenceInFlight += 1;
    try {
      await runOperationalSyncConvergence(handlers, sync, trace, options);
    } finally {
      convergenceInFlight -= 1;
    }
  };

  const next = convergenceChain.then(run, run);
  convergenceChain = next.catch(() => undefined);
  return next;
}
