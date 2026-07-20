/**
 * Local Commercial Network Provider
 *
 * Wraps existing Provvypay behaviour. No behavioural changes.
 * The application continues to operate exactly as it does today —
 * Local is the default Commercial Network implementation.
 *
 * Dispatches Commercial Network events immediately (in-process).
 * Persistence is delegated to LocalPersistencePort (in-memory or Prisma-bound).
 */

import type { CommercialNetworkProvider } from '@/lib/commercial-network/commercial-network-provider';
import {
  createCommercialNetworkEvent,
  type CommercialNetworkEvent,
} from '@/lib/commercial-network/events';
import {
  createCommercialNetworkEventDispatcher,
  type CommercialNetworkEventDispatcher,
} from '@/lib/commercial-network/event-dispatcher';
import {
  createInMemoryLocalPersistencePort,
  type LocalPersistencePort,
} from '@/lib/commercial-network/adapters/local-persistence-port';
import type {
  CommercialNetworkEventHandler,
  CommercialNetworkResult,
  CreateSharedAgreementCommand,
  ParticipantApprovalCommand,
  ParticipantApprovalResult,
  PublishCommercialNetworkEventCommand,
  SettlementApprovalCommand,
  SettlementApprovalResult,
  SharedCommercialAgreement,
  SharedCommercialParticipant,
  SharedCommercialSnapshot,
  SynchronizeSharedStateCommand,
  Unsubscribe,
  UpdateSharedAgreementCommand,
  WorkflowTransitionCommand,
  WorkflowTransitionResult,
} from '@/lib/commercial-network/types';

export type LocalProviderOptions = {
  persistence?: LocalPersistencePort;
  dispatcher?: CommercialNetworkEventDispatcher;
  /** Clock override for deterministic tests. */
  now?: () => string;
};

function ok<T>(data: T): CommercialNetworkResult<T> {
  return { ok: true, data };
}

function fail<T = never>(error: string): CommercialNetworkResult<T> {
  return { ok: false, error };
}

export class LocalCommercialNetworkProvider implements CommercialNetworkProvider {
  readonly providerId = 'local' as const;
  readonly label = 'Local';

  private readonly persistence: LocalPersistencePort;
  private readonly dispatcher: CommercialNetworkEventDispatcher;
  private readonly now: () => string;

