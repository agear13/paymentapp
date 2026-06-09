import {
  CONTENT_SECURITY_POLICY,
  CONTENT_SECURITY_POLICY_PRODUCTION,
  buildContentSecurityPolicy,
} from '@/lib/security/content-security-policy';

describe('Content-Security-Policy', () => {
  it('blocks object injection and frame embedding', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });

  it('allows Stripe checkout and Elements', () => {
    expect(CONTENT_SECURITY_POLICY).toContain('https://js.stripe.com');
    expect(CONTENT_SECURITY_POLICY).toContain('https://checkout.stripe.com');
    expect(CONTENT_SECURITY_POLICY).toContain('https://api.stripe.com');
  });

  it('allows Supabase auth and realtime', () => {
    expect(CONTENT_SECURITY_POLICY).toContain('https://*.supabase.co');
    expect(CONTENT_SECURITY_POLICY).toContain('wss://*.supabase.co');
  });

  it('buildContentSecurityPolicy is stable', () => {
    expect(buildContentSecurityPolicy()).toBe(CONTENT_SECURITY_POLICY);
  });

  it('production CSP removes unsafe-eval', () => {
    expect(CONTENT_SECURITY_POLICY_PRODUCTION).not.toContain("'unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY_PRODUCTION).toContain("'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY_PRODUCTION).toContain('https://js.stripe.com');
  });

  it('development CSP retains unsafe-eval for Next.js HMR', () => {
    const devPolicy = buildContentSecurityPolicy({ isDevelopment: true });
    expect(devPolicy).toContain("'unsafe-eval'");
  });
});
