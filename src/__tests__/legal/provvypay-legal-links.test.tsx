/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import {
  ProvvypayLegalFooterLinks,
  ProvvypayLegalSubscriptionNotice,
} from '@/components/legal/provvypay-legal-links';
import {
  PROVVYPAY_PRIVACY_PATH,
  PROVVYPAY_TERMS_PATH,
} from '@/lib/legal/provvypay-legal-paths';

describe('ProvvypayLegalFooterLinks', () => {
  it('links footer entries to canonical legal routes', () => {
    render(<ProvvypayLegalFooterLinks />);

    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      PROVVYPAY_TERMS_PATH
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      PROVVYPAY_PRIVACY_PATH
    );
  });
});

describe('ProvvypayLegalSubscriptionNotice', () => {
  it('links billing and onboarding copy to canonical legal routes', () => {
    render(<ProvvypayLegalSubscriptionNotice />);

    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      PROVVYPAY_TERMS_PATH
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      PROVVYPAY_PRIVACY_PATH
    );
  });
});
