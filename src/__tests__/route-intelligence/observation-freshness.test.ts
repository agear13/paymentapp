import {
  assertExternallySourcedObservation,
  evaluateLatestObservation,
  isObservationFresh,
  OBSERVATION_FRESHNESS_MS,
  observationStaleAfter,
} from '@/lib/route-intelligence/observation';
import type { ProviderOperationalHealthObservation } from '@/lib/route-intelligence/types';

const NOW = new Date('2026-09-10T15:00:00.000Z');

function observation(
  overrides: Partial<ProviderOperationalHealthObservation> = {}
): ProviderOperationalHealthObservation {
  const fetchedAt = overrides.fetchedAt ?? '2026-09-10T14:00:00.000Z';
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
    ...overrides,
  };
}

describe('operational health freshness', () => {
  it('uses an explicit 3-hour freshness window', () => {
    expect(OBSERVATION_FRESHNESS_MS).toBe(3 * 60 * 60 * 1000);
  });

  it('treats a fresh observation as current and attachable', () => {
    const item = observation({ fetchedAt: '2026-09-10T13:00:00.000Z' });
    expect(isObservationFresh(item, NOW)).toBe(true);
    expect(evaluateLatestObservation(item, NOW)).toEqual({ kind: 'current', observation: item });
    assertExternallySourcedObservation(item);
  });

  it('treats a stale observation as unavailable, not operational', () => {
    const item = observation({ fetchedAt: '2026-09-10T11:00:00.000Z' });
    const read = evaluateLatestObservation(item, NOW);
    expect(isObservationFresh(item, NOW)).toBe(false);
    expect(read.kind).toBe('stale');
    if (read.kind !== 'stale') return;
    expect(read.observation.value.componentStatus).toBe('operational');
    expect(read.kind).not.toBe('current');
  });

  it('treats a missing observation as unavailable', () => {
    expect(evaluateLatestObservation(null, NOW)).toEqual({
      kind: 'unavailable',
      reason: 'missing',
    });
  });

  it('does not allow externally_sourced without observedAt, fetchedAt, or source URL', () => {
    const valid = observation();
    expect(() =>
      assertExternallySourcedObservation({ ...valid, observedAt: '' })
    ).toThrow(/observedAt/);
    expect(() =>
      assertExternallySourcedObservation({ ...valid, fetchedAt: '' })
    ).toThrow(/fetchedAt/);
    expect(() =>
      assertExternallySourcedObservation({ ...valid, sourceUrl: '' })
    ).toThrow(/sourceUrl/);
  });
});
