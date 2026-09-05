'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useProvvyTheme } from '@/hooks/use-provvy-theme';
import {
  hasSeenThemeHint,
  markThemeHintSeen,
} from '@/lib/theme/provvy-theme';

export const LANDING_THEME_HINT_TOAST_ID = 'provvy-theme-hint';
export const LANDING_THEME_HINT_DELAY_MS = 2200;

export function LandingThemeHint() {
  const { setTheme } = useProvvyTheme();

  useEffect(() => {
    if (hasSeenThemeHint()) return;

    const timer = window.setTimeout(() => {
      if (hasSeenThemeHint()) return;

      const isDark = document.documentElement.classList.contains('dark');
      const title = isDark ? 'Prefer a lighter look?' : 'Prefer a darker look?';
      const description = isDark
        ? 'You can switch to light mode anytime.'
        : 'You can switch to dark mode anytime.';
      const actionLabel = isDark ? 'Switch to light' : 'Switch to dark';
      const nextTheme = isDark ? 'light' : 'dark';

      toast(title, {
        id: LANDING_THEME_HINT_TOAST_ID,
        description,
        duration: 10000,
        closeButton: true,
        position: 'bottom-right',
        action: {
          label: actionLabel,
          onClick: () => {
            setTheme(nextTheme);
            markThemeHintSeen();
          },
        },
        onDismiss: markThemeHintSeen,
        onAutoClose: markThemeHintSeen,
      });
    }, LANDING_THEME_HINT_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      toast.dismiss(LANDING_THEME_HINT_TOAST_ID);
    };
  }, [setTheme]);

  return null;
}
