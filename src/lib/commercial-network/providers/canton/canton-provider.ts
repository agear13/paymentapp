/**
 * Canton Commercial Network Provider
 *
 * CommercialNetworkProvider interface is unchanged.
 * Ledger backend is swappable via CantonLedgerAdapter:
 *   - simulated → CantonLedgerRuntime (unit tests / default)
 *   - localnet  → Quickstart JSON Ledger API (real LocalNet)
 *
 * Provvypay Commercial Domain never knows which adapter is used.
 */

import type { CommercialNetworkProvider } from '@/lib/commercial-network/commercial-network-provider';
import type { CommercialNetworkEvent } from '@/lib/commercial-network/events';
import {
  createCommercialNetworkEventDispatcher,
  type CommercialNetworkEventDispatcher,
} from '@/lib/commercial-network/event-dispatcher';
import type { CantonLedgerAdapter } from '@/lib/commercial-network/providers/canton/canton-ledger-adapter';
import { createSimulatedCantonLedgerAdapter } from '@/lib/commercial-network/providers/canton/simulated-canton-ledger-adapter';
import {
  createLocalNetJsonApiAdapter,
  localNetConfigFromEnv,
} from '@/lib/commercial-network/providers/canton/localnet-json-api-adapter';
import { resolveCantonLedgerMode } from '@/lib/commercial-network/providers/canton/resolve-canton-ledger-mode';
import type {
  RequiredParticipant,
  SharedTerms,
} from '@/lib/commercial-network/providers/canton/workflow-types';
import type { CantonLedgerRuntime } from '@/lib/commercial-network/providers/canton/canton-ledger-runtime';
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
import { getCantonExtensionPoints } from '@/lib/commercial-network/extensions/canton-extension-points';

function ok<T>(data: T): CommercialNetworkResult<T> {
  return { ok: true, data };
}

function fail<T = never>(error: string): CommercialNetworkResult<T> {
  return { ok: false, error };
}

function asRequiredParticipants(
  payload: Record<string, unknown> | undefined
): RequiredParticipant[] {
  const raw = payload?.requiredParticipants;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      'Canton create requires payload.requiredParticipants: { party, role }[]'
    );
  }
  return raw.map((item) => {
    const row = item as { party?: string; role?: string };
    if (!row.party || !row.role) {
      throw new Error('Each required participant needs party and role');
    }
    return { party: row.party, role: row.role };
  });
}

function asSharedTerms(
  command: CreateSharedAgreementCommand,
  payload: Record<string, unknown>
): SharedTerms {
  return {
    provvypayAgreementId: command.agreementId,
    revision: typeof payload.revision === 'number' ? payload.revision : 0,
    title: command.name,
    currency: typeof payload.currency === 'string' ? payload.currency : 'AUD',
    summary:
      typeof payload.summary === 'string'
        ? payload.summary
        : command.partner
          ? `Commercial agreement with ${command.partner}`
          : command.name,
  };
}

async function agreementFromProjection(
  agreementId: string,
  organizationId: string | null,
  adapter: CantonLedgerAdapter
): Promise<SharedCommercialAgreement | null> {
  const projection = await adapter.project(agreementId);
  if (!projection) return null;
  return {
    agreementId,
    organizationId,
    name: projection.title,
    partner: null,
    status: projection.stage,
    payload: {
      stage: projection.stage,
      revision: projection.revision,
      currency: projection.currency,
      summary: projection.summary,
      platformParty: projection.platformParty,
      platformDisplayName: projection.platformDisplayName,
      requiredParticipants: projection.requiredParticipants,
      acceptedParties: projection.acceptedParties,
      pendingRoles: projection.pendingRoles,
      proposalContractId: projection.proposalContractId,
      agreementContractId: projection.agreementContractId,
      settlementReadyContractId: projection.settlementReadyContractId,
      ledgerMode: adapter.mode,
    },
    updatedAt: projection.updatedAt,
  };
}

export type CantonProviderOptions = {
  dispatcher?: CommercialNetworkEventDispatcher;
  /** Inject adapter (tests). When omitted, resolved from CANTON_LEDGER_MODE. */
  adapter?: CantonLedgerAdapter;
  /** @deprecated Prefer adapter. Kept for tests that inject a simulated runtime. */
  runtime?: CantonLedgerRuntime;
  defaultPlatformParty?: string;
  now?: () => string;
};

