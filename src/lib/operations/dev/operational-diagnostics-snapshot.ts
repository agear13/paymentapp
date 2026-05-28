import { getRecentOperationalTelemetry } from '@/lib/operations/telemetry/operational-telemetry';
import {
  getOperationalDiagnosticsCounterSnapshot,
  resetOperationalDiagnosticsCountersForTests,
} from '@/lib/operations/dev/operational-diagnostics-counters';
import {
  getOperationalConvergenceGeneration,
  getOperationalRenderDiagnostics,
} from '@/lib/operations/dev/operational-render-trace';

export type OperationalSyncLogEntry = {
  at: string;
  phase: string;
  mutation?: string;
  projectId?: string | null;
  detail?: Record<string, unknown>;
};

const syncLogRing: OperationalSyncLogEntry[] = [];
const MAX_SYNC_LOGS = 40;

let lastConvergenceDurationMs: number | null = null;
let lastConvergenceMutation: string | null = null;
let lastConvergenceAt: string | null = null;
let lastSnapshotRefreshAt: string | null = null;

export function isOperationalDiagnosticsEnabled(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  return process.env.NEXT_PUBLIC_OPERATIONAL_DIAGNOSTICS === 'true';
}

export function recordOperationalSyncLog(entry: Omit<OperationalSyncLogEntry, 'at'>): void {
  syncLogRing.push({ ...entry, at: new Date().toISOString() });
  if (syncLogRing.length > MAX_SYNC_LOGS) syncLogRing.shift();
  if (entry.phase === 'coordination-snapshot-response') {
    lastSnapshotRefreshAt = new Date().toISOString();
  }
  if (entry.phase === 'ui-render-convergence' && typeof entry.detail?.totalElapsedMs === 'number') {
    lastConvergenceDurationMs = entry.detail.totalElapsedMs as number;
    lastConvergenceAt = new Date().toISOString();
    lastConvergenceMutation = entry.mutation ?? null;
  }
}

export function getOperationalSyncLogs(): readonly OperationalSyncLogEntry[] {
  return syncLogRing;
}

export function getOperationalConvergenceDiagnostics() {
  const counters = getOperationalDiagnosticsCounterSnapshot();
  return {
    lastConvergenceAt,
    lastConvergenceMutation,
    lastConvergenceDurationMs,
    lastSnapshotRefreshAt,
    ...counters,
    convergenceGeneration: getOperationalConvergenceGeneration(),
  };
}

export function getOperationalTelemetryDiagnostics() {
  const events = getRecentOperationalTelemetry();
  return {
    recent: events,
    counts: {
      convergenceDuration: events.filter((e) => e.type === 'convergence_duration').length,
      convergenceTimeout: events.filter((e) => e.type === 'convergence_timeout').length,
      staleRender: events.filter((e) => e.type === 'stale_render_detected').length,
      crossSurfaceMismatch: events.filter(
        (e) => e.type === 'cross_surface_mismatch' || e.type === 'post_convergence_assertion_failure'
      ).length,
      duplicateEvents: events.filter(
        (e) => e.type === 'operational_event_ordering_anomaly' && e.anomaly === 'duplicate_suppressed'
      ).length,
      manualRecovery: events.filter((e) => e.type === 'manual_recovery_action').length,
      obligationsRecompute: events.filter((e) => e.type === 'obligations_recompute').length,
    },
  };
}

export function getOperationalDiagnosticsBundle() {
  return {
    convergence: getOperationalConvergenceDiagnostics(),
    render: getOperationalRenderDiagnostics(),
    telemetry: getOperationalTelemetryDiagnostics(),
    syncLogs: getOperationalSyncLogs(),
  };
}

export function resetOperationalDiagnosticsSnapshotForTests(): void {
  syncLogRing.length = 0;
  lastConvergenceDurationMs = null;
  lastConvergenceMutation = null;
  lastConvergenceAt = null;
  lastSnapshotRefreshAt = null;
  resetOperationalDiagnosticsCountersForTests();
}
