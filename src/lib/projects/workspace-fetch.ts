import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';

export type WorkspaceSummaryResponse = {
  deal: RecentDeal;
  summary: ProjectWorkspaceSummary;
  participantCount: number;
  deals: RecentDeal[];
};

export type WorkspaceParticipantsResponse = {
  participants: DemoParticipant[];
  projectParticipants: DemoParticipant[];
};

async function workspaceGet<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    signal,
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Workspace fetch failed: ${res.status}`);
  return (await res.json()) as T;
}

export function fetchWorkspaceSummary(
  projectId: string,
  signal?: AbortSignal
): Promise<WorkspaceSummaryResponse | null> {
  return workspaceGet<WorkspaceSummaryResponse>(
    `/api/projects/workspace/${encodeURIComponent(projectId)}/summary`,
    signal
  );
}

export function fetchWorkspaceParticipants(
  projectId: string,
  signal?: AbortSignal
): Promise<WorkspaceParticipantsResponse | null> {
  return workspaceGet<WorkspaceParticipantsResponse>(
    `/api/projects/workspace/${encodeURIComponent(projectId)}/participants`,
    signal
  );
}

/** Full snapshot — used only for saveSnapshot / legacy sync. */
export async function fetchWorkspaceFullSnapshot(signal?: AbortSignal): Promise<{
  deals: RecentDeal[];
  participants: DemoParticipant[];
} | null> {
  const res = await fetch('/api/deal-network-pilot/snapshot', {
    credentials: 'include',
    cache: 'no-store',
    signal,
  });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return (await res.json()) as { deals: RecentDeal[]; participants: DemoParticipant[] };
}

export async function persistWorkspaceFullSnapshot(data: {
  deals: RecentDeal[];
  participants: DemoParticipant[];
}): Promise<boolean> {
  const res = await fetch('/api/deal-network-pilot/snapshot', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  });
  return res.ok;
}
