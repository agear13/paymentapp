import { buildMerchantBrandingEmailMarkup } from '@/lib/branding/merchant-branding-email';

describe('buildMerchantBrandingEmailMarkup', () => {
  it('renders logo image for absolute https URLs', () => {
    const html = buildMerchantBrandingEmailMarkup({
      merchantName: 'Beach Club',
      logoUrl: 'https://cdn.example.com/logo.png',
      initials: 'BC',
    });

    expect(html).toContain('src="https://cdn.example.com/logo.png"');
    expect(html).toContain('alt="Beach Club logo"');
    expect(html).toContain('max-height:56px');
  });

  it('renders initials avatar when logo is missing', () => {
    const html = buildMerchantBrandingEmailMarkup({
      merchantName: 'Beach Club Operations',
      logoUrl: null,
      initials: 'BC',
    });

    expect(html).toContain('>BC<');
    expect(html).not.toContain('<img');
  });

  it('renders initials avatar for non-absolute logo URLs', () => {
    const html = buildMerchantBrandingEmailMarkup({
      merchantName: 'Beach Club',
      logoUrl: '/uploads/logos/org.png',
      initials: 'BC',
    });

    expect(html).toContain('>BC<');
    expect(html).not.toContain('<img');
  });
});
