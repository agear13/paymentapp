/**
 * Projection Service
 *
 * Commercial Network
 *       ↓
 * Commercial Network Events
 *       ↓
 * Commercial Domain Read Models
 *
 * Mirrors how future Canton ledger events will update Provvypay projections.
 * Pure projection math — no forecasting / automation / accounting ownership.
 */

import type { CommercialNetworkEvent } from '@/lib/commercial-network/events';
import type {
  AgreementProjection,
  CommercialDomainReadModels,
  CommercialNetworkEventHandler,
  ParticipantProjection,
  SettlementProjection,
  Unsubscribe,
  WorkflowProjection,
} from '@/lib/commercial-network/types';
import type { CommercialNetworkEventDispatcher } from '@/lib/commercial-network/event-dispatcher';

export type ProjectionService = {
  /** Apply a single network event to read models. */
  project(event: CommercialNetworkEvent): void;
  /** Subscribe to a dispatcher and project every event. */
  attach(dispatcher: CommercialNetworkEventDispatcher): Unsubscribe;
  getReadModels(): CommercialDomainReadModels;
  getAgreement(agreementId: string): AgreementProjection | undefined;
  getParticipant(participantId: string): ParticipantProjection | undefined;
  getWorkflow(key: string): WorkflowProjection | undefined;
  getSettlement(key: string): SettlementProjection | undefined;
  reset(): void;
};

function workflowKey(agreementId: string, workflow: string, participantId?: string): string {
  return participantId
    ? `${agreementId}:${workflow}:${participantId}`
    : `${agreementId}:${workflow}`;
}

function settlementKey(
  agreementId: string,
  settlementId?: string,
  participantId?: string
): string {
  return `${agreementId}:${settlementId ?? 'default'}:${participantId ?? 'agreement'}`;
}

export function createEmptyReadModels(): CommercialDomainReadModels {
  return {
    agreements: new Map(),
    workflows: new Map(),
    participants: new Map(),
    settlements: new Map(),
  };
}

export function createProjectionService(
  initial?: CommercialDomainReadModels
): ProjectionService {
  const models = initial ?? createEmptyReadModels();

  const project: CommercialNetworkEventHandler = (event) => {
    switch (event.kind) {
      case 'AgreementCreated': {
        const existing = models.agreements.get(event.agreementId);
        models.agreements.set(event.agreementId, {
          agreementId: event.agreementId,
          name: event.name,
          status: null,
          organizationId: event.organizationId ?? null,
          lastEventKind: event.kind,
          lastEventAt: event.occurredAt,
          version: (existing?.version ?? 0) + 1,
        });
        break;
      }
      case 'AgreementUpdated': {
        const existing = models.agreements.get(event.agreementId);
        models.agreements.set(event.agreementId, {
          agreementId: event.agreementId,
          name: event.name ?? existing?.name ?? event.agreementId,
          status: event.status !== undefined ? event.status : (existing?.status ?? null),
          organizationId:
            event.organizationId !== undefined
              ? event.organizationId
              : (existing?.organizationId ?? null),
          lastEventKind: event.kind,
          lastEventAt: event.occurredAt,
          version: (existing?.version ?? 0) + 1,
        });
        break;
      }
      case 'WorkflowTransitioned': {
        const key = workflowKey(event.agreementId, event.workflow, event.participantId);
        const existing = models.workflows.get(key);
        models.workflows.set(key, {
          agreementId: event.agreementId,
          participantId: event.participantId,
          workflow: event.workflow,
          state: event.toState,
          lastTransitionAt: event.occurredAt,
          version: (existing?.version ?? 0) + 1,
        });
        break;
      }
      case 'ParticipantApproved': {
        const existing = models.participants.get(event.participantId);
        models.participants.set(event.participantId, {
          participantId: event.participantId,
          agreementId: event.agreementId,
          approvalStatus: 'Approved',
          approvedAt: event.approvedAt,
          lastEventKind: event.kind,
          lastEventAt: event.occurredAt,
          version: (existing?.version ?? 0) + 1,
        });
        break;
      }
      case 'SettlementReady': {
        const key = settlementKey(event.agreementId, event.settlementId, event.participantId);
        const existing = models.settlements.get(key);
        models.settlements.set(key, {
          agreementId: event.agreementId,
          participantId: event.participantId,
          settlementId: event.settlementId,
          status: 'ready',
          lastEventKind: event.kind,
          lastEventAt: event.occurredAt,
          version: (existing?.version ?? 0) + 1,
        });
        break;
      }
      case 'SettlementReleased': {
        const key = settlementKey(event.agreementId, event.settlementId, event.participantId);
        const existing = models.settlements.get(key);
        models.settlements.set(key, {
          agreementId: event.agreementId,
          participantId: event.participantId,
          settlementId: event.settlementId,
          status: 'released',
          lastEventKind: event.kind,
          lastEventAt: event.occurredAt,
          version: (existing?.version ?? 0) + 1,
        });
        break;
      }
      case 'CommercialForecastUpdated':
      case 'AutomationExecuted': {
        // Network acknowledges domain-side activities; agreement projection stamp only.
        const existing = models.agreements.get(event.agreementId);
        if (existing) {
          models.agreements.set(event.agreementId, {
            ...existing,
            lastEventKind: event.kind,
            lastEventAt: event.occurredAt,
            version: existing.version + 1,
          });
        }
        break;
      }
      default: {
        const _exhaustive: never = event;
        void _exhaustive;
      }
    }
  };

  return {
    project,
    attach(dispatcher) {
      return dispatcher.subscribe(project);
    },
    getReadModels() {
      return models;
    },
    getAgreement(agreementId) {
      return models.agreements.get(agreementId);
    },
    getParticipant(participantId) {
      return models.participants.get(participantId);
    },
    getWorkflow(key) {
      return models.workflows.get(key);
    },
    getSettlement(key) {
      return models.settlements.get(key);
    },
    reset() {
      models.agreements.clear();
      models.workflows.clear();
      models.participants.clear();
      models.settlements.clear();
    },
  };
}
