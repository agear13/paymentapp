import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import { OperationalInvariantViolation } from '@/lib/operations/dev/operational-invariants';

export type CoordinationTruthTraceInput = {
  surface: string;
  hook: 'useOperationalCoordinationState';
  projectId?: string | null;
  apiSummary?: Record<string, unknown> | null;
  canonicalKpis?: OperationalKPIs | null;
  renderedKpis?: Partial<OperationalKPIs> | null;
  degraded?: boolean;
  graphReady?: boolean;
  graphConverged?: boolean;
  initializationBlocked?: boolean;
};

export type CrossSurfaceKpiSnapshot = {
  surface: string;
  projectId: string | null;
  participantCount: number;
  earningsConfiguredCount: number;
  payoutReadyCount: number;
  obligationCount: number;
  releaseEligibleCount: number;
  fundingAllocated: boolean;
};

const surfaceRegistry = new Map<string, CrossSurfaceKpiSnapshot[]>();

/** Temporary dev tracing — single operational truth path debugging. */
export function logCoordinationTruth(input: CoordinationTruthTraceInput): void {
  if (process.env.NODE_ENV !== 'development') return;

  console.groupCollapsed('[coordination-truth]');
  console.log('surface', input.surface);
  console.log('hook', input.hook);
  console.log('projectId', input.projectId ?? null);
  console.log('API snapshot summary', input.apiSummary ?? null);
  console.log('canonical selector output', input.canonicalKpis ?? null);
  console.log('rendered surface KPIs', input.renderedKpis ?? null);
  console.log('flags', {
    degraded: input.degraded ?? false,
    graphReady: input.graphReady ?? null,
    graphConverged: input.graphConverged ?? null,
    initializationBlocked: input.initializationBlocked ?? null,
  });
  console.groupEnd();
}

function compareField(
  field: keyof CrossSurfaceKpiSnapshot,
  a: CrossSurfaceKpiSnapshot,
  b: CrossSurfaceKpiSnapshot
): string | null {
  if (field === 'surface' || field === 'projectId') return null;
  const av = a[field];
  const bv = b[field];
  if (av !== bv) {
    return `${String(field)}: ${String(a.surface)}=${String(av)} vs ${String(b.surface)}=${String(bv)}`;
  }
  return null;
}

/** Dev-only — warn when two surfaces render different canonical KPI values for the same project. */
export function registerCrossSurfaceOperationalKpis(snapshot: CrossSurfaceKpiSnapshot): void {
  if (process.env.NODE_ENV !== 'development') return;

  const key = snapshot.projectId ?? '__workspace__';
  const list = surfaceRegistry.get(key) ?? [];
  const idx = list.findIndex((s) => s.surface === snapshot.surface);
  if (idx >= 0) list[idx] = snapshot;
  else list.push(snapshot);
  surfaceRegistry.set(key, list);

  if (list.length < 2) return;

  const baseline = list[0]!;
  const mismatches: string[] = [];
  for (let i = 1; i < list.length; i++) {
    const other = list[i]!;
    for (const field of [
      'participantCount',
      'earningsConfiguredCount',
      'payoutReadyCount',
      'obligationCount',
      'releaseEligibleCount',
      'fundingAllocated',
    ] as const) {
      const diff = compareField(field, baseline, other);
      if (diff) mismatches.push(diff);
    }
  }

  if (mismatches.length === 0) return;

  const message = `[convergence-warning] KPI mismatch for ${key}: ${mismatches.join('; ')}`;
  console.warn(message);
  throw new OperationalInvariantViolation('SURFACE_KPI_CONVERGENCE_MISMATCH', message);
}

export function clearCrossSurfaceOperationalKpisRegistry(): void {
  surfaceRegistry.clear();
}