function createDefaultAdapter(
  options: CantonProviderOptions,
  dispatcher: CommercialNetworkEventDispatcher
): CantonLedgerAdapter {
  if (options.adapter) return options.adapter;

  if (options.runtime) {
    return createSimulatedCantonLedgerAdapter({
      runtime: options.runtime,
      dispatcher,
      now: options.now,
    });
  }

  const mode = resolveCantonLedgerMode();
  if (mode === 'localnet') {
    return createLocalNetJsonApiAdapter(localNetConfigFromEnv());
  }

  return createSimulatedCantonLedgerAdapter({
    dispatcher,
    now: options.now,
  });
}

export class CantonCommercialNetworkProvider implements CommercialNetworkProvider {
  readonly providerId = 'canton' as const;
  readonly label = 'Canton';

  private readonly dispatcher: CommercialNetworkEventDispatcher;
  private readonly adapter: CantonLedgerAdapter;
  private readonly defaultPlatformParty: string;
  private readonly orgByAgreement = new Map<string, string | null>();
  private readonly adapterSubscription: Unsubscribe;

  constructor(options: CantonProviderOptions = {}) {
    this.dispatcher = options.dispatcher ?? createCommercialNetworkEventDispatcher();
    this.adapter = createDefaultAdapter(options, this.dispatcher);
    this.defaultPlatformParty =
      options.defaultPlatformParty ?? 'party::provvypay-platform';

    // LocalNet adapter emits ledger events → CNL dispatcher → Projection Service.
    // Simulated runtime already writes to the same dispatcher when shared.
    this.adapterSubscription =
      this.adapter.mode === 'localnet'
        ? this.adapter.subscribe((event) => {
            void this.dispatcher.dispatch(event);
          })
        : () => undefined;
  }

  /** Ledger mode currently backing this provider. */
  getLedgerMode() {
    return this.adapter.mode;
  }

  /**
   * Simulated runtime only — for unit tests / demo helpers.
   * Prefer projections via Commercial Network events in product code.
   */
  getRuntime(): CantonLedgerRuntime {
    const runtime = this.adapter.getSimulatedRuntime?.();
    if (!runtime) {
      throw new Error(
        'getRuntime() is only available in simulated ledger mode'
      );
    }
    return runtime;
  }

  getEventDispatcher(): CommercialNetworkEventDispatcher {
    return this.dispatcher;
  }

  /** Unsubscribe LocalNet adapter → dispatcher bridge (no-op in simulated mode). */
  dispose(): void {
    this.adapterSubscription();
  }

  listExtensionPoints() {
    return getCantonExtensionPoints().map((p) => ({
      ...p,
      implemented: true,
    }));
  }

  async validateConnection(): Promise<{ connected: boolean; error: string | null }> {
    return this.adapter.validateConnection();
  }

