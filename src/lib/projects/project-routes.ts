/** Canonical project-scoped operator routes (workflow IA). */

export function projectOverviewPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}`;
}

export function projectCommercialRolesPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/commercial-roles`;
}

/** @deprecated Use projectCommercialRolesPath */
export function projectAllocationsPath(projectId: string): string {
  return projectCommercialRolesPath(projectId);
}

export function projectParticipantsPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/participants`;
}

export function projectFundingPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/funding`;
}

export function projectObligationsPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/obligations`;
}

export function projectPayoutsPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/payouts`;
}

export function projectActivityPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/activity`;
}

export type ProjectWorkspaceTab =
  | 'overview'
  | 'commercialRoles'
  | 'participants'
  | 'funding'
  | 'obligations'
  | 'payouts'
  | 'activity';

export function projectTabFromPathname(pathname: string, projectId: string): ProjectWorkspaceTab {
  const base = projectOverviewPath(projectId);
  if (pathname === base) return 'overview';
  if (
    pathname.startsWith(`${base}/commercial-roles`) ||
    pathname.startsWith(`${base}/allocations`)
  ) {
    return 'commercialRoles';
  }
  if (pathname.startsWith(`${base}/participants`)) return 'participants';
  if (pathname.startsWith(`${base}/funding`)) return 'funding';
  if (pathname.startsWith(`${base}/obligations`)) return 'obligations';
  if (pathname.startsWith(`${base}/payouts`)) return 'payouts';
  if (pathname.startsWith(`${base}/activity`)) return 'activity';
  return 'overview';
}
