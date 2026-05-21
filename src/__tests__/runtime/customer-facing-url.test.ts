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
  resolveCustomerFacingOrigin,
  validateCustomerFacingConfiguration,
} from '@/lib/runtime/customer-facing-url';

describe('customer-facing URL resolver', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALLOW_INFRASTRUCTURE_DOMAINS;
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
