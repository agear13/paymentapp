/**
 * Commercial Network Provider
 *
 * Every shared-workflow network implements this interface.
 * The Commercial Domain must only communicate through this interface —
 * never with Canton, Azure, Hyperledger, or Postgres sync paths directly.
 *
 * Responsibilities (shared workflow synchronization only):
 *   - Create / update Shared Commercial Agreements
 *   - Transition workflows
 *   - Submit participant / settlement approvals
 *   - Subscribe to / publish commercial network events
 *   - Synchronize shared state
 *
 * Providers never own:
 *   forecasting · automation · accounting · AI · reporting · UI
 */

import type { CommercialNetworkEvent } from '@/lib/commercial-network/events';
import type {
  CommercialNetworkEventHandler,
  CommercialNetworkProviderId,
  CommercialNetworkResult,
  CreateSharedAgreementCommand,
  ParticipantApprovalCommand,
  ParticipantApprovalResult,
  PublishCommercialNetworkEventCommand,
  SettlementApprovalCommand,
  SettlementApprovalResult,
  SharedCommercialAgreement,
  SharedCommercialSnapshot,
  SynchronizeSharedStateCommand,
  Unsubscribe,
  UpdateSharedAgreementCommand,
  WorkflowTransitionCommand,
  WorkflowTransitionResult,
} from '@/lib/commercial-network/types';

export interface CommercialNetworkProvider {
  readonly providerId: CommercialNetworkProviderId;

  /** Human-readable label for configuration surfaces. */
  readonly label: string;

  /**
   * Create a Shared Commercial Agreement on the network.
   * Local: persists via existing Provvypay agreement storage.
   * Canton: Daml create / sync (future).
   */
  createSharedCommercialAgreement(
    command: CreateSharedAgreementCommand
  ): Promise<CommercialNetworkResult<SharedCommercialAgreement>>;

  /**
   * Update an existing Shared Commercial Agreement.
   */
  updateCommercialAgreement(
    command: UpdateSharedAgreementCommand
  ): Promise<CommercialNetworkResult<SharedCommercialAgreement>>;

  /**
   * Transition a workflow lane (commercial / settlement / accounting / custom).
   */
  transitionWorkflow(
    command: WorkflowTransitionCommand
  ): Promise<CommercialNetworkResult<WorkflowTransitionResult>>;

  /**
   * Submit participant approval of commercial terms.
   */
  submitParticipantApproval(
    command: ParticipantApprovalCommand
  ): Promise<CommercialNetworkResult<ParticipantApprovalResult>>;

  /**
   * Submit settlement approval / readiness acknowledgement.
   */
  submitSettlementApproval(
    command: SettlementApprovalCommand
  ): Promise<CommercialNetworkResult<SettlementApprovalResult>>;

  /**
   * Subscribe to workflow / commercial network events from this provider.
   * Local: synchronous in-process dispatch.
   * Future providers: may be async / streaming.
   */
  subscribeToWorkflowEvents(handler: CommercialNetworkEventHandler): Unsubscribe;

  /**
   * Publish a commercial network event (outbox / bus).
   */
  publishCommercialEvent(
    command: PublishCommercialNetworkEventCommand
  ): Promise<CommercialNetworkResult<CommercialNetworkEvent>>;

  /**
   * Synchronize shared commercial state with the network.
   * Local: upserts the provided snapshot (or no-op refresh).
   * Canton: pull/push ledger state (future).
   */
  synchronizeSharedState(
    command: SynchronizeSharedStateCommand
  ): Promise<CommercialNetworkResult<SharedCommercialSnapshot>>;

  /**
   * Optional health check — default implementations may return connected for Local.
   */
  validateConnection?(): Promise<{ connected: boolean; error: string | null }>;
}

/** Standard not-implemented result for skeleton providers. */
export function notImplementedResult(
  method: string,
  providerId: CommercialNetworkProviderId
): CommercialNetworkResult<never> {
  return {
    ok: false,
    notImplemented: true,
    error: `${providerId}: ${method} is not implemented`,
    operatorError: `Commercial Network provider "${providerId}" does not implement ${method} yet.`,
  };
}
