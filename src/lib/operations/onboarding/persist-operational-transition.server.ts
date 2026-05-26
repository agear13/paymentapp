import 'server-only';

import { prisma } from '@/lib/server/prisma';
import type {
  OperationalTransitionRecord,
  OperationalTransitionStatus,
  OperationalTransitionType,
} from '@/lib/operations/onboarding/operational-transition-types';

function rowToRecord(row: {
  id: string;
  organization_id: string | null;
  project_id: string | null;
  record_kind: string;
  phase: string;
  previous_phase: string | null;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  failed_at: Date | null;
  correlation_id: string;
  trigger_source: string;
  user_id: string | null;
  metadata: unknown;
  orchestration_event_id: string | null;
}): OperationalTransitionRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    recordKind: row.record_kind,
    phase: row.phase as OperationalTransitionType,
    previousPhase: row.previous_phase as OperationalTransitionType | null,
    status: row.status as OperationalTransitionStatus,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    failedAt: row.failed_at?.toISOString() ?? null,
    correlationId: row.correlation_id,
    triggerSource: row.trigger_source,
    userId: row.user_id,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : null,
    orchestrationEventId: row.orchestration_event_id,
  };
}

export async function listOperationalTransitions(input: {
  organizationId: string;
  correlationId?: string;
  limit?: number;
}): Promise<OperationalTransitionRecord[]> {
  const rows = await prisma.operational_onboarding_transitions.findMany({
    where: {
      organization_id: input.organizationId,
      ...(input.correlationId ? { correlation_id: input.correlationId } : {}),
    },
    orderBy: { started_at: 'asc' },
    take: input.limit ?? 200,
  });
  return rows.map(rowToRecord);
}

export async function getLatestOperationalCorrelationId(
  organizationId: string
): Promise<string | null> {
  const row = await prisma.operational_onboarding_transitions.findFirst({
    where: { organization_id: organizationId },
    orderBy: { started_at: 'desc' },
    select: { correlation_id: true },
  });
  return row?.correlation_id ?? null;
}

export async function countActiveInitializationChains(
  organizationId: string
): Promise<number> {
  const started = await prisma.operational_onboarding_transitions.findMany({
    where: {
      organization_id: organizationId,
      status: 'started',
      phase: {
        in: [
          'OPERATIONAL_GRAPH_INITIALIZATION_STARTED',
          'ONBOARDING_STARTED',
        ],
      },
    },
    select: { correlation_id: true, started_at: true },
    orderBy: { started_at: 'desc' },
    take: 20,
  });

  const chains = new Set<string>();
  for (const row of started) {
    const completed = await prisma.operational_onboarding_transitions.findFirst({
      where: {
        organization_id: organizationId,
        correlation_id: row.correlation_id,
        phase: 'OPERATIONAL_GRAPH_READY',
        status: 'completed',
      },
    });
    if (!completed) chains.add(row.correlation_id);
  }
  return chains.size;
}

export async function hasCompletedTransition(input: {
  organizationId: string;
  phase: OperationalTransitionType;
  correlationId?: string;
}): Promise<boolean> {
  const row = await prisma.operational_onboarding_transitions.findFirst({
    where: {
      organization_id: input.organizationId,
      phase: input.phase,
      status: 'completed',
      ...(input.correlationId ? { correlation_id: input.correlationId } : {}),
    },
  });
  return Boolean(row);
}

/** Persist immutable operational transition — skips duplicate completed records. */
export async function persistOperationalTransition(input: {
  organizationId: string | null;
  projectId?: string | null;
  recordKind?: 'transition' | 'bootstrap_event' | 'graph_initialization' | 'settlement_rail_initialization';
  phase: OperationalTransitionType;
  previousPhase?: OperationalTransitionType | null;
  status: OperationalTransitionStatus;
  correlationId: string;
  triggerSource: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  orchestrationEventId?: string;
}): Promise<OperationalTransitionRecord> {
  if (input.organizationId && input.status === 'completed') {
    const existing = await prisma.operational_onboarding_transitions.findFirst({
      where: {
        organization_id: input.organizationId,
        phase: input.phase,
        status: 'completed',
        correlation_id: input.correlationId,
      },
    });
    if (existing) return rowToRecord(existing);
  }

  const now = new Date();
  const row = await prisma.operational_onboarding_transitions.create({
    data: {
      organization_id: input.organizationId,
      project_id: input.projectId ?? null,
      record_kind: input.recordKind ?? 'transition',
      phase: input.phase,
      previous_phase: input.previousPhase ?? null,
      status: input.status,
      started_at: now,
      completed_at: input.status === 'completed' ? now : null,
      failed_at: input.status === 'failed' ? now : null,
      correlation_id: input.correlationId,
      trigger_source: input.triggerSource,
      user_id: input.userId ?? null,
      metadata: input.metadata ?? undefined,
      orchestration_event_id: input.orchestrationEventId ?? null,
    },
  });

  return rowToRecord(row);
}
