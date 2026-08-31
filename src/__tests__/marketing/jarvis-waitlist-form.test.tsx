/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { JarvisWaitlistForm } from '@/components/jarvis/jarvis-waitlist-form';

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
  JARVIS_GA_EVENTS: {
    landingView: 'jarvis_landing_view',
    waitlistStarted: 'jarvis_waitlist_started',
    waitlistSubmitted: 'jarvis_waitlist_submitted',
    waitlistSuccess: 'jarvis_waitlist_success',
    exploreProvvyClicked: 'jarvis_explore_provvy_clicked',
  },
  trackGaEvent: jest.fn(),
}));

const { trackGaEvent } = jest.requireMock('@/lib/analytics/track-ga-event') as {
  trackGaEvent: jest.Mock;
};

describe('JarvisWaitlistForm', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    trackGaEvent.mockClear();
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
        json: async () => ({ ok: true, message: "You're on the Jarvis waitlist. We'll be in touch." }),
      } as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects submit without consent and does not call the waitlist API', async () => {
    render(<JarvisWaitlistForm />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'ada@provvy.com' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /join the jarvis waitlist/i }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(/privacy policy/i);
    expect(
      (global.fetch as jest.Mock).mock.calls.some((call) => String(call[0]).includes('/api/jarvis/waitlist'))
    ).toBe(false);
  });

  it('submits email and consent without sending a referer field', async () => {
    render(<JarvisWaitlistForm />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'ada@provvy.com' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /i agree to provvy's privacy policy and to being contacted about the jarvis early-access program/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /join the jarvis waitlist/i }));

    await waitFor(() => {
      const waitlistCall = (global.fetch as jest.Mock).mock.calls.find((call) =>
        String(call[0]).includes('/api/jarvis/waitlist')
      );
      expect(waitlistCall).toBeDefined();
      const body = JSON.parse(waitlistCall[1].body as string);
      expect(body).toEqual({ email: 'ada@provvy.com', consent: true });
      expect(body).not.toHaveProperty('referrer');
      expect(body).not.toHaveProperty('referer');
    });
  });

  it('does not include PII in Jarvis GA events', async () => {
    render(<JarvisWaitlistForm />);
    fireEvent.focus(screen.getByLabelText(/email address/i));
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'ada@provvy.com' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /i agree to provvy's privacy policy and to being contacted about the jarvis early-access program/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /join the jarvis waitlist/i }));

    await waitFor(() => {
      expect(trackGaEvent).toHaveBeenCalledWith('jarvis_waitlist_success');
    });
    expect(trackGaEvent.mock.calls).toEqual([
      ['jarvis_waitlist_started'],
      ['jarvis_waitlist_submitted'],
      ['jarvis_waitlist_success'],
    ]);
    expect(JSON.stringify(trackGaEvent.mock.calls)).not.toContain('ada@provvy.com');
  });

  it('shows Explore Provvy after signup without exposing the email', async () => {
    render(<JarvisWaitlistForm />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'ada@provvy.com' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /i agree to provvy's privacy policy and to being contacted about the jarvis early-access program/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /join the jarvis waitlist/i }));

    expect(await screen.findByRole('link', { name: /explore provvy/i })).toHaveAttribute(
      'href',
      '/journey'
    );
    expect(screen.getByText(/we'll let you know when jarvis early access opens/i)).toBeInTheDocument();
    expect(screen.queryByText('ada@provvy.com')).not.toBeInTheDocument();
  });
});
