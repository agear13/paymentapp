import {
  buildCustomerFacingUrl,
  evaluateCustomerFacingDomain,
  getBrandedAppOrigin,
  getBrandedAppOriginSafe,
  getClientBrandedOrigin,
  getPublicAppUrl,
  getPaymentLinkUrl,
  isInfrastructureDomainAllowed,
  isInvalidCustomerHost,
  isTrustedForwardedOriginEnvironment,
  resolveCanonicalPublicOrigin,
  resolveConfiguredPublicOrigin,
  resolveCustomerFacingOrigin,
  resolveParticipantAuthOrigin,
  resolveParticipantLinkOrigin,
  resolveRequestOrigin,
  validateCustomerFacingConfiguration,
} from '@/lib/runtime/customer-facing-url';

describe('customer-facing URL resolver', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALLOW_INFRASTRUCTURE_DOMAINS;
    delete process.env.RENDER;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.RENDER_EXTERNAL_HOSTNAME;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.TRUST_PROXY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses localhost only in development when env is missing', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getPaymentLinkUrl('Avn7eLPc')).toBe('http://localhost:3000/pay/Avn7eLPc');
  });

  it('uses NEXT_PUBLIC_APP_URL in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://pay.example.com/';

    expect(getPaymentLinkUrl('Avn7eLPc')).toBe('https://pay.example.com/pay/Avn7eLPc');
  });

  it('never leaks localhost in production when env is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getClientBrandedOrigin('https://provvypay-api.onrender.com')).toBe('');
    expect(() => getPaymentLinkUrl('Avn7eLPc')).toThrow(
      /Customer-facing domain is not configured correctly/i
    );
  });

  it('getPublicAppUrl and getBrandedAppOriginSafe never throw in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getBrandedAppOriginSafe()).toBeNull();
    expect(getPublicAppUrl()).toBe('');
    expect(getPublicAppUrl('https://pay.example.com')).toBe('https://pay.example.com');
  });

  it('blocks onrender infrastructure hosts when override is disabled', () => {
    process.env.ALLOW_INFRASTRUCTURE_DOMAINS = 'false';
    expect(isInvalidCustomerHost('https://provvypay-api.onrender.com')).toBe(true);
    expect(isInvalidCustomerHost('https://pay.example.com')).toBe(false);
  });

  it('allows onrender in production when ALLOW_INFRASTRUCTURE_DOMAINS=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_INFRASTRUCTURE_DOMAINS = 'true';
    delete process.env.NEXT_PUBLIC_APP_URL;

    const resolution = resolveCustomerFacingOrigin({
      requestOrigin: 'https://provvypay-api.onrender.com',
    });

    expect(resolution).toMatchObject({
      configured: true,
      origin: 'https://provvypay-api.onrender.com',
      source: 'request',
      infrastructureOverride: true,
    });
    expect(getPaymentLinkUrl('Avn7eLPc', { requestOrigin: 'https://provvypay-api.onrender.com' })).toBe(
      'https://provvypay-api.onrender.com/pay/Avn7eLPc'
    );
  });

  it('allows onrender via NEXT_PUBLIC_APP_URL when override enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_INFRASTRUCTURE_DOMAINS = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://provvypay-api.onrender.com';

    expect(getPaymentLinkUrl('Avn7eLPc')).toBe('https://provvypay-api.onrender.com/pay/Avn7eLPc');
    expect(validateCustomerFacingConfiguration()).toEqual({
      ok: true,
      origin: 'https://provvypay-api.onrender.com',
      infrastructureOverride: true,
    });
  });

  it('still blocks localhost in production even with infrastructure override', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_INFRASTRUCTURE_DOMAINS = 'true';

    expect(isInvalidCustomerHost('http://localhost:3000')).toBe(true);
    expect(isInvalidCustomerHost('http://127.0.0.1:3000')).toBe(true);
    expect(
      evaluateCustomerFacingDomain('http://localhost:3000').reason
    ).toBe('loopback_blocked_in_production');
  });

  it('prefers env over request origin on server routes', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://pay.example.com';

    expect(
      buildCustomerFacingUrl('/pay/test', {
        requestOrigin: 'https://provvypay-api.onrender.com',
      })
    ).toBe('https://pay.example.com/pay/test');
  });

  it('uses valid request origin when env is missing in preview-like environments', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(
      buildCustomerFacingUrl('/pay/test', {
        requestOrigin: 'https://preview.example.com',
      })
    ).toBe('https://preview.example.com/pay/test');
  });

  it('reports misconfiguration in production without env or override', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.ALLOW_INFRASTRUCTURE_DOMAINS;

    const result = validateCustomerFacingConfiguration({
      requestOrigin: 'https://provvypay-api.onrender.com',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not configured correctly/i);
    expect(result.infrastructureOverride).toBe(false);
  });

  it('normalizes duplicate slashes in paths', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_APP_URL = 'https://pay.example.com/';

    expect(buildCustomerFacingUrl('//pay//abc123')).toBe('https://pay.example.com/pay/abc123');
  });

  it('getBrandedAppOrigin throws in production when unresolved', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(() => getBrandedAppOrigin('https://provvypay-api.onrender.com')).toThrow(
      /not configured correctly/i
    );
  });

  it('getBrandedAppOrigin accepts onrender with override', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_INFRASTRUCTURE_DOMAINS = 'true';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getBrandedAppOrigin('https://provvypay-api.onrender.com')).toBe(
      'https://provvypay-api.onrender.com'
    );
  });

  it('isInfrastructureDomainAllowed reads env exactly', () => {
    process.env.ALLOW_INFRASTRUCTURE_DOMAINS = 'true';
    expect(isInfrastructureDomainAllowed()).toBe(true);
    process.env.ALLOW_INFRASTRUCTURE_DOMAINS = '1';
    expect(isInfrastructureDomainAllowed()).toBe(false);
  });
});

