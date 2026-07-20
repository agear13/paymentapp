/**
 * Commercial Network Layer — domain-facing facade.
 *
 * React
 *   ↓
 * Commercial Domain
 *   ↓
 * Commercial Network Layer  ← THIS MODULE
 *   ↓
 * Local Provider | Canton Provider | Future Providers
 *   ↓
 * Persistence / Shared Workflow
 *
 * The Commercial Domain must only communicate through this boundary.
 * It must never know which network implementation is being used.
 */

import type { CommercialNetworkProvider } from '@/lib/commercial-network/commercial-network-provider';
import type { CommercialNetworkEvent } from '@/lib/commercial-network/events';
import {
  getDefaultCommercialNetworkProviderRegistry,
  type CommercialNetworkProviderRegistry,
} from '@/lib/commercial-network/provider-registry';
import {
  createProjectionService,
  type ProjectionService,
} from '@/lib/commercial-network/projection-service';
import type {
  CommercialNetworkEventHandler,
  CommercialNetworkResult,
  CreateSharedAgreementCommand,
  ParticipantApprovalCommand,
  ParticipantApprovalResult,
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

export type CommercialNetworkScope = {
  organizationId: string;
  projectId?: string | null;
};

export type CommercialNetwork = {
  readonly scope: CommercialNetworkScope;
  readonly provider: CommercialNetworkProvider;
  readonly projections: ProjectionService;

  createSharedCommercialAgreement(
    command: CreateSharedAgreementCommand
  ): Promise<CommercialNetworkResult<SharedCommercialAgreement>>;

  updateCommercialAgreement(
    command: UpdateSharedAgreementCommand
  ): Promise<CommercialNetworkResult<SharedCommercialAgreement>>;

  transitionWorkflow(
    command: WorkflowTransitionCommand
  ): Promise<CommercialNetworkResult<WorkflowTransitionResult>>;

  submitParticipantApproval(
    command: ParticipantApprovalCommand
  ): Promise<CommercialNetworkResult<ParticipantApprovalResult>>;

  submitSettlementApproval(
    command: SettlementApprovalCommand
  ): Promise<CommercialNetworkResult<SettlementApprovalResult>>;

  subscribeToWorkflowEvents(handler: CommercialNetworkEventHandler): Unsubscribe;

  publishCommercialEvent(
    event: CommercialNetworkEvent
  ): Promise<CommercialNetworkResult<CommercialNetworkEvent>>;

  synchronizeSharedState(
    command?: Omit<SynchronizeSharedStateCommand, 'organizationId'> & {
      organizationId?: string | null;
    }
  ): Promise<CommercialNetworkResult<SharedCommercialSnapshot>>;
};

export type OpenCommercialNetworkOptions = {
  registry?: CommercialNetworkProviderRegistry;
  /**
   * Inject a specific provider (tests / advanced wiring).
   * When set, organisation config is ignored for provider selection.
   */
  provider?: CommercialNetworkProvider;
  /** Shared projection service; created when omitted. */
  projections?: ProjectionService;
  /** Auto-attach projections to provider event stream (default true). */
  attachProjections?: boolean;
};

/**
 * Open a Commercial Network handle for an organisation (and optional project).
 * Provider selection is config-driven via the registry — never hardcoded.
 */
export function openCommercialNetwork(
  scope: CommercialNetworkScope,
  options: OpenCommercialNetworkOptions = {}
): CommercialNetwork {
  const registry =
    options.registry ?? getDefaultCommercialNetworkProviderRegistry();
  const provider =
    options.provider ??
    registry.resolveFor({
      organizationId: scope.organizationId,
      projectId: scope.projectId,
    });
  const projections = options.projections ?? createProjectionService();
  const attachProjections = options.attachProjections !== false;

  let projectionSubscription: Unsubscribe | null = null;
  if (attachProjections) {
    projectionSubscription = provider.subscribeToWorkflowEvents((event) => {
      projections.project(event);
    });
  }

  const network: CommercialNetwork = {
    scope,
    provider,
    projections,

    createSharedCommercialAgreement(command) {
      return provider.createSharedCommercialAgreement({
        ...command,
        organizationId: command.organizationId ?? scope.organizationId,
      });
    },

    updateCommercialAgreement(command) {
      return provider.updateCommercialAgreement(command);
    },

    transitionWorkflow(command) {
      return provider.transitionWorkflow(command);
    },

    submitParticipantApproval(command) {
      return provider.submitParticipantApproval(command);
    },

    submitSettlementApproval(command) {
      return provider.submitSettlementApproval(command);
    },

    subscribeToWorkflowEvents(handler) {
      const unsub = provider.subscribeToWorkflowEvents(handler);
      return () => {
        unsub();
      };
    },

    publishCommercialEvent(event) {
      return provider.publishCommercialEvent({ event });
    },

    synchronizeSharedState(command = {}) {
      return provider.synchronizeSharedState({
        ...command,
        organizationId:
          command.organizationId !== undefined
            ? command.organizationId
            : scope.organizationId,
        agreementId: command.agreementId ?? scope.projectId ?? undefined,
      });
    },
  };

  // Retain subscription for the lifetime of the handle (GC-friendly via closure).
  void projectionSubscription;

  return network;
}

/**
 * Resolve only the provider for a scope (without opening a full handle).
 * Prefer `openCommercialNetwork` for domain operations.
 */
export function resolveCommercialNetworkProvider(
  scope: CommercialNetworkScope,
  registry: CommercialNetworkProviderRegistry = getDefaultCommercialNetworkProviderRegistry()
): CommercialNetworkProvider {
  return registry.resolveFor({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
  });
}