  async createSharedCommercialAgreement(
    command: CreateSharedAgreementCommand
  ): Promise<CommercialNetworkResult<SharedCommercialAgreement>> {
    try {
      const payload = command.payload ?? {};
      const platform =
        typeof payload.platformParty === 'string'
          ? payload.platformParty
          : this.defaultPlatformParty;
      const requiredParticipants = asRequiredParticipants(payload);
      const sharedTerms = asSharedTerms(command, payload);

      await this.adapter.createProposal({
        platform,
        requiredParticipants,
        sharedTerms,
      });
      this.orgByAgreement.set(command.agreementId, command.organizationId);

      const agreement = await agreementFromProjection(
        command.agreementId,
        command.organizationId,
        this.adapter
      );
      if (!agreement) return fail('Failed to project created proposal');
      return ok(agreement);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }

  async updateCommercialAgreement(
    command: UpdateSharedAgreementCommand
  ): Promise<CommercialNetworkResult<SharedCommercialAgreement>> {
    // Ledger terms are immutable — revisions require a new Proposal off-ledger then create.
    const org = this.orgByAgreement.get(command.agreementId) ?? null;
    const existing = await agreementFromProjection(
      command.agreementId,
      org,
      this.adapter
    );
    if (!existing) {
      return fail(`Agreement ${command.agreementId} not found on Canton`);
    }
    return fail(
      'Canton does not patch bound terms in place. Reject/withdraw and create a new Proposal revision.'
    );
  }

  async transitionWorkflow(
    command: WorkflowTransitionCommand
  ): Promise<CommercialNetworkResult<WorkflowTransitionResult>> {
    try {
      if (command.toState === 'SettlementReady' || command.workflow === 'settlement') {
        const agreement = await this.adapter.getActiveAgreement(command.agreementId);
        if (!agreement) {
          return fail('CommercialAgreement not bound yet');
        }
        await this.adapter.declareSettlementReady({
          agreementContractId: agreement.contractId,
          platform: agreement.platform,
        });
        return ok({
          agreementId: command.agreementId,
          participantId: command.participantId,
          workflow: command.workflow,
          toState: 'SettlementReady',
        });
      }
      return fail(
        `Unsupported Canton workflow transition: ${command.workflow} → ${command.toState}`
      );
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }

  async submitParticipantApproval(
    command: ParticipantApprovalCommand
  ): Promise<CommercialNetworkResult<ParticipantApprovalResult>> {
    try {
      let open = await this.adapter.getActiveProposal(command.agreementId);
      if (!open && command.inviteToken) {
        // inviteToken may carry the proposal contract id
        open = {
          templateId: 'CommercialAgreementProposal',
          contractId: command.inviteToken,
          platform: this.defaultPlatformParty,
          requiredParticipants: [],
          accepted: [],
          sharedTerms: {
            provvypayAgreementId: command.agreementId,
            revision: 0,
            title: '',
            currency: 'AUD',
            summary: '',
          },
          active: true,
        };
      }
      if (!open) {
        return fail(`No open CommercialAgreementProposal for ${command.agreementId}`);
      }

      const party = command.participantId;
      const result = await this.adapter.accept({
        proposalContractId: open.contractId,
        actor: party,
      });

      const org = this.orgByAgreement.get(command.agreementId) ?? null;
      const agreement = await agreementFromProjection(
        command.agreementId,
        org,
        this.adapter
      );
      if (!agreement) return fail('Projection missing after accept');

      const roleFromProjection =
        (agreement.payload.requiredParticipants as RequiredParticipant[] | undefined)?.find(
          (r) => r.party === party
        )?.role ?? null;

      const participant: SharedCommercialParticipant = {
        participantId: party,
        agreementId: command.agreementId,
        name: party,
        role: roleFromProjection,
        approvalStatus: 'Approved',
        approvedAt: command.occurredAt ?? new Date().toISOString(),
        payload: {
          acceptResult: result,
          platformDisplayName: 'Provvypay Platform',
          ledgerMode: this.adapter.mode,
        },
        updatedAt: command.occurredAt ?? new Date().toISOString(),
      };

      return ok({ agreement, participant });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }

  async submitSettlementApproval(
    command: SettlementApprovalCommand
  ): Promise<CommercialNetworkResult<SettlementApprovalResult>> {
    try {
      const agreement = await this.adapter.getActiveAgreement(command.agreementId);
      if (!agreement) {
        return fail('CommercialAgreement must be Bound before SettlementReady');
      }
      const ready = await this.adapter.declareSettlementReady({
        agreementContractId: agreement.contractId,
        platform: agreement.platform,
      });
      return ok({
        agreementId: command.agreementId,
        participantId: command.participantId,
        settlementId: ready.settlementReadyContractId,
        status: 'ready',
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }

  subscribeToWorkflowEvents(handler: CommercialNetworkEventHandler): Unsubscribe {
    const unsubDispatcher = this.dispatcher.subscribe(handler);
    return () => {
      unsubDispatcher();
    };
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
    const agreements: SharedCommercialAgreement[] = [];
    const participants: SharedCommercialParticipant[] = [];

    const ids = command.agreementId
      ? [command.agreementId]
      : [...this.orgByAgreement.keys()];

    for (const agreementId of ids) {
      const org =
        command.organizationId !== undefined
          ? command.organizationId
          : (this.orgByAgreement.get(agreementId) ?? null);
      const agreement = await agreementFromProjection(
        agreementId,
        org,
        this.adapter
      );
      if (!agreement) continue;
      agreements.push(agreement);

      const projection = await this.adapter.project(agreementId);
      if (!projection) continue;
      for (const party of projection.acceptedParties) {
        const role =
          projection.requiredParticipants.find((r) => r.party === party)?.role ??
          null;
        participants.push({
          participantId: party,
          agreementId,
          name: party,
          role,
          approvalStatus: 'Approved',
          approvedAt: projection.updatedAt,
          payload: {
            platformDisplayName: 'Provvypay Platform',
            ledgerMode: this.adapter.mode,
          },
          updatedAt: projection.updatedAt,
        });
      }
    }

    return ok({ agreements, participants });
  }
}

export function createCantonCommercialNetworkProvider(
  options?: CantonProviderOptions
): CantonCommercialNetworkProvider {
  return new CantonCommercialNetworkProvider(options);
}
