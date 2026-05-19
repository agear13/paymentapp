/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { MerchantBranding } from '@/components/public/merchant-branding';

describe('MerchantBranding', () => {
  it('renders initials when no logo is provided', () => {
    render(<MerchantBranding merchantName="Beach Club Operations" logoUrl={null} />);
    expect(screen.getByText('BC')).toBeInTheDocument();
    expect(screen.getByText('Beach Club Operations')).toBeInTheDocument();
  });

  it('falls back to initials when logo image fails to load', () => {
    render(
      <MerchantBranding
        merchantName="Beach Club Operations"
        logoUrl="https://example.com/broken-logo.png"
      />
    );

    const image = screen.getByRole('img', { name: 'Beach Club Operations logo' });
    fireEvent.error(image);

    expect(screen.getByText('BC')).toBeInTheDocument();
  });
});
