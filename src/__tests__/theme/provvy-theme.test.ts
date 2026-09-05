/** @jest-environment jsdom */

import {
  applyTheme,
  hasExplicitThemePreference,
  hasSeenThemeHint,
  markThemeHintSeen,
  persistTheme,
  resolveTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_HINT_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from '@/lib/theme/provvy-theme';

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

describe('Provvy theme contract', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
    mockMatchMedia(false);
  });

  it('uses the stored theme key the authenticated app already persists', () => {
    expect(THEME_STORAGE_KEY).toBe('theme');
  });

  it('treats a stored dark value as dark even when the OS prefers light', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    mockMatchMedia(false);
    expect(resolveTheme()).toBe('dark');
  });

  it('treats a stored light value as light even when the OS prefers dark', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    mockMatchMedia(true);
    expect(resolveTheme()).toBe('light');
  });

  it('falls back to prefers-color-scheme when nothing is stored', () => {
    mockMatchMedia(true);
    expect(resolveTheme()).toBe('dark');
    mockMatchMedia(false);
    expect(resolveTheme()).toBe('light');
  });

  it('applies html.dark and color-scheme the same way the workspace toggle does', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('persists the explicit choice for later visits and the workspace', () => {
    persistTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('keeps the blocking bootstrap script in lockstep with resolveTheme', () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("localStorage.getItem('theme')");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("stored==='dark'");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("classList.toggle('dark'");
  });

  it('records the landing theme hint as seen once', () => {
    expect(hasSeenThemeHint()).toBe(false);
    markThemeHintSeen();
    expect(hasSeenThemeHint()).toBe(true);
    expect(localStorage.getItem(THEME_HINT_STORAGE_KEY)).toBe('1');
  });

  it('treats an explicit stored theme as a chosen preference', () => {
    expect(hasExplicitThemePreference()).toBe(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(hasExplicitThemePreference()).toBe(true);
  });
});
