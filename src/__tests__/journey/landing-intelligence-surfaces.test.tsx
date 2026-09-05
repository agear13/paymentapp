/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LandingAdvisor } from '@/components/journey/lovable/landing-advisor';
import { LandingAdvisorProvider } from '@/components/journey/lovable/landing-advisor-context';
import { LandingIntelligenceProvider } from '@/components/journey/lovable/landing-intelligence-context';
import { LandingPaymentIntelligence } from '@/components/journey/lovable/landing-payment-intelligence';
import { LandingPaymentSearch } from '@/components/journey/lovable/landing-payment-search';
import { THEME_STORAGE_KEY } from '@/lib/theme/provvy-theme';

function installDomMocks() {
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
      matches: query.includes('768'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

function RenderSurfaces({ children }: { children?: ReactNode }) {
  return (
    <LandingAdvisorProvider>
      <LandingIntelligenceProvider>
        <LandingPaymentSearch />
        <LandingPaymentIntelligence />
        {children}
        <LandingAdvisor />
      </LandingIntelligenceProvider>
    </LandingAdvisorProvider>
  );
}

describe('payment intelligence cross-surface interactions', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    installDomMocks();
  });

  it('connects a What Changed item to its impact, rails, Advisor, and existing compare', () => {
    render(<RenderSurfaces />);

    expect(screen.getByText(/Regulatory momentum/i)).toBeInTheDocument();
    expect(screen.getByText(/Regulatory uncertainty/i)).toBeInTheDocument();
    expect(screen.getByText(/Corridor expansion/i)).toBeInTheDocument();
    expect(screen.getByText(/Provider \/ bank adoption/i)).toBeInTheDocument();
    expect(screen.queryByText(/transaction volume/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/minutes ago/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /SWIFT: Corridor expansion/i }));

    const highlight = document.querySelector('[data-intelligence-highlight="swift-retail-framework-2026-03"]');
    expect(highlight).toBeTruthy();
    expect(highlight?.querySelector('[data-business-impact="swift-retail-framework-2026-03"]')).toBeTruthy();
    expect(within(highlight as HTMLElement).getByLabelText('Affected payment rails')).toBeInTheDocument();
    expect(within(highlight as HTMLElement).getByText(/For this corridor/i)).toBeInTheDocument();

    const advisor = screen.getByLabelText('Provvy Advisor');
    expect(advisor).toHaveTextContent(/Hi, I'm Provvy/i);
    expect(within(highlight as HTMLElement).getByRole('button', { name: 'Show me routes affected by this' })).toBeInTheDocument();

    fireEvent.click(within(highlight as HTMLElement).getByRole('button', { name: 'Show me routes affected by this' }));
    expect(screen.getByText(/payment routes match your filters/i)).toBeInTheDocument();
    expect(within(screen.getByLabelText('Provvy Advisor')).getByText(/You're comparing a/i)).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Provvy Advisor')).getByRole('link', { name: /connect your business/i })
    ).toBeInTheDocument();
  });

  it('keeps pulse corridor and search corridor aligned', () => {
    render(<RenderSurfaces />);

    fireEvent.change(screen.getByLabelText('To'), {
      target: { value: 'SG' },
    });
    expect(screen.getByLabelText('To')).toHaveValue('SG');
    expect(screen.getAllByText('Australia → Singapore').length).toBeGreaterThan(0);
  });
});
