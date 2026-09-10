import {
  corridorKind,
  RAIL_CAPABILITY_CATALOGUE,
  RAIL_CAPABILITY_STATUSES,
  railCapabilityId,
  railCapabilityStatusesAreDistinct,
} from '@/lib/route-intelligence';
import type { RailCapability, RailCapabilityStatus } from '@/lib/route-intelligence/types';

function capability(status: RailCapabilityStatus): RailCapability {
  return {
    id: railCapabilityId({
      railId: 'bi_fast',
      originCountry: 'ID',
      destinationCountry: 'ID',
      sourceCurrency: 'IDR',
      destinationCurrency: 'IDR',
      paymentType: 'supplier_payment',
    }),
    railId: 'bi_fast',
    originCountry: 'ID',
    destinationCountry: 'ID',
    sourceCurrency: 'IDR',
    destinationCurrency: 'IDR',
    paymentType: 'supplier_payment',
    corridorKind: 'domestic',
    participantRequirements: [],
    status,
    evidence: {
      source: 'test',
      sourceUrl: 'https://example.test/rail-capability',
      sourceType: 'regulator',
      publishedAt: null,
      retrievedAt: null,
      asOf: null,
      notes: 'Fixture — not catalogue evidence.',
      freshness: 'unknown',
      staleAfterDays: null,
    },
  };
}

describe('rail capability statuses', () => {
  it('represents supported', () => {
    expect(capability('supported').status).toBe('supported');
  });

  it('represents unsupported', () => {
    expect(capability('unsupported').status).toBe('unsupported');
  });

  it('represents restricted', () => {
    expect(capability('restricted').status).toBe('restricted');
  });

  it('represents unknown', () => {
    expect(capability('unknown').status).toBe('unknown');
  });

  it('does not collapse restricted into unsupported', () => {
    expect(capability('restricted').status).not.toBe(capability('unsupported').status);
    expect(RAIL_CAPABILITY_STATUSES).toEqual(
      expect.arrayContaining(['supported', 'unsupported', 'restricted', 'unknown'])
    );
    expect(railCapabilityStatusesAreDistinct()).toBe(true);
  });

  it('does not collapse unknown into supported', () => {
    expect(capability('unknown').status).not.toBe(capability('supported').status);
    const crossBorder = RAIL_CAPABILITY_CATALOGUE.find(
      (row) => row.railId === 'bi_fast' && row.originCountry === 'AU' && row.destinationCountry === 'ID'
    );
    expect(crossBorder?.status).toBe('unknown');
    expect(crossBorder?.status).not.toBe('supported');
  });
});

describe('rail capability catalogue', () => {
  it('derives domestic vs cross-border from origin and destination', () => {
    const domestic = RAIL_CAPABILITY_CATALOGUE.find(
      (row) => row.railId === 'bi_fast' && row.originCountry === 'ID' && row.destinationCountry === 'ID'
    );
    expect(domestic?.corridorKind).toBe('domestic');
    expect(domestic?.corridorKind).toBe(
      corridorKind({ origin: domestic!.originCountry!, destination: domestic!.destinationCountry! })
    );
    const unknownCross = RAIL_CAPABILITY_CATALOGUE.find(
      (row) => row.railId === 'bi_fast' && row.originCountry === 'AU'
    );
    expect(unknownCross?.corridorKind).toBe('cross_border');
  });
});
