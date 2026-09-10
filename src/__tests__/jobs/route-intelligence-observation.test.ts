import { runRouteIntelligenceObservationJob } from '@/lib/jobs/route-intelligence-observation';
import type { ObservationRepository } from '@/lib/route-intelligence/observation-store.server';
import type { ProviderOperationalHealthObservation } from '@/lib/route-intelligence/types';
import { observationStaleAfter } from '@/lib/route-intelligence/observation';

function observation(): ProviderOperationalHealthObservation {
  const fetchedAt = '2026-09-10T14:00:00.000Z';
  return {
    observationType: 'provider_operational_health',
    subjectKind: 'provider_component',
    subjectId: 'wise:payments',
    providerId: 'wise',
    value: {
      pageIndicator: 'none',
      pageDescription: 'All Systems Operational',
      componentId: '2jxb8y760wrd',
      componentName: 'Payments',
      componentStatus: 'operational',
    },
    observedAt: '2026-09-10T13:09:10.107Z',
    fetchedAt,
    sourceId: 'wise_statuspage',
    sourceUrl: 'https://status.wise.com/api/v2/summary.json',
    provenance: 'externally_sourced',
    confidence: 'high',
    staleAfter: observationStaleAfter(fetchedAt).toISOString(),
    rawHash: 'abc',
    rawEvidence: {
      pageUpdatedAt: '2026-09-10T13:09:10.107Z',
      pageIndicator: 'none',
      pageDescription: 'All Systems Operational',
      componentId: '2jxb8y760wrd',
      componentName: 'Payments',
      componentStatus: 'operational',
    },
  };
}

describe('route intelligence observation job', () => {
  it('persists a valid observation', async () => {
    const persist = jest.fn(async () => ({
      action: 'inserted' as const,
      id: 'row-1',
      observation: observation(),
    }));

    const persistIncident = jest.fn();
    const result = await runRouteIntelligenceObservationJob({
      observe: async () => ({ ok: true, observation: observation(), incidents: [] }),
      persist,
      persistIncident,
      repository: {} as ObservationRepository,
    });

    expect(result.success).toBe(true);
    expect(result.data?.action).toBe('inserted');
    expect(result.data?.componentStatus).toBe('operational');
    expect(persist).toHaveBeenCalled();
    expect(persistIncident).not.toHaveBeenCalled();
  });

  it('fails closed without creating an operational observation', async () => {
    const persist = jest.fn();
    const persistIncident = jest.fn();
    const result = await runRouteIntelligenceObservationJob({
      observe: async () => ({ ok: false, reason: 'http_failure', incidents: [] }),
      persist,
      persistIncident,
      repository: {} as ObservationRepository,
    });

    expect(result.success).toBe(false);
    expect(result.data?.reason).toBe('http_failure');
    expect(persist).not.toHaveBeenCalled();
    expect(persistIncident).not.toHaveBeenCalled();
  });
});
