import { POST } from '@/app/api/jarvis/waitlist/route';
import { joinJarvisWaitlist } from '@/lib/marketing/join-jarvis-waitlist.server';
import { applyRateLimit } from '@/lib/rate-limit';
import { getTurnstileConfig, verifyTurnstileToken } from '@/lib/auth/turnstile.server';

jest.mock('@/lib/marketing/join-jarvis-waitlist.server', () => ({
  JarvisWaitlistConsentError: class JarvisWaitlistConsentError extends Error {
    constructor() {
      super('Consent is required.');
      this.name = 'JarvisWaitlistConsentError';
    }
  },
  joinJarvisWaitlist: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => '127.0.0.1'),
}));

jest.mock('@/lib/auth/turnstile.server', () => ({
  getTurnstileConfig: jest.fn(),
  verifyTurnstileToken: jest.fn(),
}));

const joinMock = joinJarvisWaitlist as jest.MockedFunction<typeof joinJarvisWaitlist>;
const rateLimitMock = applyRateLimit as jest.MockedFunction<typeof applyRateLimit>;
const turnstileConfigMock = getTurnstileConfig as jest.MockedFunction<typeof getTurnstileConfig>;
const verifyTurnstileMock = verifyTurnstileToken as jest.MockedFunction<typeof verifyTurnstileToken>;

const request = (body: unknown, referer?: string) =>
  new Request('http://localhost/api/jarvis/waitlist', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(referer ? { referer } : {}),
    },
    body: JSON.stringify(body),
  });

describe('POST /api/jarvis/waitlist', () => {
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

  it('accepts a valid signup with consent and does not return the email', async () => {
    joinMock.mockResolvedValue({ ok: true, signup: 'created' });
    const res = await POST(
      request({ email: 'ada@provvy.com', consent: true }, 'https://app.example/secret?token=abc') as never
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.message).toMatch(/waitlist/i);
    expect(JSON.stringify(json)).not.toContain('ada@provvy.com');
    expect(json).not.toHaveProperty('email');
    expect(json).not.toHaveProperty('signup');
    expect(json).not.toHaveProperty('created');
    expect(json).not.toHaveProperty('existing');
    expect(joinMock).toHaveBeenCalledWith({
      email: 'ada@provvy.com',
      consent: true,
    });
    expect(joinMock.mock.calls[0][0]).not.toHaveProperty('referrer');
  });

  it('rejects missing consent without persisting', async () => {
    const res = await POST(request({ email: 'ada@provvy.com' }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/privacy policy/i);
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('rejects invalid emails without calling persistence', async () => {
    const res = await POST(request({ email: 'nope', consent: true }) as never);
    expect(res.status).toBe(400);
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('returns the same success payload for new and duplicate signups', async () => {
    joinMock
      .mockResolvedValueOnce({ ok: true, signup: 'created' })
      .mockResolvedValueOnce({ ok: true, signup: 'existing' });
    const first = await POST(request({ email: 'ada@provvy.com', consent: true }) as never);
    const second = await POST(request({ email: 'ada@provvy.com', consent: true }) as never);
    const firstJson = await first.json();
    const secondJson = await second.json();
    expect(firstJson).toEqual(secondJson);
    expect(firstJson).not.toHaveProperty('alreadyJoined');
    expect(JSON.stringify(firstJson)).not.toContain('ada@provvy.com');
  });

  it('requires Turnstile when the existing mechanism is enabled', async () => {
    turnstileConfigMock.mockReturnValue({
      enabled: true,
      siteKey: 'site',
      requiredForSignup: true,
      requiredForLogin: false,
      requiredForPasswordReset: false,
      failureThreshold: 3,
    });
    verifyTurnstileMock.mockResolvedValue(false);
    const res = await POST(request({ email: 'ada@provvy.com', consent: true }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).turnstileRequired).toBe(true);
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
});
