'use client';

import type {
  OperationalSyncHandlers,
  OperationalSyncTraceContext,
} from '@/lib/operations/sync/operational-sync-types';

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

export type ConvergenceRecoveryTelemetryEvent =
  | {
      type: 'convergence_recovery';
      mutation: string;
      projectId: string | null;
      path: 'force_snapshot_reload' | 'full_retry';
      retryCount: number;
    }
  | {
      type: 'snapshot_reload_retry';
      mutation: string;
      projectId: string | null;
      attempt: number;
      ok: boolean;
    };

export type ConvergenceRecoveryInput = {
  handlers: OperationalSyncHandlers;
  trace: OperationalSyncTraceContext;
  attempt?: number;
  fetchAuthoritativeSnapshot?: (projectId: string | null) => Promise<boolean>;
  emitTelemetry?: (event: ConvergenceRecoveryTelemetryEvent) => void;
};

/** Force authoritative reload after timeout — callbacks injected by orchestration layer. */
export async function recoverFromConvergenceTimeout(
  input: ConvergenceRecoveryInput
): Promise<void> {
  const attempt = input.attempt ?? 1;
  const projectId = input.trace.projectId ?? null;
  const emit = input.emitTelemetry;

  emit?.({
    type: 'convergence_recovery',
    mutation: input.trace.mutation,
    projectId,
    path: attempt === 1 ? 'force_snapshot_reload' : 'full_retry',
    retryCount: attempt,
  });

  for (const scope of ['all'] as const) {
    input.handlers.invalidate(scope);
  }

  let snapshotOk = false;
  if (input.fetchAuthoritativeSnapshot) {
    try {
      snapshotOk = await input.fetchAuthoritativeSnapshot(projectId);
      emit?.({
        type: 'snapshot_reload_retry',
        mutation: input.trace.mutation,
        projectId,
        attempt,
        ok: snapshotOk,
      });
    } catch {
      emit?.({
        type: 'snapshot_reload_retry',
        mutation: input.trace.mutation,
        projectId,
        attempt,
        ok: false,
      });
    }
  }

  await Promise.allSettled([
    input.handlers.refreshWorkspace('all'),
    input.handlers.reloadCoordinationSnapshot?.() ?? Promise.resolve(),
  ]);
  input.handlers.notifyActivation?.();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('operational-coordination-reload'));
  }

  if (!snapshotOk && attempt < 2 && input.fetchAuthoritativeSnapshot) {
    await recoverFromConvergenceTimeout({ ...input, attempt: attempt + 1 });
  }
}
