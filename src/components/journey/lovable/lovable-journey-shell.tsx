'use client';

import './lovable-journey.css';
import { useEffect, useState } from 'react';

type LovableJourneyShellProps = {
  children: React.ReactNode;
  className?: string;
};

/** Wraps journey pages with Lovable design tokens and optional dark mode from localStorage. */
export function LovableJourneyShell({ children, className = '' }: LovableJourneyShellProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(stored ? stored === 'dark' : prefers);
  }, []);

  return (
    <div className={`lovable-journey min-h-screen ${dark ? 'dark' : ''} ${className}`.trim()}>
      {children}
    </div>
  );
}

export function useLovableThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefers;
    setDark(isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return { dark, toggle };
}
