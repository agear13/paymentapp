'use client';

import {
  applyOperationalSyncRefresh,
  toOperationalSyncHandlers,
  type OperationalSyncHandlers,
} from '@/lib/operations/orchestration/operational-sync-client';
import { emitOperationalTelemetry } from '@/lib/operations/telemetry/operational-telemetry';
import { countPersistedParticipantMetrics } from '@/lib/operations/dev/count-persisted-participant-metrics';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { WorkspaceRefreshScope } from '@/lib/projects/workspace-refresh-controller';

export type OperationalRecoveryAction =
  | 'force_snapshot_reload'
  | 'force_convergence_replay'
  | 'recompute_obligations'
  | 'clear_stale_cache'
  | 'rerun_coordination_refresh'
  | 'rebuild_kpis_from_persisted';

export const OPERATIONAL_RECOVERY_ACTION_LABELS: Record<OperationalRecoveryAction, string> = {
  force_snapshot_reload: 'Force authoritative snapshot reload',
  force_convergence_replay: 'Force operational convergence replay',
  recompute_obligations: 'Recompute obligations',
  clear_stale_cache: 'Clear stale operational cache',
  rerun_coordination_refresh: 'Re-run coordination refresh',
  rebuild_kpis_from_persisted: 'Rebuild KPIs from persisted entities',
};

export type OperationalRecoveryContext = {
  projectId: string;
  handlers: OperationalSyncHandlers;
  participants?: DemoParticipant[];
  onKpiRebuild?: (metrics: ReturnType<typeof countPersistedParticipantMetrics>) => void;
};

function emitRecoveryTelemetry(
  action: OperationalRecoveryAction,
  projectId: string,
  confirmed: boolean
): void {
  emitOperationalTelemetry({
    type: 'manual_recovery_action',
    action,
    projectId,
    confirmed,
  });
}

export async function runOperationalRecoveryAction(
  action: OperationalRecoveryAction,
  ctx: OperationalRecoveryContext,
  options?: { confirmed?: boolean }
): Promise<{ ok: boolean; detail?: Record<string, unknown> }> {
  const confirmed = options?.confirmed ?? false;
  if (!confirmed) {
    return { ok: false, detail: { reason: 'not_confirmed' } };
  }

  emitRecoveryTelemetry(action, ctx.projectId, true);

  switch (action) {
    case 'force_snapshot_reload': {
      await ctx.handlers.reloadCoordinationSnapshot?.();
      await applyOperationalSyncRefresh(
        ctx.handlers,
        { invalidatedScopes: ['all'] },
        { mutation: 'other', projectId: ctx.projectId, surface: 'operational-recovery' }
      );
      return { ok: true };
    }
    case 'force_convergence_replay': {
      await applyOperationalSyncRefresh(
        ctx.handlers,
        { invalidatedScopes: ['all'] },
        { mutation: 'other', projectId: ctx.projectId, surface: 'operational-recovery' }
      );
      return { ok: true };
    }
    case 'recompute_obligations': {
      const res = await fetch('/api/deal-network-pilot/obligations/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: ctx.projectId }),
      });
      const ok = res.ok;
      emitOperationalTelemetry({
        type: 'obligations_recompute',
        projectId: ctx.projectId,
        trigger: 'manual_recovery',
      });
      if (ok) {
        await applyOperationalSyncRefresh(
          ctx.handlers,
          { invalidatedScopes: ['all'] },
          { mutation: 'other', projectId: ctx.projectId, surface: 'operational-recovery' }
        );
      }
      return { ok, detail: { status: res.status } };
    }
    case 'clear_stale_cache': {
      const scopes: WorkspaceRefreshScope[] = ['participants', 'summary', 'all'];
      for (const scope of scopes) {
        ctx.handlers.invalidate(scope);
      }
      await ctx.handlers.refreshWorkspace('all');
      return { ok: true };
    }
    case 'rerun_coordination_refresh': {
      await ctx.handlers.reloadCoordinationSnapshot?.();
      return { ok: true };
    }
    case 'rebuild_kpis_from_persisted': {
      const metrics = countPersistedParticipantMetrics(ctx.participants ?? []);
      ctx.onKpiRebuild?.(metrics);
      return { ok: true, detail: metrics as unknown as Record<string, unknown> };
    }
    default:
      return { ok: false, detail: { reason: 'unknown_action' } };
  }
}

export function buildRecoveryHandlers(handlers: {
  invalidate: (scope?: WorkspaceRefreshScope | 'all') => void;
  refreshSilent: (scope?: WorkspaceRefreshScope | 'all') => Promise<void>;
  reloadCoordinationSnapshot?: () => Promise<void>;
  notifyActivation?: () => void;
}): OperationalSyncHandlers {
  return toOperationalSyncHandlers(handlers);
}
