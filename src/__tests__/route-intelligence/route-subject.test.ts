import {
  createRouteSubject,
  routeSubjectKey,
  sameRouteSubject,
  toRouteImpactSubject,
} from '@/lib/route-intelligence';

const AUD_IDR_INTERNATIONAL = createRouteSubject({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  corridor: { origin: 'AU', destination: 'ID' },
  sourceCurrency: 'AUD',
  destinationCurrency: 'IDR',
  networkRail: 'unknown',
});

describe('canonical RouteSubject identity', () => {
  it('gives Wise AUD → IDR international a stable identity', () => {
    const again = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      networkRail: 'unknown',
    });
    expect(routeSubjectKey(AUD_IDR_INTERNATIONAL)).toBe(
      'wise|wise-international|international_bank|AU|ID|AUD|IDR|unknown'
    );
    expect(sameRouteSubject(AUD_IDR_INTERNATIONAL, again)).toBe(true);
  });

  it('treats Wise AUD → IDR local as a different identity', () => {
    const local = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-local',
      mechanismId: 'local_currency_settlement',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      networkRail: 'unknown',
    });
    expect(routeSubjectKey(local)).not.toBe(routeSubjectKey(AUD_IDR_INTERNATIONAL));
  });

  it('treats Wise AUD → IDR as different from Wise AUD → THB', () => {
    const thb = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'TH' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'THB',
      networkRail: 'unknown',
    });
    expect(thb.currencyPair).toEqual({ source: 'AUD', target: 'THB' });
    expect(routeSubjectKey(thb)).not.toBe(routeSubjectKey(AUD_IDR_INTERNATIONAL));
  });

  it('treats Wise AUD → IDR as different from Airwallex AUD → IDR', () => {
    const airwallex = createRouteSubject({
      providerId: 'airwallex',
      offeringId: 'airwallex-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      networkRail: 'unknown',
    });
    expect(routeSubjectKey(airwallex)).not.toBe(routeSubjectKey(AUD_IDR_INTERNATIONAL));
  });

  it('treats different network rails as different identities', () => {
    const swift = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      networkRail: 'swift',
    });
    expect(routeSubjectKey(swift)).not.toBe(routeSubjectKey(AUD_IDR_INTERNATIONAL));
    expect(swift.networkRail).toBe('swift');
  });

  it('keeps an unknown rail explicit instead of inventing one', () => {
    expect(AUD_IDR_INTERNATIONAL.networkRail).toBe('unknown');
    expect(routeSubjectKey(AUD_IDR_INTERNATIONAL)).toContain('|unknown');
    expect(routeSubjectKey(AUD_IDR_INTERNATIONAL)).not.toContain('|swift');
  });
});

describe('RouteSubject currency pair', () => {
  it('represents AUD → IDR without collapsing to AUD → AUD', () => {
    expect(AUD_IDR_INTERNATIONAL.currencyPair).toEqual({ source: 'AUD', target: 'IDR' });
  });

  it('leaves a missing destination currency null', () => {
    const unknownDest = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      destinationCurrency: null,
      networkRail: 'unknown',
    });
    expect(unknownDest.currencyPair.target).toBeNull();
    expect(unknownDest.currencyPair.source).toBe('AUD');
    expect(routeSubjectKey(unknownDest)).not.toBe(routeSubjectKey(AUD_IDR_INTERNATIONAL));
  });

  it('does not infer IDR from Indonesia', () => {
    const indonesiaOnly = createRouteSubject({
      providerId: 'wise',
      offeringId: 'wise-international',
      mechanismId: 'international_bank',
      corridor: { origin: 'AU', destination: 'ID' },
      sourceCurrency: 'AUD',
      networkRail: 'unknown',
    });
    expect(indonesiaOnly.corridor.destination).toBe('ID');
    expect(indonesiaOnly.currencyPair.target).toBeNull();
  });

  it('adapts to RouteImpactSubject without inventing a destination currency', () => {
    const impact = toRouteImpactSubject(
      createRouteSubject({
        providerId: 'wise',
        offeringId: 'wise-international',
        mechanismId: 'international_bank',
        corridor: { origin: 'AU', destination: 'ID' },
        sourceCurrency: 'AUD',
        destinationCurrency: null,
        networkRail: 'unknown',
      })
    );
    expect(impact.currencyPair).toBeNull();
    expect(impact.offeringId).toBe('wise-international');
  });
});
