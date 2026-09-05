/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { toast } from 'sonner';
import {
  LANDING_THEME_HINT_DELAY_MS,
  LandingThemeHint,
} from '@/components/journey/lovable/landing-theme-hint';
import { THEME_HINT_STORAGE_KEY, THEME_STORAGE_KEY } from '@/lib/theme/provvy-theme';

jest.mock('sonner', () => {
  const toastFn = Object.assign(jest.fn(), { dismiss: jest.fn() });
  return { toast: toastFn };
});

const toastMock = toast as unknown as jest.Mock & { dismiss: jest.Mock };

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

describe('LandingThemeHint', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false);
    toastMock.mockClear();
    toastMock.dismiss.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not show again after it has been seen', () => {
    localStorage.setItem(THEME_HINT_STORAGE_KEY, '1');
    render(<LandingThemeHint />);
    act(() => {
      jest.advanceTimersByTime(LANDING_THEME_HINT_DELAY_MS + 100);
    });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('offers light mode when the saved preference is dark', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.classList.add('dark');
    render(<LandingThemeHint />);
    act(() => {
      jest.advanceTimersByTime(LANDING_THEME_HINT_DELAY_MS);
    });

    expect(toastMock).toHaveBeenCalledWith(
      'Prefer a lighter look?',
      expect.objectContaining({
        description: 'You can switch to light mode anytime.',
        closeButton: true,
        action: expect.objectContaining({ label: 'Switch to light' }),
      })
    );

    const options = toastMock.mock.calls[0][1] as { action: { onClick: () => void } };
    act(() => {
      options.action.onClick();
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(localStorage.getItem(THEME_HINT_STORAGE_KEY)).toBe('1');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('offers dark mode when the saved preference is light', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<LandingThemeHint />);
    act(() => {
      jest.advanceTimersByTime(LANDING_THEME_HINT_DELAY_MS);
    });

    expect(toastMock).toHaveBeenCalledWith(
      'Prefer a darker look?',
      expect.objectContaining({
        description: 'You can switch to dark mode anytime.',
        action: expect.objectContaining({ label: 'Switch to dark' }),
      })
    );
  });
});
