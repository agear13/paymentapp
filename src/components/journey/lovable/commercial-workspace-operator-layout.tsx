'use client';

import * as React from 'react';
import { ProjectWorkspaceProvider } from '@/components/projects/project-workspace-provider';
import { CommercialWorkspaceOperatorShell } from '@/components/journey/lovable/commercial-workspace-operator-shell';

/**
 * Phase 4A operator root.
 * Reuses ProjectWorkspaceProvider (same deal id as dashboard projectId).
 * Does not mount ProjectWorkspaceShell or dashboard chrome.
 */
export function CommercialWorkspaceOperatorLayout({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  return (
    <ProjectWorkspaceProvider projectId={workspaceId}>
      <CommercialWorkspaceOperatorShell workspaceId={workspaceId}>
        {children}
      </CommercialWorkspaceOperatorShell>
    </ProjectWorkspaceProvider>
  );
}
