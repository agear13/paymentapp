import {
  merchantInitials,
  resolveMerchantBranding,
  resolveMerchantLogoUrl,
} from '@/lib/branding/resolve-merchant-branding';

describe('resolveMerchantBranding', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_INFRASTRUCTURE_DOMAINS = 'true';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns initials fallback when logo is missing', () => {
    const result = resolveMerchantBranding({
      merchantName: 'Beach Club Operations',
      logoSource: null,
      requestOrigin: 'https://provvypay-api.onrender.com',
    });

    expect(result.logoUrl).toBeNull();
    expect(result.initials).toBe('BC');
    expect(result.usedFallback).toBe(true);
    expect(result.fallbackReason).toBe('missing_logo');
  });

  it('uses absolute logo URLs directly', () => {
    const result = resolveMerchantBranding({
      merchantName: 'Beach Club',
      logoSource: 'https://cdn.example.com/logo.png',
      requestOrigin: 'https://provvypay-api.onrender.com',
    });

    expect(result.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(result.resolvedFrom).toBe('absolute');
    expect(result.usedFallback).toBe(false);
  });

  it('resolves relative upload paths against Render staging origin', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const result = resolveMerchantBranding({
      merchantName: 'Beach Club',
      logoSource: '/uploads/logos/org-123.png',
      requestOrigin: 'https://provvypay-api.onrender.com',
    });

    expect(result.logoUrl).toBe('https://provvypay-api.onrender.com/uploads/logos/org-123.png');
    expect(result.resolvedFrom).toBe('relative');
  });

  it('resolves relative paths against production branded domain from env', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://pay.example.com';

    const result = resolveMerchantBranding({
      merchantName: 'Beach Club',
      logoSource: '/uploads/logos/org-123.png',
      requestOrigin: 'https://provvypay-api.onrender.com',
    });

    expect(result.logoUrl).toBe('https://pay.example.com/uploads/logos/org-123.png');
  });

  it('handles upload paths without leading slash', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const result = resolveMerchantBranding({
      merchantName: 'Beach Club',
      logoSource: 'uploads/logos/org-123.png',
      requestOrigin: 'https://provvypay-api.onrender.com',
    });

    expect(result.logoUrl).toBe('https://provvypay-api.onrender.com/uploads/logos/org-123.png');
  });

  it('falls back for malformed absolute URLs', () => {
    const result = resolveMerchantBranding({
      merchantName: 'Beach Club',
      logoSource: 'http://',
      requestOrigin: 'https://provvypay-api.onrender.com',
    });

    expect(result.logoUrl).toBeNull();
    expect(result.fallbackReason).toBe('malformed_url');
  });

  it('falls back when origin cannot be resolved in production', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.ALLOW_INFRASTRUCTURE_DOMAINS;

    const result = resolveMerchantBranding({
      merchantName: 'Beach Club',
      logoSource: '/uploads/logos/org-123.png',
      requestOrigin: 'https://provvypay-api.onrender.com',
    });

    expect(result.logoUrl).toBeNull();
    expect(result.fallbackReason).toBe('unresolvable_origin');
  });

  it('resolveMerchantLogoUrl remains backward compatible', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://pay.example.com';

    expect(resolveMerchantLogoUrl('/uploads/logos/a.png', 'https://ignored.example.com')).toBe(
      'https://pay.example.com/uploads/logos/a.png'
    );
  });

  it('merchantInitials handles single and multi-word names', () => {
    expect(merchantInitials('Beach Club Operations')).toBe('BC');
    expect(merchantInitials('Acme')).toBe('AC');
    expect(merchantInitials('')).toBe('?');
  });
});
