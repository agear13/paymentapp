'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { JARVIS_GA_EVENTS, trackGaEvent } from '@/lib/analytics/track-ga-event';
import { PROVVY_TODAY_PATH } from '@/lib/marketing/provvy-today';

export function ExploreProvvyLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={PROVVY_TODAY_PATH}
      className={className}
      onClick={() => trackGaEvent(JARVIS_GA_EVENTS.exploreProvvyClicked)}
    >
      {children}
    </Link>
  );
}
