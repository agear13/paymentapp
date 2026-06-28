'use client';

/**
 * Provvypay Agreements workspace context.
 *
 * This provider owns Agreements UI state. Shared repositories/domain services may
 * remain shared, but Rabbit Hole pilot UI must not depend on this context.
 */

import * as React from 'react';
import { useProjectContext, type ProjectContextValue } from '@/hooks/use-project-context';

const ProjectWorkspaceContext = React.createContext<ProjectContextValue | null>(null);

export function useOptionalProjectWorkspace(): ProjectContextValue | null {
  return React.useContext(ProjectWorkspaceContext);
}

export function ProjectWorkspaceProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const value = useProjectContext(projectId);
  return (
    <ProjectWorkspaceContext.Provider value={value}>{children}</ProjectWorkspaceContext.Provider>
  );
}

export function useProjectWorkspace(): ProjectContextValue {
  const ctx = React.useContext(ProjectWorkspaceContext);
  if (!ctx) {
    throw new Error('useProjectWorkspace must be used within ProjectWorkspaceProvider');
  }
  return ctx;
}

export { useProjectWorkspaceRefresh, useProjectWorkspaceSmartPolling } from '@/hooks/use-project-workspace-refresh';
