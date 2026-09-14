import 'server-only';

import {
  createPrismaObservationRepository,
  getLatestWiseIncidentObservations,
  getLatestWisePaymentsObservation,
} from '@/lib/route-intelligence/observation-store.server';
import type { PublicRouteIntelligenceSnapshotInput } from '@/lib/route-intelligence/types';

/**
 * Loads optional live Wise observations from the database.
 * Falls back to catalog-only intelligence when DB is unavailable or empty.
 */
export async function loadAdvisorIntelligenceContext(): Promise<PublicRouteIntelligenceSnapshotInput> {
  const now = new Date();

  try {
    const { prisma } = await import('@/lib/server/prisma');
    const repository = createPrismaObservationRepository(prisma);
    const [wisePaymentsHealth, wiseIncidents] = await Promise.all([
      getLatestWisePaymentsObservation(repository, now),
      getLatestWiseIncidentObservations(repository),
    ]);

    return {
      now,
      wisePaymentsHealth,
      wiseIncidents,
    };
  } catch {
    return { now };
  }
}
