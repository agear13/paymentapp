/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import CookieConsent from '@/components/legal/CookieConsent';
import { JARVIS_RECORDING_PATH } from '@/lib/jarvis/jarvis-recording-mode';

const mockPathname = { current: '/jarvis' };

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname.current,
}));

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

describe('CookieConsent recording-mode isolation', () => {
  beforeEach(() => {
    mockPathname.current = '/jarvis';
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('still shows the banner on public /jarvis', () => {
    render(<CookieConsent />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('heading', { name: /we use cookies/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument();
  });

  it('hides the banner only on the non-production recording path', () => {
    mockPathname.current = JARVIS_RECORDING_PATH;
    render(<CookieConsent />);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('heading', { name: /we use cookies/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept all/i })).not.toBeInTheDocument();
  });
});
