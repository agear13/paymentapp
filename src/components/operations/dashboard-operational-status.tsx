'use client';

import { usePathname } from 'next/navigation';
import { useOperationalGuidance } from '@/hooks/use-operational-guidance';
import { OperationalStatusBar } from '@/components/operations/operational-status-bar';

/**
 * Compact sticky workspace strip — hidden on home (command center replaces it).
 */
export function DashboardOperationalStatus() {
  const pathname = usePathname() ?? '/dashboard';

  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return null;
  }

  if (pathname.match(/\/dashboard\/projects\/[^/]+/)) {
    return null;
  }

  const { guidance, loading, degraded } = useOperationalGuidance();

  return (
    <OperationalStatusBar
      guidance={guidance}
      loading={loading}
      degraded={degraded}
      compact
      sticky
      className="-mx-6 -mt-6 mb-6"
    />
  );
}
