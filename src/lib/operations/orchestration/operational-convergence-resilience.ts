'use client';

import { fetchCoordinationSnapshotAfterConvergence } from '@/lib/operations/orchestration/fetch-post-convergence-verification';
import type { OperationalSyncHandlers } from '@/lib/operations/orchestration/operational-sync-convergence';
import type { OperationalSyncTraceContext } from '@/lib/operations/orchestration/operational-sync-convergence';
import { emitOperationalTelemetry } from '@/lib/operations/telemetry/operational-telemetry';

export class OperationalConvergenceTimeoutError extends Error {
  readonly thresholdMs: number;
  constructor(thresholdMs: number) {
    super(`Operational convergence exceeded ${thresholdMs}ms`);
    this.name = 'OperationalConvergenceTimeoutError';
    this.thresholdMs = thresholdMs;
  }
}

export const DEFAULT_CONVERGENCE_TIMEOUT_MS = 12_000;

export function getConvergenceTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_OPERATIONAL_CONVERGENCE_TIMEOUT_MS;
  if (!raw) return DEFAULT_CONVERGENCE_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONVERGENCE_TIMEOUT_MS;
}

export async function withConvergenceTimeout<T>(
  work: () => Promise<T>,
  options?: { timeoutMs?: number; label?: string }
): Promise<{ result: T; timedOut: false } | { timedOut: true; thresholdMs: number }> {
  const thresholdMs = options?.timeoutMs ?? getConvergenceTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new OperationalConvergenceTimeoutError(thresholdMs)),
          thresholdMs
        );
      }),
    ]);
    return { result, timedOut: false };
  } catch (error) {
    if (error instanceof OperationalConvergenceTimeoutError) {
      return { timedOut: true, thresholdMs };
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Force authoritative reload after timeout — prevents silent half-converged state. */
export async function recoverFromConvergenceTimeout(
  handlers: OperationalSyncHandlers,
  trace: OperationalSyncTraceContext,
  attempt = 1
): Promise<void> {
  const projectId = trace.projectId ?? null;
  emitOperationalTelemetry({
    type: 'convergence_recovery',
    mutation: trace.mutation,
    projectId,
    path: attempt === 1 ? 'force_snapshot_reload' : 'full_retry',
    retryCount: attempt,
  });

  for (const scope of ['all'] as const) {
    handlers.invalidate(scope);
  }

  let snapshotOk = false;
  try {
    const fetched = await fetchCoordinationSnapshotAfterConvergence(projectId);
    snapshotOk = Boolean(fetched?.snapshot?.summary?.participantCount);
    emitOperationalTelemetry({
      type: 'snapshot_reload_retry',
      mutation: trace.mutation,
      projectId,
      attempt,
      ok: snapshotOk,
    });
  } catch {
    emitOperationalTelemetry({
      type: 'snapshot_reload_retry',
      mutation: trace.mutation,
      projectId,
      attempt,
      ok: false,
    });
  }

  await Promise.allSettled([
    handlers.refreshWorkspace('all'),
    handlers.reloadCoordinationSnapshot?.() ?? Promise.resolve(),
  ]);
  handlers.notifyActivation?.();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('operational-coordination-reload'));
  }

  if (!snapshotOk && attempt < 2) {
    await recoverFromConvergenceTimeout(handlers, trace, attempt + 1);
  }
}
