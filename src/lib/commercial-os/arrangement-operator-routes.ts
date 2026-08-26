import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type { ParticipantWorkflowCtaDestination } from '@/lib/commercial/participant-commercial-lifecycle';
import type { ResolveWorkflowCtaHref } from '@/lib/projects/workflow-cta-href';

export type ArrangementPeopleFocus = 'approvals' | 'onboarding' | 'payment-requests';

export function arrangementPeopleFocusPath(
  workspaceId: string,
  focus: ArrangementPeopleFocus
): string {
  return COMMERCIAL_OS_ROUTES.arrangementPeopleFocus(workspaceId, focus);
}

export function arrangementPersonOnboardPath(
  workspaceId: string,
  participantId: string
): string {
  return COMMERCIAL_OS_ROUTES.arrangementPersonOnboard(workspaceId, participantId);
}

export function arrangementPersonReviewPath(
  workspaceId: string,
  participantId: string
): string {
  return COMMERCIAL_OS_ROUTES.arrangementPersonReview(workspaceId, participantId);
}

export function arrangementMoneyAccountingPath(workspaceId: string): string {
  return COMMERCIAL_OS_ROUTES.arrangementMoneyAccounting(workspaceId);
}

/** Commercial OS destinations for Approval Centre workflow CTAs. */
export function arrangementWorkflowCtaHref(
  workspaceId: string,
  participantId: string | undefined,
  destination: ParticipantWorkflowCtaDestination
): string {
  switch (destination) {
    case 'send_payment_request':
    case 'await_participant':
      return arrangementPeopleFocusPath(workspaceId, 'payment-requests');
    case 'review_payment':
      return participantId
        ? arrangementPersonReviewPath(workspaceId, participantId)
        : arrangementPeopleFocusPath(workspaceId, 'payment-requests');
    case 'xero_export':
      return arrangementMoneyAccountingPath(workspaceId);
    case 'settlement':
      return COMMERCIAL_OS_ROUTES.settlement;
    case 'configure_earnings':
    case 'send_agreement':
    case 'none':
    default:
      return COMMERCIAL_OS_ROUTES.arrangementPeople(workspaceId);
  }
}

export function createArrangementCtaHrefResolver(
  workspaceId: string
): ResolveWorkflowCtaHref {
  return (destination, participantId) =>
    arrangementWorkflowCtaHref(workspaceId, participantId, destination);
}
