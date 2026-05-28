/**
 * Lightweight operational telemetry — production-safe structured signals.
 * No external SDK dependency; consumers may listen via `operational-telemetry` window events.
 */

export type OperationalTelemetryEvent =
  | {
      type: 'convergence_duration';
      mutation: string;
      projectId?: string | null;
      surface?: string | null;
      durationMs: number;
      timedOut: boolean;
      recovered: boolean;
    }
  | {
      type: 'convergence_timeout';
      mutation: string;
      projectId?: string | null;
      surface?: string | null;
      thresholdMs: number;
      recoveryAttempted: boolean;
    }
  | {
      type: 'convergence_recovery';
      mutation: string;
      projectId?: string | null;
      path: 'force_snapshot_reload' | 'activation_retry' | 'full_retry';
      retryCount: number;
    }
  | {
      type: 'snapshot_reload_retry';
      mutation: string;
      projectId?: string | null;
      attempt: number;
      ok: boolean;
    }
  | {
      type: 'stale_render_detected';
      hook: string;
      surface?: string | null;
      projectId?: string | null;
      convergenceGeneration: number;
    }
  | {
      type: 'cross_surface_mismatch';
      code: string;
      mutation: string;
      surface?: string | null;
      detail?: Record<string, unknown>;
    }
  | {
      type: 'post_convergence_assertion_failure';
      code: string;
      mutation: string;
      message: string;
    }
  | {
      type: 'operational_event_ordering_anomaly';
      anomaly:
        | 'duplicate_suppressed'
        | 'out_of_order_refresh'
        | 'convergence_overlap'
        | 'replay_anomaly';
      mutation?: string;
      projectId?: string | null;
      detail?: Record<string, unknown>;
    }
  | {
      type: 'obligations_recompute';
      projectId?: string | null;
      trigger: 'manual_recovery' | 'api_refresh' | 'mutation';
      participantCount?: number;
      obligationCount?: number;
    }
  | {
      type: 'manual_recovery_action';
      action:
        | 'force_snapshot_reload'
        | 'force_convergence_replay'
        | 'recompute_obligations'
        | 'clear_stale_cache'
        | 'rerun_coordination_refresh'
        | 'rebuild_kpis_from_persisted';
      projectId?: string | null;
      confirmed: boolean;
    }
  | {
      type: 'replay_anomaly';
      projectId?: string | null;
      fingerprint?: string | null;
      detail?: Record<string, unknown>;
    };

export type OperationalTelemetryListener = (event: OperationalTelemetryEvent) => void;

const telemetryBuffer: OperationalTelemetryEvent[] = [];
const MAX_BUFFER = 50;
const telemetrySubscribers = new Set<OperationalTelemetryListener>();

/** Register a passive observer — diagnostics and dev tooling subscribe here. */
export function subscribeOperationalTelemetry(listener: OperationalTelemetryListener): () => void {
  telemetrySubscribers.add(listener);
  return () => telemetrySubscribers.delete(listener);
}

function notifyOperationalTelemetrySubscribers(event: OperationalTelemetryEvent): void {
  for (const listener of telemetrySubscribers) {
    try {
      listener(event);
    } catch {
      /* observers must not break emit */
    }
  }
}

export function emitOperationalTelemetry(event: OperationalTelemetryEvent): void {
  telemetryBuffer.push(event);
  if (telemetryBuffer.length > MAX_BUFFER) telemetryBuffer.shift();

  notifyOperationalTelemetrySubscribers(event);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('operational-telemetry', { detail: event }));
  }

  const isErrorLike =
    event.type === 'convergence_timeout' ||
    event.type === 'stale_render_detected' ||
    event.type === 'cross_surface_mismatch' ||
    event.type === 'post_convergence_assertion_failure' ||
    event.type === 'operational_event_ordering_anomaly' ||
    event.type === 'replay_anomaly';

  if (process.env.NODE_ENV !== 'production' || isErrorLike) {
    const payload = { tag: 'operational-telemetry', ...event };
    if (isErrorLike) {
      console.warn('[operational-telemetry]', payload);
    } else if (process.env.NODE_ENV !== 'production') {
      console.debug('[operational-telemetry]', payload);
    }
  }
}

export function getRecentOperationalTelemetry(): readonly OperationalTelemetryEvent[] {
  return telemetryBuffer;
}

export function resetOperationalTelemetryForTests(): void {
  telemetryBuffer.length = 0;
}
