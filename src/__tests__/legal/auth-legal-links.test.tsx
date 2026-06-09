/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import {
  AuthLegalFooterLinks,
  AuthMobileLegalLinks,
  AuthSignupLegalNotice,
} from '@/components/legal/auth-legal-links';
import {
  PROVVYPAY_PRIVACY_PATH,
  PROVVYPAY_TERMS_PATH,
} from '@/lib/legal/provvypay-legal-paths';

describe('Provvypay legal paths', () => {
  it('uses on-domain routes for terms and privacy', () => {
    expect(PROVVYPAY_TERMS_PATH).toBe('/terms');
    expect(PROVVYPAY_PRIVACY_PATH).toBe('/privacy');
    expect(PROVVYPAY_TERMS_PATH.startsWith('/')).toBe(true);
    expect(PROVVYPAY_PRIVACY_PATH.startsWith('/')).toBe(true);
    expect(PROVVYPAY_TERMS_PATH.includes('clerk')).toBe(false);
    expect(PROVVYPAY_PRIVACY_PATH.includes('clerk')).toBe(false);
  });
});

describe('AuthLegalFooterLinks', () => {
  it('links to Provvypay terms and privacy pages', () => {
    render(<AuthLegalFooterLinks />);

    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', PROVVYPAY_TERMS_PATH);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      PROVVYPAY_PRIVACY_PATH
    );
  });
});

describe('AuthMobileLegalLinks', () => {
  it('links to Provvypay terms and privacy pages', () => {
    render(<AuthMobileLegalLinks />);

    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', PROVVYPAY_TERMS_PATH);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      PROVVYPAY_PRIVACY_PATH
    );
  });
});

describe('AuthSignupLegalNotice', () => {
  it('links signup agreement copy to Provvypay legal pages', () => {
    render(<AuthSignupLegalNotice />);

    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      PROVVYPAY_TERMS_PATH
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      PROVVYPAY_PRIVACY_PATH
    );
    expect(screen.getByText(/By creating an account, you agree to our/i)).toBeInTheDocument();
  });
});
