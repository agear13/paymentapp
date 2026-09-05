export const THEME_STORAGE_KEY = 'theme';
export const THEME_HINT_STORAGE_KEY = 'provvy.themeHintSeen';
export const THEME_CHANGE_EVENT = 'provvy-theme-change';

export type ProvvyTheme = 'light' | 'dark';

/**
 * Blocking bootstrap that mirrors resolveTheme() + applyTheme().
 * Keep this string in lockstep with those functions — it runs before React hydrates
 * so a saved dark preference does not flash light.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var stored=localStorage.getItem('theme');var dark=stored?stored==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';}catch(e){}})();`;

export function resolveTheme(): ProvvyTheme {
  if (typeof window === 'undefined') return 'light';

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    return isDark ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: ProvvyTheme): void {
  if (typeof document === 'undefined') return;

  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
}

export function persistTheme(theme: ProvvyTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage — still apply for this session.
  }
  applyTheme(theme);
}

export function hasExplicitThemePreference(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light';
  } catch {
    return true;
  }
}

export function hasSeenThemeHint(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    return localStorage.getItem(THEME_HINT_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markThemeHintSeen(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(THEME_HINT_STORAGE_KEY, '1');
  } catch {
    // Ignore — worst case the hint can appear again.
  }
}
