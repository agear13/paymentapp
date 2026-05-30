'use client';

import { usePathname } from 'next/navigation';
import { useOperationalCoordinationContext } from '@/contexts/operational-coordination-context';
import { isWorkspaceCoordinationRoute } from '@/lib/operations/routing/is-workspace-coordination-route';
import { OperationalStatusBar } from '@/components/operations/operational-status-bar';

/**
 * Compact sticky workspace strip — hidden on home (command center replaces it).
 */
export function DashboardOperationalStatus() {
  const pathname = usePathname() ?? '/dashboard';
  const coordination = useOperationalCoordinationContext();

  if (!isWorkspaceCoordinationRoute(pathname) || !coordination) {
    return null;
  }

  const { guidance, loading, degraded, activation } = coordination;

  return (
    <OperationalStatusBar
      guidance={guidance}
      loading={loading}
      degraded={degraded}
      activation={activation}
      compact
      sticky
      className="-mx-6 -mt-6 mb-6"
    />
  );
}
