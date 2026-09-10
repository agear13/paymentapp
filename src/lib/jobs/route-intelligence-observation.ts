import { loggers } from '@/lib/logger';
import {
  createPrismaObservationRepository,
  persistOperationalHealthObservation,
  persistPaymentIncidentObservation,
  type ObservationRepository,
} from '@/lib/route-intelligence/observation-store.server';
import {
  observeWiseStatus,
  type WiseStatusObservationResult,
} from '@/lib/route-intelligence/wise-status-adapter';

export type RouteIntelligenceObservationJobResult = {
  success: boolean;
  message: string;
  data?: {
    action?: 'inserted' | 'refreshed';
    subjectId?: string;
    componentStatus?: string;
    pageIndicator?: string;
    observedAt?: string;
    fetchedAt?: string;
    reason?: string;
    incidentActions?: Array<{ action: 'inserted' | 'refreshed'; incidentId: string; status: string }>;
  };
};

export async function runRouteIntelligenceObservationJob(deps?: {
  observe?: () => Promise<WiseStatusObservationResult>;
  persist?: typeof persistOperationalHealthObservation;
  persistIncident?: typeof persistPaymentIncidentObservation;
  repository?: ObservationRepository;
}): Promise<RouteIntelligenceObservationJobResult> {
  const observe = deps?.observe ?? observeWiseStatus;
  const persist = deps?.persist ?? persistOperationalHealthObservation;
  const persistIncident = deps?.persistIncident ?? persistPaymentIncidentObservation;
  const repository =
    deps?.repository ??
    createPrismaObservationRepository((await import('@/lib/server/prisma')).prisma);

  const observed = await observe();
  if (!observed.ok) {
    for (const incident of observed.incidents) {
      await persistIncident(repository, incident);
    }
    loggers.jobs.warn('Wise Statuspage observation failed closed', {
      reason: observed.reason,
      incidentCount: observed.incidents.length,
    });
    return {
      success: false,
      message: `Wise Statuspage observation failed: ${observed.reason}`,
      data: { reason: observed.reason },
    };
  }

  const persisted = await persist(repository, observed.observation);
  const incidentActions: Array<{
    action: 'inserted' | 'refreshed';
    incidentId: string;
    status: string;
  }> = [];
  for (const incident of observed.incidents) {
    const saved = await persistIncident(repository, incident);
    incidentActions.push({
      action: saved.action,
      incidentId: saved.observation.value.incidentId,
      status: saved.observation.value.status,
    });
  }

  loggers.jobs.info('Stored Wise Payments operational-health observation', {
    action: persisted.action,
    subjectId: persisted.observation.subjectId,
    componentStatus: persisted.observation.value.componentStatus,
    pageIndicator: persisted.observation.value.pageIndicator,
    observedAt: persisted.observation.observedAt,
    fetchedAt: persisted.observation.fetchedAt,
    incidentCount: incidentActions.length,
  });

  return {
    success: true,
    message:
      persisted.action === 'inserted'
        ? 'Recorded a new Wise Payments health state'
        : 'Refreshed fetch timestamp for unchanged Wise Payments health',
    data: {
      action: persisted.action,
      subjectId: persisted.observation.subjectId,
      componentStatus: persisted.observation.value.componentStatus,
      pageIndicator: persisted.observation.value.pageIndicator,
      observedAt: persisted.observation.observedAt,
      fetchedAt: persisted.observation.fetchedAt,
      incidentActions,
    },
  };
}
