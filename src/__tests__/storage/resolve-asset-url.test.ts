import { resolveAssetUrl } from '@/lib/storage/resolve-asset-url';

describe('resolveAssetUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.R2_PUBLIC_URL = 'https://assets.example.com';
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns absolute URLs directly', () => {
    const result = resolveAssetUrl({
      source: 'https://cdn.example.com/logo.png',
      category: 'merchant-logos',
    });
    expect(result.url).toBe('https://cdn.example.com/logo.png');
    expect(result.resolvedFrom).toBe('absolute');
  });

  it('resolves merchant logo storage keys to the production custom domain', () => {
    process.env.R2_PUBLIC_URL = 'https://assets.provvypay.com';
    process.env.R2_ACCOUNT_ID = '81ba3ac215bbde6352beec7e6ef28841';
    process.env.R2_ACCESS_KEY_ID = 'access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
    process.env.R2_BUCKET_NAME = 'provvypay-assets';

    const result = resolveAssetUrl({
      source: 'merchant-logos/org-123/abc.png',
      category: 'merchant-logos',
    });
    expect(result.url).toBe('https://assets.provvypay.com/merchant-logos/org-123/abc.png');
    expect(result.resolvedFrom).toBe('public_base');
  });

  it('resolves R2 storage keys against public base URL', () => {
    const result = resolveAssetUrl({
      source: 'merchant-logos/org-123/abc.png',
      category: 'merchant-logos',
    });
    expect(result.url).toBe('https://assets.example.com/merchant-logos/org-123/abc.png');
    expect(result.resolvedFrom).toBe('public_base');
  });

  it('uses CDN URL when configured', () => {
    process.env.ASSET_CDN_URL = 'https://cdn.example.com';
    const result = resolveAssetUrl({
      source: 'merchant-logos/org-123/abc.png',
      category: 'merchant-logos',
    });
    expect(result.url).toBe('https://cdn.example.com/merchant-logos/org-123/abc.png');
    expect(result.resolvedFrom).toBe('cdn');
  });

  it('returns proxy path for private assets', () => {
    const result = resolveAssetUrl({
      source: 'invoice-attachments/org/inv/file.pdf',
      category: 'invoice-attachments',
      visibility: 'private',
      proxyPath: '/api/public/pay/abc/attachment',
    });
    expect(result.url).toBe('/api/public/pay/abc/attachment');
    expect(result.resolvedFrom).toBe('proxy');
  });

  it('blocks localhost absolute URLs in production', () => {
    process.env.NODE_ENV = 'production';
    const result = resolveAssetUrl({
      source: 'http://localhost:3000/uploads/logos/a.png',
      category: 'merchant-logos',
    });
    expect(result.url).toBeNull();
  });
});
