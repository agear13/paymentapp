import {
  emitOperationalTelemetry,
  resetOperationalTelemetryForTests,
} from '@/lib/operations/telemetry/operational-telemetry';
import {
  getOperationalDiagnosticsCounterSnapshot,
  resetOperationalDiagnosticsCountersForTests,
} from '@/lib/operations/dev/operational-diagnostics-counters';

describe('telemetry → diagnostics dependency boundary', () => {
  beforeEach(() => {
    resetOperationalTelemetryForTests();
    resetOperationalDiagnosticsCountersForTests();
  });

  it('updates diagnostics counters via telemetry subscriber (not direct import)', () => {
    emitOperationalTelemetry({
      type: 'convergence_timeout',
      mutation: 'test',
      thresholdMs: 5000,
      recoveryAttempted: true,
    });

    expect(getOperationalDiagnosticsCounterSnapshot().timeoutRecoveryCount).toBe(1);
  });

  it('updates duplicate event counter from ordering anomaly subscriber path', () => {
    emitOperationalTelemetry({
      type: 'operational_event_ordering_anomaly',
      anomaly: 'duplicate_suppressed',
      mutation: 'test',
    });

    expect(getOperationalDiagnosticsCounterSnapshot().duplicateEventCount).toBe(1);
  });
});
