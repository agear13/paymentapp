/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ReferralManagementLandingPage } from '@/components/journey/lovable/referral-management-landing-page';
import {
  REFERRAL_LANDING_FAQS,
  REFERRAL_LANDING_TRIAL_CTA_HREF,
} from '@/lib/journey/referral-management-landing';

jest.mock('@/hooks/use-provvy-theme', () => ({
  useProvvyTheme: () => ({ dark: true, toggle: jest.fn(), setTheme: jest.fn() }),
}));

describe('ReferralManagementLandingPage', () => {
  it('renders the acquisition narrative and existing trial CTAs', () => {
    render(<ReferralManagementLandingPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Referral management without the spreadsheet.',
      })
    ).toBeInTheDocument();

    const trialLinks = screen.getAllByRole('link', { name: /Start your 30-day free trial/i });
    expect(trialLinks.length).toBeGreaterThanOrEqual(3);
    for (const link of trialLinks) {
      expect(link).toHaveAttribute('href', REFERRAL_LANDING_TRIAL_CTA_HREF);
    }

    expect(screen.getAllByRole('link', { name: 'See how it works' })[0]).toHaveAttribute(
      'href',
      '#how-it-works'
    );
    expect(screen.getByRole('link', { name: /Compare payout routes/i })).toHaveAttribute(
      'href',
      '/journey#compare'
    );
    expect(screen.getAllByText('30 days free · Professional package').length).toBeGreaterThan(0);
    expect(screen.getByText('Referral management included')).toBeInTheDocument();
  });

  it('shows a marketing-safe example of real referral fields and live business workflows', () => {
    render(<ReferralManagementLandingPage />);

    expect(screen.getByText('Example program')).toBeInTheDocument();
    expect(screen.getByText('Summer Referral Program')).toBeInTheDocument();
    expect(screen.getByText('provvy.com/r/danielle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Weso: Referral management' })).toHaveAttribute(
      'href',
      '/journey/workflows/referral-management'
    );
    expect(
      screen.getByRole('link', { name: 'Thirsty Turtl: Affiliate & creator programs' })
    ).toHaveAttribute('href', '/journey/workflows/referral-management');
    expect(screen.getByRole('link', { name: 'The Collective: Partner payments' })).toHaveAttribute(
      'href',
      '/journey/workflows/revenue-sharing'
    );
    expect(screen.queryByText(/trusted by/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/testimonial/i)).not.toBeInTheDocument();
  });

  it('keeps the existing site navigation and does not mount Provvy Advisor', () => {
    const { container } = render(<ReferralManagementLandingPage />);

    expect(screen.getAllByRole('link', { name: 'Explore' })[0]).toHaveAttribute(
      'href',
      '/journey#compare'
    );
    expect(screen.getAllByRole('link', { name: 'Provvy Labs' })[0]).toHaveAttribute('href', '/labs');
    expect(screen.getAllByRole('link', { name: /Compare routes/i })[0]).toHaveAttribute(
      'href',
      '/journey#compare'
    );
    expect(container.querySelector('[class*="landing-advisor"]')).toBeNull();
    expect(screen.queryByText("Hi, I'm Provvy.")).not.toBeInTheDocument();
  });

  it('answers the SEO FAQ set in visible copy', () => {
    render(<ReferralManagementLandingPage />);

    for (const item of REFERRAL_LANDING_FAQS) {
      expect(screen.getByRole('heading', { name: item.question })).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });
});
