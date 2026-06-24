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
 * Routes to the supplier onboarding overview (participants tab with onboarding panel).
 * When a specific participantId is provided, routes directly to that participant's
 * onboarding form page.
 */
export function projectSupplierOnboardingPath(projectId: string, participantId?: string): string {
  if (participantId) {
    return `/dashboard/projects/${encodeURIComponent(projectId)}/participants/${encodeURIComponent(participantId)}/onboard`;
  }
  return `/dashboard/projects/${encodeURIComponent(projectId)}/participants?focus=onboarding`;
}

/** Deep-links to participants needing payment request generation or sharing. */
export function projectPaymentRequestsPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/participants?focus=payment-requests`;
}

/**
 * Routes to the operator review page for a specific participant's supplier onboarding.
 * The operator sees invoice, ABN, GST, payment details, and an approve CTA.
 */
export function projectOperatorReviewPath(projectId: string, participantId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/participants/${encodeURIComponent(participantId)}/review`;
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
