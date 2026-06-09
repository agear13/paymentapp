/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { ProvvypayPrivacyDocument } from '@/components/legal/provvypay-privacy-document';
import { ProvvypayTermsDocument } from '@/components/legal/provvypay-terms-document';

describe('Provvypay legal documents', () => {
  it('renders terms of service content from Provvypay legal policy', () => {
    render(<ProvvypayTermsDocument />);

    expect(screen.getByRole('heading', { name: 'Provvypay Terms of Service' })).toBeInTheDocument();
    expect(screen.getAllByText('8 June 2026').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '1. Introduction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '16. Contact' })).toBeInTheDocument();
    expect(screen.getByText(/governed by the laws of Queensland, Australia/i)).toBeInTheDocument();
  });

  it('renders privacy policy content from Provvypay legal policy', () => {
    render(<ProvvypayPrivacyDocument />);

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getAllByText('8 June 2026').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '1. Introduction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '14. Contact' })).toBeInTheDocument();
    expect(screen.getByText(/We do not sell personal information/i)).toBeInTheDocument();
  });
});
