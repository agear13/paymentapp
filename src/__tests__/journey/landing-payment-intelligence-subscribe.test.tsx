/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LandingAdvisorProvider } from '@/components/journey/lovable/landing-advisor-context';
import { LandingIntelligenceProvider } from '@/components/journey/lovable/landing-intelligence-context';
import { LandingPaymentIntelligenceSubscribe } from '@/components/journey/lovable/landing-payment-intelligence-subscribe';
import { LandingPaymentSearch } from '@/components/journey/lovable/landing-payment-search';

jest.mock('next/link', () => {
  return function MockLink({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/lib/analytics/track-ga-event', () => ({
  trackGaEvent: jest.fn(),
}));

function installDomMocks() {
  if (!window.PointerEvent) {
    class MockPointerEvent extends MouseEvent {}
    window.PointerEvent = MockPointerEvent as typeof PointerEvent;
  }
  HTMLElement.prototype.hasPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
  HTMLElement.prototype.scrollIntoView = jest.fn();
}

function RenderSubscribe({ children }: { children?: ReactNode }) {
  return (
    <LandingAdvisorProvider>
      <LandingIntelligenceProvider>
        {children}
        <LandingPaymentIntelligenceSubscribe />
      </LandingIntelligenceProvider>
    </LandingAdvisorProvider>
  );
}

describe('LandingPaymentIntelligenceSubscribe', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    installDomMocks();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/turnstile-config')) {
        return {
          ok: true,
          json: async () => ({ enabled: false, siteKey: null }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ ok: true, message: "You're on the Payment Intelligence list." }),
      } as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('offers Payment Intelligence after the public surfaces, not a newsletter', () => {
    render(<RenderSubscribe />);
    expect(
      screen.getByRole('heading', { name: /Payment Intelligence, in your inbox/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Payment rail updates/i)).toBeInTheDocument();
    expect(screen.getByText(/Routes to consider/i)).toBeInTheDocument();
    expect(screen.getByText(/Regulatory changes/i)).toBeInTheDocument();
    expect(screen.getByText(/Business impact/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your work email')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Get Payment Intelligence/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/newsletter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fintech news/i)).not.toBeInTheDocument();
  });

  it('uses the compared corridor without claiming personalised intelligence', () => {
    render(
      <RenderSubscribe>
        <LandingPaymentSearch />
      </RenderSubscribe>
    );
    fireEvent.click(screen.getByRole('button', { name: /compare routes/i }));
    expect(
      screen.getByRole('heading', {
        name: /Want payment intelligence for Australia → Indonesia/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Get relevant rail changes, alternative routes and regulatory developments in your inbox/i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/personalised to your business/i)).not.toBeInTheDocument();
  });

  it('submits the work email and shows an honest recorded-list result', async () => {
    render(<RenderSubscribe />);
    fireEvent.change(screen.getByLabelText('Your work email'), {
      target: { value: 'ada@provvy.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Get Payment Intelligence/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /You're on the Payment Intelligence list/i
      );
    });

    const subscribeCall = (global.fetch as jest.Mock).mock.calls.find((call) =>
      String(call[0]).includes('/api/payment-intelligence/subscribe')
    );
    expect(subscribeCall).toBeDefined();
    const body = JSON.parse(subscribeCall[1].body as string);
    expect(body).toEqual({
      email: 'ada@provvy.com',
      consent: true,
      compared: false,
    });
    expect(body).not.toHaveProperty('referrer');
  });

  it('shows an honest error when the request cannot be saved', async () => {
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/turnstile-config')) {
        return {
          ok: true,
          json: async () => ({ enabled: false, siteKey: null }),
        } as Response;
      }
      return {
        ok: false,
        json: async () => ({ error: "We couldn't save that just now. Please try again." }),
      } as Response;
    }) as typeof fetch;

    render(<RenderSubscribe />);
    fireEvent.change(screen.getByLabelText('Your work email'), {
      target: { value: 'ada@provvy.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Get Payment Intelligence/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save that just now/i);
  });
});
