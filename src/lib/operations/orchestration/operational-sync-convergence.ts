'use client';



import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';

import type { WorkspaceRefreshScope } from '@/lib/projects/workspace-refresh-controller';

import {

  dispatchOperationalEvent,

} from '@/lib/operations/orchestration/operational-event-bus';

import type { OperationalSyncResponse } from '@/lib/operations/orchestration/operational-sync-client';

import { workspaceScopesFromOperationalSync } from '@/lib/operations/orchestration/synchronize-operational-state';

import type { OperationalSyncScope } from '@/lib/operations/orchestration/synchronize-operational-state';

import {

  getConvergenceTimeoutMs,

  recoverFromConvergenceTimeout,

  withConvergenceTimeout,

} from '@/lib/operations/orchestration/operational-convergence-resilience';

import { emitOperationalTelemetry } from '@/lib/operations/telemetry/operational-telemetry';



export type OperationalSyncMutationKind =

  | 'participant_earnings_save'

  | 'agreement_approval'

  | 'payout_verification'

  | 'funding_update'

  | 'obligation_generation'

  | 'snapshot_persist'

  | 'other';



/** Canonical mutation → convergence phase ordering (tests + telemetry). */

export const OPERATIONAL_CONVERGENCE_PHASE_ORDER = [

  'server-commit-complete',

  'invalidate-caches',

  'refresh-trigger',

  'coordination-snapshot-response',

  'activation-sync',

  'selector-recompute',

  'ui-render-convergence',

  'mutation-success',

] as const;



export type OperationalConvergencePhase = (typeof OPERATIONAL_CONVERGENCE_PHASE_ORDER)[number];



export type OperationalSyncHandlers = {

  invalidate: (scope?: WorkspaceRefreshScope | 'all') => void;

  /** Force-refresh workspace slices after persistence (bypasses silent debounce). */

  refreshWorkspace: (scope?: WorkspaceRefreshScope | 'all') => Promise<void>;

  /** Reload coordination-snapshot into guidance graph state. */

  reloadCoordinationSnapshot?: () => Promise<void>;

  notifyActivation?: () => void;

  onAudit?: (entry: OperationalAuditEntry) => void;

};



export type OperationalSyncTraceContext = {

  mutation: OperationalSyncMutationKind;

  projectId?: string | null;

  participantId?: string | null;

  surface?: string;

};



export type OperationalSyncConvergenceOptions = {

  verify?: () => void | Promise<void>;

  /** Test hook — records phase order for ordering invariant assertions. */

  onPhase?: (phase: OperationalConvergencePhase) => void;

};



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



/** Dev-only post-persistence synchronization timeline. */

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



async function runOperationalSyncConvergence(

  handlers: OperationalSyncHandlers,

  sync: OperationalSyncResponse['operationalSync'] | undefined,

  trace: OperationalSyncTraceContext,

  options?: OperationalSyncConvergenceOptions

): Promise<void> {

  const scopes: OperationalSyncScope[] = sync?.invalidatedScopes ?? ['all'];

  const workspaceScopes = workspaceScopesFromOperationalSync(scopes);

  const refreshSequence = ++lastRefreshSequence;

  const convergenceStarted = performance.now();

  let timedOut = false;

  let recovered = false;



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
      await recoverFromConvergenceTimeout(handlers, trace);
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

    await recoverFromConvergenceTimeout(handlers, trace);

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

    logOperationalSyncConvergence('selector-recompute', trace, {

      verified: true,

    });

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



/**

 * Await workspace + coordination refresh after a successful mutation.

 * DB commit is complete when the mutation API returns; this ensures client caches

 * and coordination-snapshot reload before UI derives canonical state.

 */

export async function applyOperationalSyncConvergence(

  handlers: OperationalSyncHandlers,

  sync: OperationalSyncResponse['operationalSync'] | undefined,

  trace: OperationalSyncTraceContext,

  verifyOrOptions?: (() => void | Promise<void>) | OperationalSyncConvergenceOptions

): Promise<void> {

  const options: OperationalSyncConvergenceOptions | undefined =

    typeof verifyOrOptions === 'function'

      ? { verify: verifyOrOptions }

      : verifyOrOptions;



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


