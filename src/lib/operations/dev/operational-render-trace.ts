import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import { emitOperationalTelemetry } from '@/lib/operations/telemetry/operational-telemetry';

let convergenceGeneration = 0;
let lastConvergenceAt: string | null = null;
let lastConvergenceMutation: string | null = null;
let lastConvergenceKpis: Partial<OperationalKPIs> | null = null;

export function markOperationalConvergenceComplete(meta: {
  mutation: string;
  kpis?: Partial<OperationalKPIs> | null;
}): void {
  convergenceGeneration += 1;
  lastConvergenceAt = new Date().toISOString();
  lastConvergenceMutation = meta.mutation;
  lastConvergenceKpis = meta.kpis ?? null;
}

export function getOperationalConvergenceGeneration(): number {
  return convergenceGeneration;
}

export type OperationalRenderTraceInput = {
  hook: 'useOperationalGuidance' | 'useCanonicalOperationalState' | 'useOperationalCoordinationState';
  phase: 'memo' | 'effect' | 'render';
  surface?: string;
  projectId?: string | null;
  graphSnapshotConverged?: boolean;
  degraded?: boolean;
  participantCount?: number;
  kpis?: Partial<OperationalKPIs> | null;
  memoDeps?: string;
};

/** Dev-only — detect renders that may retain pre-convergence canonical KPIs. */
export function traceOperationalRender(input: OperationalRenderTraceInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  const kpis = input.kpis;
  let staleAfterConvergence = false;
  if (
    lastConvergenceKpis &&
    kpis &&
    lastConvergenceAt &&
    (kpis.earningsConfiguredCount !== lastConvergenceKpis.earningsConfiguredCount ||
      kpis.payoutReadyCount !== lastConvergenceKpis.payoutReadyCount ||
      kpis.obligationCount !== lastConvergenceKpis.obligationCount)
  ) {
    staleAfterConvergence = true;
    emitOperationalTelemetry({
      type: 'stale_render_detected',
      hook: input.hook,
      surface: input.surface ?? null,
      projectId: input.projectId ?? null,
      convergenceGeneration,
    });
    if (process.env.NODE_ENV === 'development') {
      console.error(
        '[operational-render] STALE_CANONICAL_STATE_AFTER_CONVERGENCE',
        {
          hook: input.hook,
          surface: input.surface,
          convergenceGeneration,
          lastConvergenceMutation,
          lastConvergenceAt,
          lastConvergenceKpis,
          renderKpis: kpis,
          memoDeps: input.memoDeps,
        }
      );
    }
  }

  console.groupCollapsed(
    `[operational-render] ${input.hook}${staleAfterConvergence ? ' ⚠ stale' : ''}`
  );
  console.log('at', new Date().toISOString());
  console.log('phase', input.phase);
  console.log('surface', input.surface ?? null);
  console.log('convergenceGeneration', convergenceGeneration);
  console.log('graphSnapshotConverged', input.graphSnapshotConverged ?? null);
  console.log('degraded', input.degraded ?? null);
  console.log('kpis', kpis ?? null);
  if (input.memoDeps) console.log('memoDeps', input.memoDeps);
  console.groupEnd();
}
