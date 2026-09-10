import { PAYMENT_INTELLIGENCE_FEED } from '@/lib/journey/payment-intelligence-feed';
import {
  CORRIDOR_CAPABILITY_MATRIX,
  assertSupportedRequiresEvidence,
  declaredCapabilityStatus,
  evidenceIsSufficient,
} from '@/lib/route-intelligence';

describe('sourced capability matrix', () => {
  it('requires evidence on every explicit supported or unsupported row', () => {
    expect(CORRIDOR_CAPABILITY_MATRIX.length).toBeGreaterThan(0);
    for (const row of CORRIDOR_CAPABILITY_MATRIX) {
      expect(row.status).toMatch(/^(supported|unsupported)$/);
      expect(evidenceIsSufficient(row.evidence)).toBe(true);
      expect(row.evidence.retrievedAt).toBeNull();
      expect(() => assertSupportedRequiresEvidence(row)).not.toThrow();
    }
  });

  it('never infers a network rail', () => {
    for (const row of CORRIDOR_CAPABILITY_MATRIX) {
      expect(row.networkRails).toEqual(['unknown']);
    }
  });

  it('can represent different capability states for AU → ID and AU → TH', () => {
    const idr = CORRIDOR_CAPABILITY_MATRIX.find(
      (row) => row.id === 'airwallex-international-id-idr-supplier'
    );
    const thb = CORRIDOR_CAPABILITY_MATRIX.find(
      (row) => row.id === 'airwallex-international-th-thb-supplier'
    );
    expect(idr?.status).toBe('unsupported');
    expect(thb?.status).toBe('supported');
    expect(idr?.destination).toBe('ID');
    expect(thb?.destination).toBe('TH');
    expect(idr?.currencyPair.target).toBe('IDR');
    expect(thb?.currencyPair.target).toBe('THB');
  });

  it('does not treat Payment Intelligence news as capability decisions', () => {
    const headlines = PAYMENT_INTELLIGENCE_FEED.map((item) => item.headline);
    const encoded = JSON.stringify(CORRIDOR_CAPABILITY_MATRIX);
    for (const headline of headlines) {
      expect(encoded).not.toContain(headline);
    }
  });
});

describe('honesty: unspecified cannot become supported', () => {
  it('refuses to honour supported or unsupported without evidence', () => {
    expect(declaredCapabilityStatus('supported', null)).toBe('unspecified');
    expect(declaredCapabilityStatus('unsupported', null)).toBe('unspecified');
    expect(
      declaredCapabilityStatus('supported', {
        source: '',
        sourceUrl: '',
        sourceType: 'provider_docs',
        publishedAt: null,
        retrievedAt: null,
        asOf: null,
        notes: '',
        freshness: 'unknown',
        staleAfterDays: null,
      })
    ).toBe('unspecified');
  });

  it('keeps unspecified as unspecified even if leftover evidence is present', () => {
    expect(
      declaredCapabilityStatus('unspecified', {
        source: 'Someone',
        sourceUrl: 'https://example.com',
        sourceType: 'provider_docs',
        publishedAt: null,
        retrievedAt: null,
        asOf: null,
        notes: 'This must not promote the status.',
        freshness: 'unknown',
        staleAfterDays: null,
      })
    ).toBe('unspecified');
  });

  it('only returns supported when the declaration is supported and evidence is complete', () => {
    expect(
      declaredCapabilityStatus('supported', {
        source: 'Wise Help Centre',
        sourceUrl: 'https://wise.com/help/articles/2571942/what-countriesregions-can-i-send-to',
        sourceType: 'provider_help',
        publishedAt: null,
        retrievedAt: null,
        asOf: null,
        notes: 'Indonesia is listed as a send-to country.',
        freshness: 'unknown',
        staleAfterDays: null,
      })
    ).toBe('supported');
  });
});
