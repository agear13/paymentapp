/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LandingAdvisor } from '@/components/journey/lovable/landing-advisor';
import { LandingAdvisorProvider } from '@/components/journey/lovable/landing-advisor-context';
import { LandingIntelligenceProvider } from '@/components/journey/lovable/landing-intelligence-context';
import { LandingPaymentSearch } from '@/components/journey/lovable/landing-payment-search';
import { ADVISOR_INTRO_STORAGE_KEY } from '@/lib/journey/landing-advisor';
import { THEME_STORAGE_KEY } from '@/lib/theme/provvy-theme';

function installDomMocks(desktop = true) {
  if (!window.PointerEvent) {
    class MockPointerEvent extends MouseEvent {}
    window.PointerEvent = MockPointerEvent as typeof PointerEvent;
  }
  HTMLElement.prototype.hasPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
  HTMLElement.prototype.scrollIntoView = jest.fn();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: desktop && query.includes('768'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

function RenderWithAdvisor({ children }: { children: ReactNode }) {
  return (
    <LandingAdvisorProvider>
      <LandingIntelligenceProvider>
        {children}
        <LandingAdvisor />
      </LandingIntelligenceProvider>
    </LandingAdvisorProvider>
  );
}

describe('LandingAdvisor', () => {
  beforeEach(() => {
    localStorage.clear();
    installDomMocks(true);
  });

  it('introduces itself as an analyst, not a theme or chat prompt', () => {
    render(
      <RenderWithAdvisor>
        <div />
      </RenderWithAdvisor>
    );
    expect(screen.getByLabelText('Provvy Advisor')).toBeInTheDocument();
    expect(screen.getByText(/Ready to analyse a payment/i)).toBeInTheDocument();
    expect(screen.getByText(/interpret the routes against your criteria/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Light' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dark' })).not.toBeInTheDocument();
    expect(screen.queryByText(/lighter or darker/i)).not.toBeInTheDocument();
  });

  it('does not ask for theme when a preference is already saved', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <RenderWithAdvisor>
        <div />
      </RenderWithAdvisor>
    );
    expect(screen.getByText(/Ready to analyse a payment/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dark' })).not.toBeInTheDocument();
  });

  it('persists dismiss and can be reopened', () => {
    render(
      <RenderWithAdvisor>
        <div />
      </RenderWithAdvisor>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Advisor' }));
    expect(localStorage.getItem(ADVISOR_INTRO_STORAGE_KEY)).toBe('1');
    expect(screen.queryByLabelText('Provvy Advisor')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Provvy Advisor' }));
    expect(screen.getByLabelText('Provvy Advisor')).toBeInTheDocument();
  });

  it('explains the current recommendation after a search and updates with priority', () => {
    render(
      <RenderWithAdvisor>
        <LandingPaymentSearch />
      </RenderWithAdvisor>
    );

    fireEvent.click(screen.getByRole('button', { name: /compare routes/i }));
    expect(screen.getByText(/Based on your current criteria/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Current payment criteria')).toHaveTextContent('Australia → Indonesia');
    expect(screen.getByLabelText('Current payment criteria')).toHaveTextContent('Supplier payment');
    expect(screen.getByLabelText('Current payment criteria')).toHaveTextContent('Lowest total cost');
    expect(
      screen.getByText(/Wise is the strongest starting point for this payment based on what you've entered/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Why is this #1?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /personalise this answer/i })).toHaveAttribute(
      'href',
      '/journey/assessment'
    );
    expect(
      screen.getByText(/Connect your business so Provvy can consider your existing rails/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Provvy Advisor').querySelector('input, textarea')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Why is this #1?' }));
    expect(screen.getByText(/Typical estimated total:/i)).toBeInTheDocument();
    expect(screen.getByText(/Typical arrival:/i)).toBeInTheDocument();
    expect(screen.getByText(/not live quotes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "What's faster?" }));
    expect(screen.getByText(/Recommendation changed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Digital-dollar transfer is now the strongest starting point because speed is your priority/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What is digital-dollar?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'What is digital-dollar?' }));
    expect(screen.getByText(/compatible wallets or accounts/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /routes that don't require this/i }));
    expect(
      screen.getByText(/routes that don't require a digital-dollar setup/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "What's simpler?" }));
    expect(screen.getByText(/Recommendation changed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Your existing bank is now the strongest starting point because simplicity is your priority/i)
    ).toBeInTheDocument();
  });

  it('acknowledges a bank-transfer filter without covering the results heading', async () => {
    render(
      <RenderWithAdvisor>
        <LandingPaymentSearch />
      </RenderWithAdvisor>
    );

    fireEvent.click(screen.getByRole('button', { name: /compare routes/i }));
    fireEvent.click(screen.getByRole('button', { name: /payment method/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Bank transfer' }));
    expect(
      screen.getByText(/You've narrowed this to bank-transfer routes/i)
    ).toBeInTheDocument();
  });

  it('runs the existing compare when Show me is chosen before a highlight', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <RenderWithAdvisor>
        <LandingPaymentSearch />
      </RenderWithAdvisor>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(screen.getByText(/payment routes found/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Wise is the strongest starting point for this payment based on what you've entered/i)
    ).toBeInTheDocument();
  });

  it('starts collapsed on mobile', () => {
    installDomMocks(false);
    render(
      <RenderWithAdvisor>
        <div />
      </RenderWithAdvisor>
    );
    expect(screen.queryByLabelText('Provvy Advisor')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Provvy Advisor' })).toBeInTheDocument();
  });
});
