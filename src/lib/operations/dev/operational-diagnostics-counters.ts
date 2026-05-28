import type { OperationalTelemetryEvent } from '@/lib/operations/telemetry/operational-telemetry';

let timeoutRecoveryCount = 0;
let staleRenderCount = 0;
let crossSurfaceMismatchCount = 0;
let duplicateEventCount = 0;
let replayAnomalyCount = 0;
let obligationsRecomputeCount = 0;
let manualRecoveryCount = 0;

export function ingestOperationalTelemetryEvent(event: OperationalTelemetryEvent): void {
  switch (event.type) {
    case 'convergence_timeout':
    case 'convergence_recovery':
      timeoutRecoveryCount += 1;
      break;
    case 'stale_render_detected':
      staleRenderCount += 1;
      break;
    case 'cross_surface_mismatch':
    case 'post_convergence_assertion_failure':
      crossSurfaceMismatchCount += 1;
      break;
    case 'operational_event_ordering_anomaly':
      if (event.anomaly === 'duplicate_suppressed') duplicateEventCount += 1;
      else replayAnomalyCount += 1;
      break;
    case 'obligations_recompute':
      obligationsRecomputeCount += 1;
      break;
    case 'manual_recovery_action':
      manualRecoveryCount += 1;
      break;
    default:
      break;
  }
}

export function getOperationalDiagnosticsCounterSnapshot() {
  return {
    timeoutRecoveryCount,
    staleRenderCount,
    crossSurfaceMismatchCount,
    duplicateEventCount,
    replayAnomalyCount,
    obligationsRecomputeCount,
    manualRecoveryCount,
  };
}

export function resetOperationalDiagnosticsCountersForTests(): void {
  timeoutRecoveryCount = 0;
  staleRenderCount = 0;
  crossSurfaceMismatchCount = 0;
  duplicateEventCount = 0;
  replayAnomalyCount = 0;
  obligationsRecomputeCount = 0;
  manualRecoveryCount = 0;
}
