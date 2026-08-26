import type { ParticipantWorkflowCtaDestination } from '@/lib/commercial/participant-commercial-lifecycle';
import {
  projectOperatorReviewPath,
  projectPaymentRequestsPath,
  projectParticipantsPath,
  projectSettlementPath,
  projectXeroExportPath,
} from '@/lib/projects/project-routes';

/** Optional override so Commercial OS can reuse Approval Centre without rewriting dashboard routes. */
export type ResolveWorkflowCtaHref = (
  destination: ParticipantWorkflowCtaDestination,
  participantId?: string
) => string;

/** Dashboard defaults. Used when Approval Centre is rendered outside Commercial OS. */
export function dashboardWorkflowCtaHref(
  projectId: string,
  participantId: string | undefined,
  destination: ParticipantWorkflowCtaDestination
): string {
  switch (destination) {
    case 'send_payment_request':
    case 'await_participant':
      return projectPaymentRequestsPath(projectId);
    case 'review_payment':
      return participantId
        ? projectOperatorReviewPath(projectId, participantId)
        : projectPaymentRequestsPath(projectId);
    case 'xero_export':
      return projectXeroExportPath(projectId);
    case 'settlement':
      return projectSettlementPath(projectId);
    case 'configure_earnings':
    case 'send_agreement':
    case 'none':
    default:
      return projectParticipantsPath(projectId);
  }
}
