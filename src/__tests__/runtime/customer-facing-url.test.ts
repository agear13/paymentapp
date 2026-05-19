import {
  buildCustomerFacingUrl,
  getBrandedAppOrigin,
  getClientBrandedOrigin,
  getPaymentLinkUrl,
  isInvalidCustomerHost,
  resolveCustomerFacingOrigin,
  validateCustomerFacingConfiguration,
} from '@/lib/runtime/customer-facing-url';

describe('customer-facing URL resolver', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
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

  it('blocks onrender infrastructure hosts for customer URLs', () => {
    expect(isInvalidCustomerHost('https://provvypay-api.onrender.com')).toBe(true);
    expect(isInvalidCustomerHost('https://pay.example.com')).toBe(false);
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

  it('validates production configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://pay.example.com';

    expect(validateCustomerFacingConfiguration()).toEqual({
      ok: true,
      origin: 'https://pay.example.com',
    });
  });

  it('reports misconfiguration in production without env', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_APP_URL;

    const result = validateCustomerFacingConfiguration();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not configured correctly/i);
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
});
