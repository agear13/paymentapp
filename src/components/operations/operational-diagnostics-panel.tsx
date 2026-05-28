'use client';

import * as React from 'react';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getOperationalDiagnosticsBundle,
  isOperationalDiagnosticsEnabled,
} from '@/lib/operations/dev/operational-diagnostics-snapshot';
import {
  OPERATIONAL_RECOVERY_ACTION_LABELS,
  buildRecoveryHandlers,
  runOperationalRecoveryAction,
  type OperationalRecoveryAction,
} from '@/lib/operations/dev/operational-recovery-actions';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { WorkspaceRefreshScope } from '@/lib/projects/workspace-refresh-controller';

type OperationalDiagnosticsPanelProps = {
  projectId: string;
  participants?: DemoParticipant[];
  invalidate: (scope?: WorkspaceRefreshScope) => void;
  refreshSilent: (scope?: WorkspaceRefreshScope) => Promise<void>;
  reloadCoordinationSnapshot?: () => Promise<void>;
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="whitespace-pre-wrap break-all text-[10px] bg-muted/40 p-2 rounded max-h-36 overflow-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** Read-only operational diagnostics + explicit admin recovery actions (dev / flag only). */
export function OperationalDiagnosticsPanel({
  projectId,
  participants,
  invalidate,
  refreshSilent,
  reloadCoordinationSnapshot,
}: OperationalDiagnosticsPanelProps) {
  if (!isOperationalDiagnosticsEnabled()) return null;

  const coordination = useOperationalCoordinationState({
    scope: 'project',
    participants,
    enabled: true,
    traceSurface: 'operational-diagnostics-panel',
  });

  const [open, setOpen] = React.useState(false);
  const [bundle, setBundle] = React.useState(() => getOperationalDiagnosticsBundle());
  const [pendingAction, setPendingAction] = React.useState<OperationalRecoveryAction | null>(null);
  const [lastRebuild, setLastRebuild] = React.useState<Record<string, number> | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refreshBundle = React.useCallback(() => {
    setBundle(getOperationalDiagnosticsBundle());
  }, []);

  React.useEffect(() => {
    if (!open) return;
    refreshBundle();
    const onTelemetry = () => refreshBundle();
    window.addEventListener('operational-telemetry', onTelemetry);
    const interval = window.setInterval(refreshBundle, 2000);
    return () => {
      window.removeEventListener('operational-telemetry', onTelemetry);
      window.clearInterval(interval);
    };
  }, [open, refreshBundle]);

  const recoveryHandlers = React.useMemo(
    () =>
      buildRecoveryHandlers({
        invalidate,
        refreshSilent,
        reloadCoordinationSnapshot,
      }),
    [invalidate, refreshSilent, reloadCoordinationSnapshot]
  );

  const runRecovery = async (action: OperationalRecoveryAction, confirmed: boolean) => {
    setBusy(true);
    try {
      await runOperationalRecoveryAction(action, {
        projectId,
        handlers: recoveryHandlers,
        participants,
        onKpiRebuild: (m) => setLastRebuild(m),
      }, { confirmed });
      refreshBundle();
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  };

  const kpis = coordination.kpis;
  const fundingConnected =
    coordination.canonicalState?.funding.allocated ??
    coordination.graph?.funding?.allocated ??
    false;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-16 z-50 rounded-full bg-slate-700 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-slate-800"
      >
        Ops Diagnostics
      </button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-[440px] max-h-[80vh] overflow-auto shadow-2xl border-slate-500/40">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">Operational Diagnostics</CardTitle>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={refreshBundle}>
            Refresh
          </Button>
          <button type="button" className="text-xs text-muted-foreground" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <section>
          <p className="font-semibold mb-1">A. Canonical operational state</p>
          <JsonBlock
            value={{
              projectId,
              releasePhase: coordination.releasePhase,
              graphReady: (coordination.graph?.summary?.participantCount ?? 0) > 0,
              graphConverged: coordination.graphSnapshotConverged,
              participantCount: kpis?.participantCount,
              earningsConfiguredCount: kpis?.earningsConfiguredCount,
              payoutReadyCount: kpis?.payoutReadyCount,
              obligationCount: kpis?.obligationCount,
              fundingConnected,
              releaseBlockers: coordination.releaseBlockers?.length ?? 0,
              attributionActiveCount: kpis?.attributionActiveCount,
              degraded: coordination.degraded,
            }}
          />
        </section>

        <section>
          <p className="font-semibold mb-1">B. Convergence state</p>
          <JsonBlock value={bundle.convergence} />
        </section>

        <section>
          <p className="font-semibold mb-1">C. Event / replay state</p>
          <JsonBlock
            value={{
              replayFingerprint: coordination.replayFingerprint,
              eventCount: coordination.canonicalState?.events.length ?? 0,
              lastReplayAt: bundle.convergence.lastConvergenceAt,
              duplicateEventSuppressions: bundle.convergence.duplicateEventCount,
              replayAnomalies: bundle.convergence.replayAnomalyCount,
            }}
          />
        </section>

        <section>
          <p className="font-semibold mb-1">D. Runtime traces</p>
          <p className="text-muted-foreground mb-1">Latest sync logs</p>
          <JsonBlock value={bundle.syncLogs.slice(-5)} />
          <p className="text-muted-foreground mt-2 mb-1">Render traces</p>
          <JsonBlock value={bundle.render.recentRenders.slice(-5)} />
          <p className="text-muted-foreground mt-2 mb-1">Telemetry (recent)</p>
          <JsonBlock value={bundle.telemetry.recent.slice(-8)} />
        </section>

        {lastRebuild ? (
          <section>
            <p className="font-semibold mb-1">Persisted KPI rebuild (last)</p>
            <JsonBlock value={lastRebuild} />
          </section>
        ) : null}

        <section>
          <p className="font-semibold mb-1">Recovery actions</p>
          <p className="text-muted-foreground mb-2">Requires explicit confirmation — emits structured telemetry.</p>
          <div className="flex flex-col gap-1">
            {(Object.keys(OPERATIONAL_RECOVERY_ACTION_LABELS) as OperationalRecoveryAction[]).map(
              (action) => (
                <Button
                  key={action}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 justify-start text-[11px]"
                  disabled={busy}
                  onClick={() => setPendingAction(action)}
                >
                  {OPERATIONAL_RECOVERY_ACTION_LABELS[action]}
                </Button>
              )
            )}
          </div>
          {pendingAction ? (
            <div className="mt-2 p-2 border rounded bg-amber-500/10 space-y-2">
              <p className="font-medium">Confirm: {OPERATIONAL_RECOVERY_ACTION_LABELS[pendingAction]}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void runRecovery(pendingAction, true)}
                >
                  Confirm
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setPendingAction(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}
