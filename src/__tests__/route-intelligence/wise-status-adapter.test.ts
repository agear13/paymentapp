import {
  WISE_PAYMENTS_COMPONENT_ID,
  WISE_STATUS_SUMMARY_URL,
  fetchWiseStatusSummary,
  parseWisePaymentsObservation,
} from '@/lib/route-intelligence/wise-status-adapter';
import { assertExternallySourcedObservation } from '@/lib/route-intelligence/observation';

const FETCHED_AT = new Date('2026-09-10T12:00:00.000Z');

function component(
  id: string,
  name: string,
  status: string
): Record<string, unknown> {
  return { id, name, status };
}

function summary(overrides: {
  indicator?: string;
  description?: string;
  updatedAt?: string;
  components?: Record<string, unknown>[];
} = {}): Record<string, unknown> {
  return {
    page: {
      id: 'hg7qg2qssg6b',
      name: 'Wise',
      url: 'https://status.wise.com',
      updated_at: overrides.updatedAt ?? '2026-09-10T13:09:10.107+01:00',
    },
    status: {
      indicator: overrides.indicator ?? 'none',
      description: overrides.description ?? 'All Systems Operational',
    },
    components: overrides.components ?? [
      component('pjk12xprcn1p', 'Mobile App', 'operational'),
      component('blqbkggdgs46', 'Website', 'operational'),
      component(WISE_PAYMENTS_COMPONENT_ID, 'Payments', 'operational'),
      component('k4gnl1y9yzqh', 'Customer Support', 'operational'),
      component('bmfb24t34ymm', 'API', 'operational'),
    ],
  };
}

describe('Wise Statuspage adapter', () => {
  it.each([
    ['operational', 'operational'],
    ['degraded_performance', 'degraded_performance'],
    ['partial_outage', 'partial_outage'],
    ['major_outage', 'major_outage'],
  ] as const)('parses Payments status %s', (status, expected) => {
    const result = parseWisePaymentsObservation(
      summary({
        components: [
          component('blqbkggdgs46', 'Website', 'operational'),
          component(WISE_PAYMENTS_COMPONENT_ID, 'Payments', status),
        ],
      }),
      FETCHED_AT
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.value.componentStatus).toBe(expected);
    expect(result.observation.value.componentId).toBe(WISE_PAYMENTS_COMPONENT_ID);
    expect(result.observation.provenance).toBe('externally_sourced');
    expect(result.observation.sourceUrl).toBe(WISE_STATUS_SUMMARY_URL);
    expect(result.observation.observedAt).toBe(new Date('2026-09-10T13:09:10.107+01:00').toISOString());
    expect(result.observation.fetchedAt).toBe(FETCHED_AT.toISOString());
    assertExternallySourcedObservation(result.observation);
  });

  it('fails closed on a malformed payload', () => {
    expect(parseWisePaymentsObservation({ hello: 'nope' }, FETCHED_AT)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('fails closed when the official Payments component id is missing', () => {
    const result = parseWisePaymentsObservation(
      summary({
        components: [
          component('blqbkggdgs46', 'Website', 'major_outage'),
          component('other-id', 'Payments', 'operational'),
        ],
      }),
      FETCHED_AT
    );
    expect(result).toEqual({ ok: false, reason: 'missing_payments_component' });
  });

  it('does not treat a Website outage as Payments health', () => {
    const result = parseWisePaymentsObservation(
      summary({
        indicator: 'major',
        description: 'Partial System Outage',
        components: [
          component('blqbkggdgs46', 'Website', 'major_outage'),
          component(WISE_PAYMENTS_COMPONENT_ID, 'Payments', 'operational'),
        ],
      }),
      FETCHED_AT
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.value.componentStatus).toBe('operational');
    expect(result.observation.value.pageIndicator).toBe('major');
    expect(result.observation.value.componentStatus).not.toBe('major_outage');
  });

  it('does not treat a Mobile App outage as Payments health', () => {
    const result = parseWisePaymentsObservation(
      summary({
        components: [
          component('pjk12xprcn1p', 'Mobile App', 'major_outage'),
          component(WISE_PAYMENTS_COMPONENT_ID, 'Payments', 'operational'),
        ],
      }),
      FETCHED_AT
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.value.componentStatus).toBe('operational');
  });

  it('does not treat a Customer Support outage as Payments health', () => {
    const result = parseWisePaymentsObservation(
      summary({
        components: [
          component('k4gnl1y9yzqh', 'Customer Support', 'partial_outage'),
          component(WISE_PAYMENTS_COMPONENT_ID, 'Payments', 'operational'),
        ],
      }),
      FETCHED_AT
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.value.componentStatus).toBe('operational');
  });

  it('does not substitute page-level major for Payments major_outage', () => {
    const result = parseWisePaymentsObservation(
      summary({
        indicator: 'major',
        description: 'Partial System Outage',
        components: [
          component(WISE_PAYMENTS_COMPONENT_ID, 'Payments', 'operational'),
        ],
      }),
      FETCHED_AT
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.value.pageIndicator).toBe('major');
    expect(result.observation.value.componentStatus).toBe('operational');
  });

  it('fails closed on HTTP failure and does not invent operational', async () => {
    const fetcher = jest.fn(async () => ({
      ok: false,
      json: async () => summary(),
    })) as unknown as typeof fetch;

    const result = await fetchWiseStatusSummary({ fetcher });
    expect(result).toEqual({ ok: false, reason: 'http_failure' });
  });

  it('refuses to fetch a host other than status.wise.com', async () => {
    const fetcher = jest.fn();
    const result = await fetchWiseStatusSummary({
      fetcher: fetcher as unknown as typeof fetch,
      url: 'https://api.wise.com/v1/quotes',
    });
    expect(result).toEqual({ ok: false, reason: 'http_failure' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
