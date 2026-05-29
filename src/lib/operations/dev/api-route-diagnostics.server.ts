import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

type ApiRouteStore = {
  dbQueryCount: number;
};

const routeStore = new AsyncLocalStorage<ApiRouteStore>();

export type OperationalApiRouteContext = {
  requestId: string;
  correlationId: string;
  route: string;
  projectId: string | null;
  startedAt: number;
  initializationDurationMs: number;
  graphBuildDurationMs: number;
};

export function incrementOperationalApiDbQueryCount(): void {
  const store = routeStore.getStore();
  if (store) store.dbQueryCount += 1;
}

export function getOperationalApiDbQueryCount(): number {
  return routeStore.getStore()?.dbQueryCount ?? 0;
}

export function createOperationalApiRouteContext(input: {
  route: string;
  request?: Request;
  projectId?: string | null;
}): OperationalApiRouteContext {
  const requestId = randomUUID();
  const correlationId =
    input.request?.headers.get('x-correlation-id')?.trim() ||
    input.request?.headers.get('x-request-id')?.trim() ||
    requestId;

  return {
    requestId,
    correlationId,
    route: input.route,
    projectId: input.projectId ?? null,
    startedAt: Date.now(),
    initializationDurationMs: 0,
    graphBuildDurationMs: 0,
  };
}

export function logOperationalApiRoutePhase(
  ctx: OperationalApiRouteContext,
  input: {
    phase: string;
    durationMs?: number;
    success?: boolean;
    failure?: boolean;
    dbQueryCount?: number;
    initializationDurationMs?: number;
    graphBuildDurationMs?: number;
    errorMessage?: string;
    extra?: Record<string, unknown>;
  }
): void {
  if (input.initializationDurationMs != null) {
    ctx.initializationDurationMs = input.initializationDurationMs;
  }
  if (input.graphBuildDurationMs != null) {
    ctx.graphBuildDurationMs = input.graphBuildDurationMs;
  }

  console.info('[operational-api-route]', {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    route: ctx.route,
    projectId: ctx.projectId,
    phase: input.phase,
    durationMs: input.durationMs ?? Date.now() - ctx.startedAt,
    dbQueryCount: input.dbQueryCount ?? getOperationalApiDbQueryCount(),
    initializationDurationMs: ctx.initializationDurationMs,
    graphBuildDurationMs: ctx.graphBuildDurationMs,
    success: input.success ?? !input.failure,
    failure: input.failure ?? false,
    errorMessage: input.errorMessage ?? null,
    at: new Date().toISOString(),
    ...input.extra,
  });
}

export async function runOperationalApiRoute<T>(
  ctx: OperationalApiRouteContext,
  fn: () => Promise<T>
): Promise<T> {
  logOperationalApiRoutePhase(ctx, { phase: 'request-start', durationMs: 0, success: true });

  return routeStore.run({ dbQueryCount: 0 }, async () => {
    try {
      const result = await fn();
      logOperationalApiRoutePhase(ctx, {
        phase: 'request-complete',
        success: true,
        dbQueryCount: getOperationalApiDbQueryCount(),
      });
      return result;
    } catch (error) {
      logOperationalApiRoutePhase(ctx, {
        phase: 'request-error',
        failure: true,
        success: false,
        dbQueryCount: getOperationalApiDbQueryCount(),
        errorMessage: error instanceof Error ? error.message : String(error),
        extra: {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      throw error;
    }
  });
}

/** Log DJ Alex (or named participant) persistence fields from production payload — read only. */
export function logParticipantPersistenceFinding(input: {
  correlationId: string;
  route: string;
  participantId: string;
  name: string | null;
  compensationProfileExists: boolean;
  configuredAt: string | null;
  earningsStructure: unknown;
  hasPersistedCompensationTerms: boolean;
}): void {
  if (!input.name?.toLowerCase().includes('dj alex')) return;

  console.info('[participant-persistence-finding]', {
    correlationId: input.correlationId,
    route: input.route,
    participantId: input.participantId,
    name: input.name,
    compensationProfileExists: input.compensationProfileExists,
    configuredAt: input.configuredAt,
    earningsStructure: input.earningsStructure,
    selectorResult: {
      hasPersistedCompensationTerms: input.hasPersistedCompensationTerms,
    },
    at: new Date().toISOString(),
  });
}
