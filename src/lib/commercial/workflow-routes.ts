/**
 * Commercial Workflow Route Resolver
 *
 * The single function that converts abstract CommercialWorkflowDestination tokens
 * into concrete, project-scoped URLs.
 *
 * Design rules:
 *   - All commercial workflow CTAs MUST resolve through this function.
 *   - Never hardcode project URLs in commercial components — always call this.
 *   - participantId is optional; when provided, the URL deep-links to that participant.
 *   - Returns a string href suitable for <Link href> or router.push().
 *
 * Usage:
 *   const href = resolveCommercialWorkflowDestination('operator_review', projectId, participant.id);
 *   <Link href={href}>Review supplier details</Link>
 */

import type { CommercialWorkflowDestination } from './workflow-integration';
import {
  projectApprovalCentrePath,
  projectSupplierOnboardingPath,
  projectOperatorReviewPath,
  projectXeroExportPath,
  projectFundingPath,
  projectPayoutsPath,
} from '@/lib/projects/project-routes';

/**
 * Resolve a CommercialWorkflowDestination token to a concrete URL.
 *
 * @param destination - The abstract destination token from CommercialWorkflowCTA.
 * @param projectId   - The project/agreement ID, used to build project-scoped URLs.
 * @param participantId - Optional. When provided, deep-links to that participant.
 * @returns Absolute path href (no domain).
 */
export function resolveCommercialWorkflowDestination(
  destination: CommercialWorkflowDestination,
  projectId: string,
  participantId?: string
): string {
  switch (destination) {
    case 'approval_centre':
      return projectApprovalCentrePath(projectId);

    case 'supplier_onboarding':
      return projectSupplierOnboardingPath(projectId, participantId);

    case 'operator_review':
      return participantId
        ? projectOperatorReviewPath(projectId, participantId)
        : projectSupplierOnboardingPath(projectId);

    case 'xero_export':
      return projectXeroExportPath(projectId);

    case 'funding_page':
      return projectFundingPath(projectId);

    case 'settlement_page':
    case 'release_page':
      // Both resolve to the payouts tab.
      // The payouts tab displays both the settlement checklist and the release queue.
      return projectPayoutsPath(projectId);

    case 'none':
      // No navigation — terminal or waiting state. Caller should not render a link.
      return '#';
  }
}

/**
 * Convenience: resolve a CTA to an href, or null if the destination is 'none'.
 * Prevents rendering dead links.
 */
export function resolveCommercialCTAHref(
  destination: CommercialWorkflowDestination,
  projectId: string,
  participantId?: string
): string | null {
  if (destination === 'none') return null;
  return resolveCommercialWorkflowDestination(destination, projectId, participantId);
}
