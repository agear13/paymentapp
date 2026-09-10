import {
  corridorKind,
  createRouteSubject,
  isUnknownNetworkRail,
  mechanismIsNotNetworkRail,
  NETWORK_RAIL_CATALOGUE,
  networkRailById,
  normalizeJurisdiction,
  OFFERING_RAIL_MAPPINGS,
  resolveOfferingRail,
  sameNetworkRail,
  UNKNOWN_NETWORK_RAIL,
} from '@/lib/route-intelligence';
import type { NetworkRail } from '@/lib/route-intelligence/types';

describe('network rail identity', () => {
  it('represents a domestic rail', () => {
    const npp = networkRailById('npp');
    expect(npp?.jurisdictions).toEqual(['AU']);
    expect(npp?.additionalTypes).toContain('domestic_payment');
    expect(corridorKind({ origin: 'AU', destination: 'AU' })).toBe('domestic');
  });

  it('represents a cross-border rail', () => {
    const swift = networkRailById('swift');
    expect(swift?.railType).toBe('bank_messaging');
    expect(swift?.additionalTypes).toContain('cross_border_payment');
    expect(corridorKind({ origin: 'AU', destination: 'ID' })).toBe('cross_border');
  });

  it('keeps mechanism and network rail distinct', () => {
    expect(mechanismIsNotNetworkRail('international_bank', 'swift')).toBe(true);
    expect(mechanismIsNotNetworkRail('domestic_bank', 'bi_fast')).toBe(true);
    const route = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      networkRail: UNKNOWN_NETWORK_RAIL,
    });
    expect(route.mechanismId).toBe('international_bank');
    expect(route.networkRail).toBe('unknown');
    expect(route.mechanismId).not.toBe(route.networkRail);
  });

  it('keeps an unknown rail unknown', () => {
    expect(isUnknownNetworkRail('unknown')).toBe(true);
    expect(isUnknownNetworkRail(UNKNOWN_NETWORK_RAIL)).toBe(true);
    expect(resolveOfferingRail({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
    })).toBe('unknown');
    expect(OFFERING_RAIL_MAPPINGS).toEqual([]);
  });

  it('gives two rails distinct identities', () => {
    expect(sameNetworkRail('bi_fast', 'sknbi')).toBe(false);
    expect(networkRailById('bi_fast')?.id).not.toBe(networkRailById('sknbi')?.id);
    const a = createRouteSubject({
      providerId: 'bank',
      offeringId: 'bank-domestic-a',
      mechanismId: 'domestic_bank',
      corridor: { origin: 'ID', destination: 'ID' },
      sourceCurrency: 'IDR',
      destinationCurrency: 'IDR',
      networkRail: 'bi_fast',
    });
    const b = createRouteSubject({
      providerId: 'bank',
      offeringId: 'bank-domestic-b',
      mechanismId: 'domestic_bank',
      corridor: { origin: 'ID', destination: 'ID' },
      sourceCurrency: 'IDR',
      destinationCurrency: 'IDR',
      networkRail: 'sknbi',
    });
    expect(a.networkRail).not.toBe(b.networkRail);
  });
});

describe('jurisdiction representation', () => {
  const expected = ['AU', 'ID', 'SG', 'TH', 'MY', 'PH', 'VN', 'US'];

  it.each(expected)('supports %s without a closed country enum', (code) => {
    expect(normalizeJurisdiction(code)).toBe(code);
    expect(NETWORK_RAIL_CATALOGUE.some((rail) => rail.jurisdictions.includes(code))).toBe(true);
  });

  it('represents additional future countries without editing a core enum', () => {
    const zengin: NetworkRail = {
      id: 'zengin',
      name: 'Zengin',
      operator: 'test fixture — not a catalogue claim',
      railType: 'account_to_account',
      additionalTypes: ['domestic_payment'],
      jurisdictions: ['JP'],
      currencies: ['JPY'],
      evidence: {
        source: 'test',
        sourceUrl: 'https://example.test/zengin',
        sourceType: 'regulator',
        publishedAt: null,
        retrievedAt: null,
        asOf: null,
        notes: 'Constructed in test to prove JurisdictionCode is an open string.',
        freshness: 'unknown',
        staleAfterDays: null,
      },
    };
    expect(normalizeJurisdiction('jp')).toBe('JP');
    expect(zengin.jurisdictions).toEqual(['JP']);
    expect(corridorKind({ origin: 'JP', destination: 'JP' })).toBe('domestic');
    expect(corridorKind({ origin: 'JP', destination: 'AU' })).toBe('cross_border');
  });

  it('does not treat international as a synonym for cross-border', () => {
    expect(corridorKind({ origin: 'AU', destination: 'US' })).toBe('cross_border');
    expect(corridorKind({ origin: 'US', destination: 'US' })).toBe('domestic');
  });
});

describe('authoritative catalogue coverage', () => {
  it('covers representative rails in the first evidence markets', () => {
    const ids = NETWORK_RAIL_CATALOGUE.map((rail) => rail.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'npp',
        'bi_fast',
        'sknbi',
        'sg_fast',
        'promptpay',
        'duitnow',
        'instapay',
        'napas',
        'fednow',
        'swift',
      ])
    );
  });

  it('stores a source URL on every catalogue rail', () => {
    for (const rail of NETWORK_RAIL_CATALOGUE) {
      expect(rail.evidence.sourceUrl).toMatch(/^https:\/\//);
      expect(rail.evidence.source.trim().length).toBeGreaterThan(0);
    }
  });
});
