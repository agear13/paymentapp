/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { JarvisPage } from '@/components/jarvis/jarvis-page';

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

jest.mock('next/image', () => {
  return function MockImage({ alt }: { alt: string }) {
    return <img alt={alt} />;
  };
});

describe('JarvisPage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, siteKey: null }),
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('frames Jarvis as a future waitlist capability', () => {
    render(<JarvisPage />);
    expect(screen.getAllByText(/waitlist/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/not generally available yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/examples of the intended future experience/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /meet jarvis for your business/i })).toBeInTheDocument();
    expect(document.querySelector('.jarvis-demo-engine')).not.toBeNull();
    expect(document.querySelector('.jarvis-demo-engine')).toHaveAttribute(
      'data-execution',
      'simulated'
    );
    expect(document.querySelector('.jarvis-demo-engine')).toHaveAttribute(
      'data-hero-scenario',
      'invoice-execution'
    );
    expect(screen.getByRole('link', { name: /explore what provvy can do today/i })).toHaveAttribute(
      'href',
      '/journey'
    );
  });

  it('requires an explicit privacy consent checkbox with the existing Privacy Policy link', () => {
    render(<JarvisPage />);
    const consent = screen.getAllByRole('checkbox', {
      name: /i agree to provvy's privacy policy and to being contacted about the jarvis early-access program/i,
    })[0];
    expect(consent).toBeRequired();
    expect(consent).not.toBeChecked();
    const privacyLinks = screen.getAllByRole('link', { name: /privacy policy/i });
    expect(privacyLinks.some((link) => link.getAttribute('href') === '/privacy')).toBe(true);
  });
});