function mockRequest(input: {
  origin: string;
  protocol?: string;
  headers?: Record<string, string>;
}) {
  const headers = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    nextUrl: { origin: input.origin, protocol: input.protocol ?? 'https:' },
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

describe('canonical public origin for participant links', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALLOW_INFRASTRUCTURE_DOMAINS;
    delete process.env.RENDER;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.RENDER_EXTERNAL_HOSTNAME;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.TRUST_PROXY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses the trusted forwarded host on Render instead of localhost:10000', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.provvypay.com';

    const origin = resolveCanonicalPublicOrigin(
      mockRequest({
        origin: 'https://localhost:10000',
        headers: {
          host: 'localhost:10000',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'app.provvypay.com',
        },
      })
    );

    expect(origin).toBe('https://app.provvypay.com');
    expect(origin).not.toMatch(/localhost/i);
  });

  it('prefers the current preview origin over production NEXT_PUBLIC_APP_URL', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.provvypay.com';

    expect(
      resolveCanonicalPublicOrigin(
        mockRequest({
          origin: 'https://localhost:10000',
          headers: {
            host: 'localhost:10000',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'staging.provvypay.com',
          },
        })
      )
    ).toBe('https://staging.provvypay.com');
  });

  it('falls back to NEXT_PUBLIC_APP_URL when the request origin is Render loopback', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.provvypay.com';

    expect(
      resolveCanonicalPublicOrigin(
        mockRequest({
          origin: 'https://localhost:10000',
          headers: { host: 'localhost:10000' },
        })
      )
    ).toBe('https://app.provvypay.com');
  });

  it('ignores spoofed forwarded-host headers outside a trusted proxy', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.provvypay.com';
    delete process.env.RENDER;
    delete process.env.VERCEL;

    expect(isTrustedForwardedOriginEnvironment()).toBe(false);
    expect(
      resolveRequestOrigin(
        mockRequest({
          origin: 'https://app.provvypay.com',
          headers: {
            host: 'app.provvypay.com',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'evil.example',
          },
        })
      )
    ).toBe('https://app.provvypay.com');
  });

  it('uses the local request origin in development, including port 10000', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(
      resolveCanonicalPublicOrigin(
        mockRequest({
          origin: 'http://localhost:10000',
          protocol: 'http:',
          headers: { host: 'localhost:10000' },
        })
      )
    ).toBe('http://localhost:10000');
  });

  it('uses RENDER_EXTERNAL_URL when request origin is loopback and env is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.RENDER_EXTERNAL_URL = 'https://provvy-preview.onrender.com';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(
      resolveCanonicalPublicOrigin(
        mockRequest({
          origin: 'https://localhost:10000',
          headers: { host: 'localhost:10000' },
        })
      )
    ).toBe('https://provvy-preview.onrender.com');
  });

  it('never returns localhost from configured origin in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://localhost:10000';
    process.env.RENDER_EXTERNAL_URL = 'https://app.provvypay.com';

    expect(resolveConfiguredPublicOrigin()).toBe('https://app.provvypay.com');
    expect(resolveParticipantLinkOrigin('https://localhost:10000')).toBe('https://app.provvypay.com');
  });
});

describe('participant auth origin for PKCE', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALLOW_INFRASTRUCTURE_DOMAINS;
    delete process.env.RENDER;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.RENDER_EXTERNAL_HOSTNAME;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.TRUST_PROXY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses the browser Origin when the internal host is localhost:10000 and forwarded host is onrender', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.provvypay.com';

    const origin = resolveParticipantAuthOrigin(
      mockRequest({
        origin: 'https://localhost:10000',
        headers: {
          host: 'localhost:10000',
          origin: 'https://www.provvypay.com',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'provvypay-api.onrender.com',
        },
      })
    );

    expect(origin).toBe('https://www.provvypay.com');
    expect(origin).not.toMatch(/localhost/i);
    expect(origin).not.toContain('onrender.com');
  });

  it('does not use an infrastructure forwarded host as the auth origin when a branded env is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.provvypay.com';

    expect(
      resolveParticipantAuthOrigin(
        mockRequest({
          origin: 'https://localhost:10000',
          headers: {
            host: 'localhost:10000',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'provvypay-api.onrender.com',
          },
        })
      )
    ).toBe('https://www.provvypay.com');
  });

  it('never generates a production participant auth origin on localhost', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.provvypay.com';

    const origin = resolveParticipantAuthOrigin(
      mockRequest({
        origin: 'https://localhost:10000',
        headers: { host: 'localhost:10000' },
      })
    );

    expect(origin).toBe('https://www.provvypay.com');
    expect(origin).not.toMatch(/localhost/i);
  });
});
