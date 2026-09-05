/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('introduces itself from the side as an observer, not a chat prompt', () => {
    render(
      <RenderWithAdvisor>
        <div />
      </RenderWithAdvisor>
    );
    const advisor = screen.getByLabelText('Provvy Advisor');
    expect(advisor).toHaveAttribute('data-advisor-placement', 'alongside');
    expect(screen.getByText(/Hi, I'm Provvy/i)).toBeInTheDocument();
    expect(screen.getByText(/Watching payment infrastructure/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Tell me what you're trying to pay below and I'll show you the routes available/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The more I know about your business, the smarter my recommendations become/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Light' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dark' })).not.toBeInTheDocument();
    expect(advisor.querySelector('input, textarea')).toBeNull();
  });

  it('does not ask for theme when a preference is already saved', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <RenderWithAdvisor>
        <div />
      </RenderWithAdvisor>
    );
    expect(screen.getByText(/Hi, I'm Provvy/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dark' })).not.toBeInTheDocument();
  });

  it('persists dismiss and can be reopened from the compact control', () => {
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

  it('after compare, stays alongside results and leads with connect, not another route card', () => {
    render(
      <RenderWithAdvisor>
        <LandingPaymentSearch />
      </RenderWithAdvisor>
    );

    fireEvent.click(screen.getByRole('button', { name: /compare routes/i }));
    const advisor = screen.getByLabelText('Provvy Advisor');
    expect(advisor).toHaveAttribute('data-advisor-placement', 'alongside');
    expect(document.getElementById('landing-advisor-slot')).toBeNull();
    expect(screen.getByText(/Based on your current criteria/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Current payment criteria')).toHaveTextContent('Australia → Indonesia');
    expect(screen.getByLabelText('Current payment criteria')).toHaveTextContent('Supplier payment');
    expect(screen.getByLabelText('Current payment criteria')).toHaveTextContent('Lowest total cost');
    expect(
      within(advisor).getByText(/You're comparing a .* supplier payment from Australia to Indonesia/i)
    ).toBeInTheDocument();
    expect(
      within(advisor).getByText(/These results are based on the transaction details you've given me/i)
    ).toBeInTheDocument();
    expect(within(advisor).getByRole('link', { name: /connect your business/i })).toHaveAttribute(
      'href',
      '/journey/assessment'
    );
    expect(within(advisor).getByRole('button', { name: 'See how Provvy works' })).toBeInTheDocument();
    expect(within(advisor).getByRole('link', { name: /get payment intelligence/i })).toHaveAttribute(
      'href',
      '#payment-intelligence-inbox'
    );
    expect(within(advisor).getByRole('button', { name: 'Why is this #1?' })).toBeInTheDocument();
    expect(advisor.querySelector('input, textarea')).toBeNull();

    fireEvent.click(within(advisor).getByRole('button', { name: 'See how Provvy works' }));
    expect(within(advisor).getByText(/extra pair of hands/i)).toBeInTheDocument();

    fireEvent.click(within(advisor).getByRole('button', { name: 'Why is this #1?' }));
    expect(screen.getByText(/Typical estimated total:/i)).toBeInTheDocument();
    expect(screen.getByText(/Typical arrival:/i)).toBeInTheDocument();
    expect(screen.getByText(/not live quotes/i)).toBeInTheDocument();

    fireEvent.click(within(advisor).getByRole('button', { name: "What's faster?" }));
    expect(screen.getByText(/Recommendation changed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Digital-dollar transfer is now the strongest starting point because speed is your priority/i)
    ).toBeInTheDocument();
    expect(within(advisor).getByRole('button', { name: 'What is digital-dollar?' })).toBeInTheDocument();

    fireEvent.click(within(advisor).getByRole('button', { name: 'What is digital-dollar?' }));
    expect(screen.getByText(/compatible wallets or accounts/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /routes that don't require this/i }));
    expect(
      screen.getByText(/routes that don't require a digital-dollar setup/i)
    ).toBeInTheDocument();

    fireEvent.click(within(advisor).getByRole('button', { name: "What's simpler?" }));
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
    expect(screen.getByText(/payment routes match your filters/i)).toBeInTheDocument();
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
