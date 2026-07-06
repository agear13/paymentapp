'use client';

import * as React from 'react';
import {
  MOCK_WORKSPACE_FEATURE_CONFIG,
  createWorkspaceFeatureSet,
  hasFeature as isWorkspaceFeatureEnabled,
  type WorkspaceFeature,
  type WorkspaceFeatureConfig,
  type WorkspaceMode,
} from '@/lib/workspace-features';

export type WorkspaceFeatureContextValue = {
  enabledFeatures: readonly WorkspaceFeature[];
  workspaceMode: WorkspaceMode;
  hasFeature: (feature: WorkspaceFeature) => boolean;
};

const WorkspaceFeatureContext = React.createContext<WorkspaceFeatureContextValue | null>(null);

export function WorkspaceFeatureProvider({
  children,
  config = MOCK_WORKSPACE_FEATURE_CONFIG,
}: {
  children: React.ReactNode;
  config?: WorkspaceFeatureConfig;
}) {
  const enabledFeatures = React.useMemo(
    () => Array.from(new Set(config.enabledFeatures)),
    [config.enabledFeatures]
  );
  const enabledFeatureSet = React.useMemo(
    () => createWorkspaceFeatureSet(enabledFeatures),
    [enabledFeatures]
  );

  const hasFeature = React.useCallback(
    (feature: WorkspaceFeature) => isWorkspaceFeatureEnabled(enabledFeatureSet, feature),
    [enabledFeatureSet]
  );

  const value = React.useMemo<WorkspaceFeatureContextValue>(
    () => ({
      enabledFeatures,
      workspaceMode: config.mode,
      hasFeature,
    }),
    [config.mode, enabledFeatures, hasFeature]
  );

  return (
    <WorkspaceFeatureContext.Provider value={value}>{children}</WorkspaceFeatureContext.Provider>
  );
}

export function useWorkspaceFeatures(): WorkspaceFeatureContextValue {
  const context = React.useContext(WorkspaceFeatureContext);

  if (!context) {
    throw new Error('useWorkspaceFeatures must be used within WorkspaceFeatureProvider');
  }

  return context;
}
