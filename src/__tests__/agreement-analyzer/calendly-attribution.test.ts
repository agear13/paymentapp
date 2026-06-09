import {
  buildCalendlyDemoBookingLink,
  buildCalendlyDemoUrl,
  createCalendlyTrackingToken,
  parseCalendlyTrackingToken,
} from '@/lib/agreement-analyzer/calendly/calendly-attribution.server';

const TEST_SECRET = 'test-calendly-tracking-secret-value-32chars';
const LEAD_ID = '11111111-1111-4111-8111-111111111111';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';

const basePayload = {
  leadId: LEAD_ID,
  reportId: REPORT_ID,
  overallScore: 75,
  priorityBand: 'HIGH',
  recommendedUseCase: 'Event Revenue Sharing',
};

describe('calendly attribution tracking', () => {
  const originalSecret = process.env.AGREEMENT_ANALYZER_TRACKING_SECRET;
  const originalDemoUrl = process.env.AGREEMENT_ANALYZER_DEMO_URL;

  beforeEach(() => {
    process.env.AGREEMENT_ANALYZER_TRACKING_SECRET = TEST_SECRET;
    delete process.env.AGREEMENT_ANALYZER_DEMO_URL;
  });

  afterAll(() => {
    process.env.AGREEMENT_ANALYZER_TRACKING_SECRET = originalSecret;
    process.env.AGREEMENT_ANALYZER_DEMO_URL = originalDemoUrl;
  });

  it('creates and parses a signed tracking token', () => {
    const token = createCalendlyTrackingToken(basePayload);
    const parsed = parseCalendlyTrackingToken(token);

    expect(parsed).toEqual(basePayload);
  });

  it('does not expose raw database ids in the Calendly URL', () => {
    const { url } = buildCalendlyDemoBookingLink(basePayload);

    expect(url).toContain('https://calendly.com/provvypay/demo?tracking=');
    expect(url).not.toContain(LEAD_ID);
    expect(url).not.toContain(REPORT_ID);
    expect(url).not.toContain('leadId=');
    expect(url).not.toContain('reportId=');
  });

  it('builds demo URLs with a tracking query parameter', () => {
    const token = createCalendlyTrackingToken(basePayload);
    const url = buildCalendlyDemoUrl(token);
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://calendly.com/provvypay/demo');
    expect(parsed.searchParams.get('tracking')).toBe(token);
  });

  it('honors AGREEMENT_ANALYZER_DEMO_URL as the booking base', () => {
    process.env.AGREEMENT_ANALYZER_DEMO_URL = 'https://calendly.com/provvypay/custom-demo';

    const { url } = buildCalendlyDemoBookingLink(basePayload);

    expect(url.startsWith('https://calendly.com/provvypay/custom-demo?tracking=')).toBe(true);
  });

  it('rejects tampered tracking tokens', () => {
    const token = createCalendlyTrackingToken(basePayload);
    const [encodedPayload, signature] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...basePayload,
        overallScore: 100,
        iat: Math.floor(Date.now() / 1000),
      }),
      'utf8'
    ).toString('base64url');

    expect(parseCalendlyTrackingToken(`${tamperedPayload}.${signature}`)).toBeNull();
    expect(parseCalendlyTrackingToken(`${encodedPayload}.invalid-signature`)).toBeNull();
  });

  it('rejects expired tracking tokens', () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const token = createCalendlyTrackingToken(basePayload);

    jest.spyOn(Date, 'now').mockReturnValue(now + 91 * 24 * 60 * 60 * 1000);
    expect(parseCalendlyTrackingToken(token)).toBeNull();

    jest.restoreAllMocks();
  });
});
