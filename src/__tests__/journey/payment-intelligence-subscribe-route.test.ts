import { POST } from '@/app/api/payment-intelligence/subscribe/route';
import { joinPaymentIntelligence } from '@/lib/marketing/join-payment-intelligence.server';
import { applyRateLimit } from '@/lib/rate-limit';
import { getTurnstileConfig, verifyTurnstileToken } from '@/lib/auth/turnstile.server';

jest.mock('@/lib/marketing/join-payment-intelligence.server', () => ({
  PaymentIntelligenceConsentError: class PaymentIntelligenceConsentError extends Error {
    constructor() {
      super('Consent is required.');
      this.name = 'PaymentIntelligenceConsentError';
    }
  },
  joinPaymentIntelligence: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => '127.0.0.1'),
}));

jest.mock('@/lib/auth/turnstile.server', () => ({
  getTurnstileConfig: jest.fn(),
  verifyTurnstileToken: jest.fn(),
}));

const joinMock = joinPaymentIntelligence as jest.MockedFunction<typeof joinPaymentIntelligence>;
const rateLimitMock = applyRateLimit as jest.MockedFunction<typeof applyRateLimit>;
const turnstileConfigMock = getTurnstileConfig as jest.MockedFunction<typeof getTurnstileConfig>;
const verifyTurnstileMock = verifyTurnstileToken as jest.MockedFunction<typeof verifyTurnstileToken>;

const request = (body: unknown) =>
  new Request('http://localhost/api/payment-intelligence/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/payment-intelligence/subscribe', () => {
  beforeEach(() => {
    joinMock.mockReset();
    verifyTurnstileMock.mockReset();
    rateLimitMock.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 1000,
    });
    turnstileConfigMock.mockReturnValue({
      enabled: false,
      siteKey: null,
      requiredForSignup: false,
      requiredForLogin: false,
      requiredForPasswordReset: false,
      failureThreshold: 3,
    });
  });

  it('accepts a valid signup and does not return the email or invent delivery', async () => {
    joinMock.mockResolvedValue({ ok: true, signup: 'created' });
    const res = await POST(
      request({
        email: 'ada@provvy.com',
        consent: true,
        origin: 'AU',
        destination: 'ID',
        compared: true,
      }) as never
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.message).toBe("You're on the Payment Intelligence list.");
    expect(JSON.stringify(json)).not.toContain('ada@provvy.com');
    expect(json).not.toHaveProperty('email');
    expect(json).not.toHaveProperty('sent');
    expect(joinMock).toHaveBeenCalledWith({
      email: 'ada@provvy.com',
      consent: true,
      context: { origin: 'AU', destination: 'ID', compared: true },
    });
  });

  it('rejects invalid emails without persisting', async () => {
    const res = await POST(request({ email: 'nope', consent: true }) as never);
    expect(res.status).toBe(400);
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('returns 429 when the public rate limit is exceeded', async () => {
    rateLimitMock.mockResolvedValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() + 1000,
    });
    const res = await POST(request({ email: 'ada@provvy.com', consent: true }) as never);
    expect(res.status).toBe(429);
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('returns an honest error when persistence fails', async () => {
    joinMock.mockRejectedValue(new Error('db down'));
    const res = await POST(request({ email: 'ada@provvy.com', consent: true }) as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/couldn't save that just now/i);
  });
});
