import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import {
  deriveWorkspaceLifecycleSummary,
  type WorkspaceLifecycleNotification,
} from '@/lib/commercial/participant-commercial-lifecycle';

/** KPI cards on project participants view — stage-based lifecycle metrics. */
export function deriveParticipantViewStats(input: {
  canonicalKpis: OperationalKPIs | null | undefined;
  graphParticipants: OperationalCoordinationSnapshot['participants'];
}): {
  pendingAgreements: number;
  missingConfirmation: number;
  readyForPayout: number;
  activeAttribution: number;
  lifecycleNotifications: WorkspaceLifecycleNotification[];
  primaryLifecycleMessage: string | null;
  earningsConfigurationNeeded: number;
  agreementsReadyToSend: number;
  awaitingAcceptance: number;
  paymentFormsPending: number;
  paymentProfilesAwaitingReview: number;
  readyForXero: number;
  settlementsReady: number;
} {
  if (!input.canonicalKpis) {
    return {
      pendingAgreements: 0,
      missingConfirmation: 0,
      readyForPayout: 0,
      activeAttribution: 0,
      lifecycleNotifications: [],
      primaryLifecycleMessage: null,
      earningsConfigurationNeeded: 0,
      agreementsReadyToSend: 0,
      awaitingAcceptance: 0,
      paymentFormsPending: 0,
      paymentProfilesAwaitingReview: 0,
      readyForXero: 0,
      settlementsReady: 0,
    };
  }

  const participants = input.graphParticipants.map((row) => row.participant);
  const lifecycle = deriveWorkspaceLifecycleSummary(participants);

  const paymentProfilesAwaitingReview =
    lifecycle.byStage.OPERATOR_REVIEW + lifecycle.byStage.PAYMENT_INFO_SUBMITTED;

  return {
    readyForPayout: input.canonicalKpis.payoutReadyCount,
    pendingAgreements: Math.max(
      0,
      input.canonicalKpis.participantCount - input.canonicalKpis.approvedAgreementCount
    ),
    activeAttribution: input.canonicalKpis.attributionActiveCount,
    missingConfirmation: paymentProfilesAwaitingReview,
    lifecycleNotifications: lifecycle.notifications,
    primaryLifecycleMessage: lifecycle.primaryNotification?.message ?? null,
    earningsConfigurationNeeded: lifecycle.byStage.DRAFT,
    agreementsReadyToSend: lifecycle.byStage.EARNINGS_CONFIGURED,
    awaitingAcceptance: lifecycle.byStage.AGREEMENT_SENT,
    paymentFormsPending:
      lifecycle.byStage.PAYMENT_INFO_PENDING + lifecycle.byStage.AGREEMENT_ACCEPTED,
    paymentProfilesAwaitingReview,
    readyForXero: lifecycle.byStage.XERO_INVOICE,
    settlementsReady: lifecycle.byStage.SETTLEMENT_READY,
  };
}