  constructor(options: LocalProviderOptions = {}) {
    this.persistence = options.persistence ?? createInMemoryLocalPersistencePort();
    this.dispatcher = options.dispatcher ?? createCommercialNetworkEventDispatcher();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  /** Exposed for tests / projection attachment. */
  getEventDispatcher(): CommercialNetworkEventDispatcher {
    return this.dispatcher;
  }

  async validateConnection(): Promise<{ connected: boolean; error: string | null }> {
    return { connected: true, error: null };
  }

  async createSharedCommercialAgreement(
    command: CreateSharedAgreementCommand
  ): Promise<CommercialNetworkResult<SharedCommercialAgreement>> {
    const occurredAt = command.occurredAt ?? this.now();
    const existing = await this.persistence.getAgreement(command.agreementId);
    if (existing) {
      return fail(`Agreement ${command.agreementId} already exists`);
    }

    const agreement: SharedCommercialAgreement = {
      agreementId: command.agreementId,
      organizationId: command.organizationId,
      ownerUserId: command.ownerUserId ?? null,
      name: command.name,
      partner: command.partner ?? null,
      status: command.status ?? null,
      payload: command.payload ?? {},
      updatedAt: occurredAt,
    };

    await this.persistence.upsertAgreement(agreement);

    await this.dispatcher.dispatch(
      createCommercialNetworkEvent({
        kind: 'AgreementCreated',
        agreementId: agreement.agreementId,
        organizationId: agreement.organizationId,
        occurredAt,
        name: agreement.name,
        payload: agreement.payload,
        providerId: this.providerId,
      })
    );

    return ok(agreement);
  }

  async updateCommercialAgreement(
    command: UpdateSharedAgreementCommand
  ): Promise<CommercialNetworkResult<SharedCommercialAgreement>> {
    const occurredAt = command.occurredAt ?? this.now();
    const existing = await this.persistence.getAgreement(command.agreementId);
    if (!existing) {
      return fail(`Agreement ${command.agreementId} not found`);
    }

    const mergePayload = command.mergePayload !== false;
    const agreement: SharedCommercialAgreement = {
      ...existing,
      organizationId:
        command.organizationId !== undefined
          ? command.organizationId
          : existing.organizationId,
      ownerUserId:
        command.ownerUserId !== undefined ? command.ownerUserId : existing.ownerUserId,
      name: command.name ?? existing.name,
      partner: command.partner !== undefined ? command.partner : existing.partner,
      status: command.status !== undefined ? command.status : existing.status,
      payload:
        command.payload === undefined
          ? existing.payload
          : mergePayload
            ? { ...existing.payload, ...command.payload }
            : command.payload,
      updatedAt: occurredAt,
    };

    await this.persistence.upsertAgreement(agreement);

    await this.dispatcher.dispatch(
      createCommercialNetworkEvent({
        kind: 'AgreementUpdated',
        agreementId: agreement.agreementId,
        organizationId: agreement.organizationId,
        occurredAt,
        name: agreement.name,
        status: agreement.status,
        payload: agreement.payload,
        providerId: this.providerId,
      })
    );

    return ok(agreement);
  }

  async transitionWorkflow(
    command: WorkflowTransitionCommand
  ): Promise<CommercialNetworkResult<WorkflowTransitionResult>> {
    const occurredAt = command.occurredAt ?? this.now();
    const agreement = await this.persistence.getAgreement(command.agreementId);
    if (!agreement) {
      return fail(`Agreement ${command.agreementId} not found`);
    }

    const workflowKey = `workflow:${command.workflow}${
      command.participantId ? `:${command.participantId}` : ''
    }`;
    const nextPayload = {
      ...agreement.payload,
      [workflowKey]: {
        fromState: command.fromState ?? null,
        toState: command.toState,
        reason: command.reason,
        metadata: command.metadata,
        transitionedAt: occurredAt,
      },
    };

    await this.persistence.upsertAgreement({
      ...agreement,
      payload: nextPayload,
      updatedAt: occurredAt,
    });

    if (command.participantId) {
      const participant = await this.persistence.getParticipant(command.participantId);
      if (participant) {
        await this.persistence.upsertParticipant({
          ...participant,
          payload: {
            ...participant.payload,
            [workflowKey]: nextPayload[workflowKey],
          },
          updatedAt: occurredAt,
        });
      }
    }

    const result: WorkflowTransitionResult = {
      agreementId: command.agreementId,
      participantId: command.participantId,
      workflow: command.workflow,
      toState: command.toState,
    };

    await this.dispatcher.dispatch(
      createCommercialNetworkEvent({
        kind: 'WorkflowTransitioned',
        agreementId: command.agreementId,
        organizationId: agreement.organizationId,
        participantId: command.participantId,
        occurredAt,
        workflow: command.workflow,
        fromState: command.fromState,
        toState: command.toState,
        providerId: this.providerId,
        metadata: command.metadata,
      })
    );

    return ok(result);
  }

  async submitParticipantApproval(
    command: ParticipantApprovalCommand
  ): Promise<CommercialNetworkResult<ParticipantApprovalResult>> {
    const occurredAt = command.occurredAt ?? this.now();
    const agreement = await this.persistence.getAgreement(command.agreementId);
    if (!agreement) {
      return fail(`Agreement ${command.agreementId} not found`);
    }

    let participant = await this.persistence.getParticipant(command.participantId);

    if (!participant) {
      // Preserve Local behaviour: approval may create/confirm participant row.
      participant = {
        participantId: command.participantId,
        agreementId: command.agreementId,
        name: `Participant ${command.participantId.slice(0, 8)}`,
        email: null,
        role: null,
        approvalStatus: 'Pending approval',
        approvedAt: null,
        payload: command.inviteToken ? { inviteToken: command.inviteToken } : {},
        updatedAt: occurredAt,
      };
    }

    if (participant.agreementId !== command.agreementId) {
      return fail(
        `Participant ${command.participantId} does not belong to agreement ${command.agreementId}`
      );
    }

    const approved: SharedCommercialParticipant = {
      ...participant,
      approvalStatus: 'Approved',
      approvedAt: occurredAt,
      payload: {
        ...participant.payload,
        approvalStatus: 'Approved',
        approvedAt: occurredAt,
        approvalNote: command.note?.trim() || undefined,
        inviteStatus: 'Opened',
        status: 'Confirmed',
        ...(command.approverUserId
          ? { approverUserId: command.approverUserId }
          : {}),
        ...(command.inviteToken ? { inviteToken: command.inviteToken } : {}),
      },
      updatedAt: occurredAt,
    };

    await this.persistence.upsertParticipant(approved);

    await this.dispatcher.dispatch(
      createCommercialNetworkEvent({
        kind: 'ParticipantApproved',
        agreementId: command.agreementId,
        organizationId: agreement.organizationId,
        participantId: approved.participantId,
        occurredAt,
        approvedAt: occurredAt,
        note: command.note,
        providerId: this.providerId,
      })
    );

    return ok({ agreement, participant: approved });
  }

  async submitSettlementApproval(
    command: SettlementApprovalCommand
  ): Promise<CommercialNetworkResult<SettlementApprovalResult>> {
    const occurredAt = command.occurredAt ?? this.now();
    const agreement = await this.persistence.getAgreement(command.agreementId);
    if (!agreement) {
      return fail(`Agreement ${command.agreementId} not found`);
    }

    const settlementKey = `settlement:${command.settlementId ?? 'default'}`;
    await this.persistence.upsertAgreement({
      ...agreement,
      payload: {
        ...agreement.payload,
        [settlementKey]: {
          status: 'ready',
          approvedBy: command.approvedBy,
          note: command.note,
          metadata: command.metadata,
          approvedAt: occurredAt,
          participantId: command.participantId,
        },
      },
      updatedAt: occurredAt,
    });

    const result: SettlementApprovalResult = {
      agreementId: command.agreementId,
      participantId: command.participantId,
      settlementId: command.settlementId,
      status: 'ready',
    };

    await this.dispatcher.dispatch(
      createCommercialNetworkEvent({
        kind: 'SettlementReady',
        agreementId: command.agreementId,
        organizationId: agreement.organizationId,
        participantId: command.participantId,
        settlementId: command.settlementId,
        occurredAt,
        providerId: this.providerId,
        metadata: command.metadata,
      })
    );

    return ok(result);
  }

  subscribeToWorkflowEvents(handler: CommercialNetworkEventHandler): Unsubscribe {
    return this.dispatcher.subscribe(handler);
  }

  async publishCommercialEvent(
    command: PublishCommercialNetworkEventCommand
  ): Promise<CommercialNetworkResult<CommercialNetworkEvent>> {
    const event: CommercialNetworkEvent = {
      ...command.event,
      providerId: command.event.providerId ?? this.providerId,
    };
    await this.dispatcher.dispatch(event);
    return ok(event);
  }

  async synchronizeSharedState(
    command: SynchronizeSharedStateCommand
  ): Promise<CommercialNetworkResult<SharedCommercialSnapshot>> {
    if (command.snapshot) {
      const synced = await this.persistence.synchronizeSnapshot({
        ownerUserId: command.ownerUserId,
        organizationId: command.organizationId,
        snapshot: command.snapshot,
      });
      return ok(synced);
    }

    const loaded = await this.persistence.loadSnapshot({
      ownerUserId: command.ownerUserId,
      organizationId: command.organizationId,
      agreementId: command.agreementId,
    });
    return ok(loaded);
  }
}

/** Factory used by the provider registry. */
export function createLocalCommercialNetworkProvider(
  options?: LocalProviderOptions
): LocalCommercialNetworkProvider {
  return new LocalCommercialNetworkProvider(options);
}
