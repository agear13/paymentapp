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

/** Deep-links to the Approval Centre within the Participants tab. */
export function projectApprovalCentrePath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/participants?focus=approvals`;
}

/**
 * Deep-links to the Supplier Onboarding section within the Participants tab.
 * Optionally scopes to a specific participant for direct review.
 */
export function projectSupplierOnboardingPath(projectId: string, participantId?: string): string {
  const base = `/dashboard/projects/${encodeURIComponent(projectId)}/participants?focus=onboarding`;
  return participantId ? `${base}&participant=${encodeURIComponent(participantId)}` : base;
}

/**
 * Deep-links to the Operator Review section for a specific participant's supplier onboarding.
 * Scoped to the participant so the review panel auto-opens.
 */
export function projectOperatorReviewPath(projectId: string, participantId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/participants?focus=onboarding&review=${encodeURIComponent(participantId)}`;
}

/**
 * Deep-links to the Accounting Approval section within the Funding tab.
 * Used for the "Approve & Push to Xero" CTA.
 */
export function projectXeroExportPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/funding?section=accounting`;
}

export function projectSettlementPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/payouts`;
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
