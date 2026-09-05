'use client';

import './lovable-journey.css';
import { useProvvyTheme } from '@/hooks/use-provvy-theme';

type LovableJourneyShellProps = {
  children: React.ReactNode;
  className?: string;
};

/** Wraps journey pages with Lovable design tokens and the shared Provvy theme. */
export function LovableJourneyShell({ children, className = '' }: LovableJourneyShellProps) {
  const { dark } = useProvvyTheme();

  return (
    <div className={`lovable-journey min-h-screen ${dark ? 'dark' : ''} ${className}`.trim()}>
      {children}
    </div>
  );
}

export { useProvvyTheme as useLovableThemeToggle } from '@/hooks/use-provvy-theme';
