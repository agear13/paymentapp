'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceFeature } from '@/lib/workspace-features';
import { useWorkspaceFeatures } from './workspace-feature-provider';

export type RouteGateProps = {
  feature: WorkspaceFeature;
  children: React.ReactNode;
  redirectTo?: string;
  fallback?: React.ReactNode;
};

export function RouteGate({
  feature,
  children,
  redirectTo = '/dashboard',
  fallback = null,
}: RouteGateProps) {
  const router = useRouter();
  const { hasFeature } = useWorkspaceFeatures();
  const enabled = hasFeature(feature);

  React.useEffect(() => {
    if (enabled) return;
    router.replace(redirectTo);
  }, [enabled, redirectTo, router]);

  if (!enabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
