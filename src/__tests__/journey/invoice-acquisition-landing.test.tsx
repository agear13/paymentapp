/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { InvoiceAcquisitionPage } from '@/components/journey/lovable/invoice-acquisition-page';
import {
  INVOICE_LANDING_FAQS,
  INVOICE_LANDING_TRIAL_CTA_HREF,
} from '@/lib/journey/invoice-acquisition-landing';

jest.mock('@/hooks/use-provvy-theme', () => ({
  useProvvyTheme: () => ({ dark: true, toggle: jest.fn(), setTheme: jest.fn() }),
}));

describe('InvoiceAcquisitionPage', () => {
  it('renders the acquisition narrative and keeps download free of signup', () => {
    render(<InvoiceAcquisitionPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Create invoices for free/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Get paid smarter with Provvy.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Create an invoice free/i })[0]).toHaveAttribute(
      'href',
      '#invoice-creator'
    );
    expect(screen.getAllByRole('link', { name: 'See how it works' })[0]).toHaveAttribute(
      'href',
      '#how-it-works'
    );
    expect(screen.getByTestId('guest-invoice-download')).toBeInTheDocument();
    expect(screen.getByTestId('guest-invoice-payment-link')).toHaveAttribute(
      'href',
      INVOICE_LANDING_TRIAL_CTA_HREF
    );
    expect(screen.getByText(/Free forever · No account required to create or download/i)).toBeInTheDocument();
  });

  it('uses the existing Professional trial CTAs and Xero conversion path', () => {
    render(<InvoiceAcquisitionPage />);

    const trialLinks = screen.getAllByRole('link', { name: /Start your 30-day free trial/i });
    expect(trialLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of trialLinks) {
      expect(link).toHaveAttribute('href', INVOICE_LANDING_TRIAL_CTA_HREF);
    }
    expect(screen.getByRole('link', { name: /Connect Xero/i })).toHaveAttribute(
      'href',
      INVOICE_LANDING_TRIAL_CTA_HREF
    );
    expect(screen.getAllByText('30 days free · Professional package').length).toBeGreaterThan(0);
  });

  it('shows live workflow cards and existing business workflows', () => {
    render(<InvoiceAcquisitionPage />);

    expect(screen.getByRole('link', { name: /Revenue Sharing/i })).toHaveAttribute(
      'href',
      '/journey/workflows/revenue-sharing'
    );
    expect(screen.getByRole('link', { name: /Supplier Payments/i })).toHaveAttribute(
      'href',
      '/journey/workflows/supplier-payments'
    );
    expect(
      screen.getByRole('link', { name: /Autonomous Reconciliation/i })
    ).toHaveAttribute('href', '/journey/workflows/autonomous-reconciliation');
    expect(screen.getByRole('link', { name: 'The Collective: Partner payments' })).toHaveAttribute(
      'href',
      '/journey/workflows/revenue-sharing'
    );
    expect(screen.getByRole('link', { name: 'Weso: Referral management' })).toHaveAttribute(
      'href',
      '/journey/workflows/referral-management'
    );
    expect(
      screen.getByRole('link', { name: 'Thirsty Turtl: Affiliate & creator programs' })
    ).toHaveAttribute('href', '/journey/workflows/referral-management');
    expect(
      screen.getByRole('link', { name: 'EvolvH34: Web3 payment reconciliation' })
    ).toHaveAttribute('href', '/journey/workflows/autonomous-reconciliation');
    expect(screen.queryByText(/trusted by/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/testimonial/i)).not.toBeInTheDocument();
  });

  it('keeps the existing site navigation and does not mount the homepage Advisor popup', () => {
    const { container } = render(<InvoiceAcquisitionPage />);

    expect(screen.getAllByRole('link', { name: 'Explore' })[0]).toHaveAttribute(
      'href',
      '/journey#compare'
    );
    expect(screen.getAllByRole('link', { name: 'Provvy Labs' })[0]).toHaveAttribute('href', '/labs');
    expect(screen.queryByText("Hi, I'm Provvy.")).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-invoice-advisor')).not.toBeInTheDocument();
    expect(container.querySelector('.landing-advisor')).toBeNull();
  });

  it('lets a visitor switch into conversation mode without creating an account', () => {
    render(<InvoiceAcquisitionPage />);

    fireEvent.click(screen.getByRole('tab', { name: 'Paste conversation' }));
    expect(screen.getByTestId('conversation-invoice-paste-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use example conversation/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Log In/i })).toBeTruthy();
  });

  it('answers the FAQ set in visible copy', () => {
    render(<InvoiceAcquisitionPage />);

    for (const item of INVOICE_LANDING_FAQS) {
      expect(screen.getByRole('heading', { name: item.question })).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });
});
