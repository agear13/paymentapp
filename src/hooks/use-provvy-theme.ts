'use client';

import { useCallback, useLayoutEffect, useState } from 'react';
import {
  applyTheme,
  persistTheme,
  resolveTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ProvvyTheme,
} from '@/lib/theme/provvy-theme';

export function useProvvyTheme() {
  const [dark, setDark] = useState(false);

  useLayoutEffect(() => {
    const syncFromDocument = () => {
      setDark(document.documentElement.classList.contains('dark'));
    };

    applyTheme(resolveTheme());
    syncFromDocument();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      applyTheme(resolveTheme());
      syncFromDocument();
    };

    window.addEventListener(THEME_CHANGE_EVENT, syncFromDocument);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncFromDocument);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setTheme = useCallback((theme: ProvvyTheme) => {
    persistTheme(theme);
    setDark(theme === 'dark');
  }, []);

  const toggle = useCallback(() => {
    const next: ProvvyTheme = document.documentElement.classList.contains('dark')
      ? 'light'
      : 'dark';
    persistTheme(next);
    setDark(next === 'dark');
  }, []);

  return { dark, toggle, setTheme };
}
