'use client';

import * as React from 'react';
import type { WorkspaceFeature } from '@/lib/workspace-features';
import { useWorkspaceFeatures } from './workspace-feature-provider';

export type FeatureGateProps = {
  feature: WorkspaceFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { hasFeature } = useWorkspaceFeatures();

  if (!hasFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
