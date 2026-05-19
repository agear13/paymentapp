'use client';

/**
 * Lightweight registry so header breadcrumbs can show project names
 * without coupling AppHeader to ProjectWorkspaceProvider.
 */

import { getProjectDisplayName, UNTITLED_PROJECT_LABEL } from '@/lib/projects/get-project-display-name';

const names = new Map<string, string>();
const listeners = new Set<() => void>();

export function setProjectDisplayNameRegistry(
  projectId: string,
  source: { name?: string | null; dealName?: string | null }
): void {
  const label = getProjectDisplayName(source);
  if (names.get(projectId) === label) return;
  names.set(projectId, label);
  listeners.forEach((fn) => fn());
}

export function getProjectDisplayNameFromRegistry(projectId: string): string | null {
  return names.get(projectId) ?? null;
}

export function subscribeProjectDisplayNameRegistry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function projectBreadcrumbFallbackLabel(): string {
  return UNTITLED_PROJECT_LABEL;
}
