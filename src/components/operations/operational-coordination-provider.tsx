'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  OperationalCoordinationContext,
  type OperationalCoordinationContextValue,
} from '@/contexts/operational-coordination-context';
import { useOperationalCoordinationStateCore } from '@/hooks/use-operational-coordination-state';
import { isWorkspaceCoordinationRoute } from '@/lib/operations/routing/is-workspace-coordination-route';

export function OperationalCoordinationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/dashboard';
  const enabled = isWorkspaceCoordinationRoute(pathname);

  const value = useOperationalCoordinationStateCore({
    enabled,
    traceSurface: 'dashboard-operational-provider',
  });

  const contextValue: OperationalCoordinationContextValue | null = enabled ? value : null;

  return (
    <OperationalCoordinationContext.Provider value={contextValue}>
      {children}
    </OperationalCoordinationContext.Provider>
  );
}
