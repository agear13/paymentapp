/**
 * In-process Canton workflow runtime.
 *
 * Faithfully mirrors SharedCommercialAgreement.Workflow Daml semantics for:
 *   - deterministic HackCanton demos
 *   - unit / e2e tests without LocalNet
 *   - Commercial Network Canton Provider when JSON Ledger API is unavailable
 *
 * When cn-quickstart LocalNet is running, a future adapter can swap this for
 * Ledger API Create/Exercise commands against the same DAR — without changing
 * the Commercial Domain or CNL interface.
 */

import {
  createCommercialNetworkEvent,
  type CommercialNetworkEvent,
} from '@/lib/commercial-network/events';
import type { CommercialNetworkEventDispatcher } from '@/lib/commercial-network/event-dispatcher';
import type { CantonWorkflowPersistedState } from '@/lib/commercial-network/canton-workflow-persistence';
import {
  allRequiredAccepted,
  pendingRoles,
  type CantonWorkflowContract,
  type CantonWorkflowProjection,
  type CantonWorkflowStage,
  type CommercialAgreementContract,
  type CommercialAgreementProposalContract,
  type ProposalAcceptResult,
  type RequiredParticipant,
  type SettlementReadyContract,
  type SharedTerms,
} from '@/lib/commercial-network/providers/canton/workflow-types';

export type CantonLedgerRuntime = {
  createProposal(input: {
    platform: string;
    requiredParticipants: RequiredParticipant[];
    sharedTerms: SharedTerms;
  }): CommercialAgreementProposalContract;

  accept(input: {
    proposalContractId: string;
    actor: string;
  }): ProposalAcceptResult;

  reject(input: { proposalContractId: string; actor: string }): void;

  withdraw(input: { proposalContractId: string; platform: string }): void;

  declareSettlementReady(input: {
    agreementContractId: string;
    platform: string;
  }): SettlementReadyContract;

  getContract(contractId: string): CantonWorkflowContract | null;

  getActiveProposal(
    provvypayAgreementId: string
  ): CommercialAgreementProposalContract | null;

  getActiveAgreement(
    provvypayAgreementId: string
  ): CommercialAgreementContract | null;

  getSettlementReady(
    provvypayAgreementId: string
  ): SettlementReadyContract | null;

  project(provvypayAgreementId: string): CantonWorkflowProjection | null;

  listActiveContracts(): CantonWorkflowContract[];

  /** Reconstruct in-memory contracts from Postgres-persisted workflow state. */
  hydrateAgreement(state: CantonWorkflowPersistedState): void;

  reset(): void;
};

function newCid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function createCantonLedgerRuntime(options?: {
  dispatcher?: CommercialNetworkEventDispatcher;
  now?: () => string;
}): CantonLedgerRuntime {
  const contracts = new Map<string, CantonWorkflowContract>();
  const dispatcher = options?.dispatcher;
  const now = options?.now ?? (() => new Date().toISOString());

  async function emit(event: CommercialNetworkEvent): Promise<void> {
    if (dispatcher) {
      await dispatcher.dispatch(event);
    }
  }

  function getActiveProposal(
    provvypayAgreementId: string
  ): CommercialAgreementProposalContract | null {
    for (const c of contracts.values()) {
      if (
        c.templateId === 'CommercialAgreementProposal' &&
        c.active &&
        c.sharedTerms.provvypayAgreementId === provvypayAgreementId
      ) {
        return c;
      }
    }
    return null;
  }

  function getActiveAgreement(
    provvypayAgreementId: string
  ): CommercialAgreementContract | null {
    for (const c of contracts.values()) {
      if (
        c.templateId === 'CommercialAgreement' &&
        c.active &&
        c.sharedTerms.provvypayAgreementId === provvypayAgreementId
      ) {
        return c;
      }
    }
    return null;
  }

  function getSettlementReady(
    provvypayAgreementId: string
  ): SettlementReadyContract | null {
    for (const c of contracts.values()) {
      if (
        c.templateId === 'SettlementReady' &&
        c.active &&
        c.agreementProvvypayId === provvypayAgreementId
      ) {
        return c;
      }
    }
    return null;
  }

  function project(provvypayAgreementId: string): CantonWorkflowProjection | null {
    const ready = getSettlementReady(provvypayAgreementId);
    const agreement = getActiveAgreement(provvypayAgreementId);
    const proposal = getActiveProposal(provvypayAgreementId);

    let stage: CantonWorkflowStage;
    let sharedTerms: SharedTerms | null = null;
    let platformParty = '';
    let required: RequiredParticipant[] = [];
    let accepted: string[] = [];

    if (ready) {
      stage = 'SettlementReady';
      sharedTerms = ready.sharedTerms;
      platformParty = ready.platform;
      required = ready.requiredParticipants;
      accepted = required.map((r) => r.party);
    } else if (agreement) {
      stage = 'Bound';
      sharedTerms = agreement.sharedTerms;
      platformParty = agreement.platform;
      required = agreement.requiredParticipants;
      accepted = required.map((r) => r.party);
    } else if (proposal) {
      stage =
        proposal.accepted.length === 0 ? 'Proposed' : 'PartiallyBound';
      sharedTerms = proposal.sharedTerms;
      platformParty = proposal.platform;
      required = proposal.requiredParticipants;
      accepted = [...proposal.accepted];
    } else {
      return null;
    }

    return {
      provvypayAgreementId,
      stage,
      revision: sharedTerms.revision,
      title: sharedTerms.title,
      currency: sharedTerms.currency,
      summary: sharedTerms.summary,
      platformParty,
      platformDisplayName: 'Provvypay Platform',
      requiredParticipants: required,
      acceptedParties: accepted,
      pendingRoles: pendingRoles(required, accepted),
      proposalContractId: proposal?.contractId ?? null,
      agreementContractId: agreement?.contractId ?? null,
      settlementReadyContractId: ready?.contractId ?? null,
      updatedAt: now(),
    };
  }

  return {
    createProposal({ platform, requiredParticipants, sharedTerms }) {
      assert(requiredParticipants.length > 0, 'requiredParticipants must not be empty');
      assert(sharedTerms.revision >= 0, 'revision must be >= 0');

      // Archive any prior open proposal for same agreement id (re-propose after reject).
      const prior = getActiveProposal(sharedTerms.provvypayAgreementId);
      if (prior) {
        prior.active = false;
      }

      const contract: CommercialAgreementProposalContract = {
        templateId: 'CommercialAgreementProposal',
        contractId: newCid('prop'),
        platform,
        requiredParticipants: [...requiredParticipants],
        accepted: [],
        sharedTerms: { ...sharedTerms },
        active: true,
      };
      contracts.set(contract.contractId, contract);

      void emit(
        createCommercialNetworkEvent({
          kind: 'AgreementCreated',
          agreementId: sharedTerms.provvypayAgreementId,
          occurredAt: now(),
          name: sharedTerms.title,
          providerId: 'canton',
          payload: {
            stage: 'Proposed',
            contractId: contract.contractId,
            platformDisplayName: 'Provvypay Platform',
            requiredParticipants,
          },
        })
      );

      return contract;
    },

    accept({ proposalContractId, actor }) {
      const proposal = contracts.get(proposalContractId);
      assert(
        !!proposal &&
          proposal.templateId === 'CommercialAgreementProposal' &&
          proposal.active,
        'Active CommercialAgreementProposal not found'
      );
      assert(
        proposal.requiredParticipants.some((r) => r.party === actor),
        'Accepting party must be a required participant'
      );
      assert(
        !proposal.accepted.includes(actor),
        'Accepting party must not have already accepted'
      );

      proposal.active = false;
      const nextAccepted = [actor, ...proposal.accepted];

      if (allRequiredAccepted(proposal.requiredParticipants, nextAccepted)) {
        const agreement: CommercialAgreementContract = {
          templateId: 'CommercialAgreement',
          contractId: newCid('agr'),
          platform: proposal.platform,
          requiredParticipants: [...proposal.requiredParticipants],
          sharedTerms: { ...proposal.sharedTerms },
          active: true,
        };
        contracts.set(agreement.contractId, agreement);

        void emit(
          createCommercialNetworkEvent({
            kind: 'ParticipantApproved',
            agreementId: proposal.sharedTerms.provvypayAgreementId,
            participantId: actor,
            occurredAt: now(),
            approvedAt: now(),
            providerId: 'canton',
            metadata: { stage: 'Bound', agreementContractId: agreement.contractId },
          })
        );
        void emit(
          createCommercialNetworkEvent({
            kind: 'AgreementUpdated',
            agreementId: proposal.sharedTerms.provvypayAgreementId,
            occurredAt: now(),
            name: proposal.sharedTerms.title,
            status: 'Bound',
            providerId: 'canton',
          })
        );

        return { kind: 'Bound', agreementContractId: agreement.contractId };
      }

      const nextProposal: CommercialAgreementProposalContract = {
        templateId: 'CommercialAgreementProposal',
        contractId: newCid('prop'),
        platform: proposal.platform,
        requiredParticipants: [...proposal.requiredParticipants],
        accepted: nextAccepted,
        sharedTerms: { ...proposal.sharedTerms },
        active: true,
      };
      contracts.set(nextProposal.contractId, nextProposal);

      void emit(
        createCommercialNetworkEvent({
          kind: 'ParticipantApproved',
          agreementId: proposal.sharedTerms.provvypayAgreementId,
          participantId: actor,
          occurredAt: now(),
          approvedAt: now(),
          providerId: 'canton',
          metadata: {
            stage: 'PartiallyBound',
            proposalContractId: nextProposal.contractId,
            pendingRoles: pendingRoles(
              nextProposal.requiredParticipants,
              nextAccepted
            ),
          },
        })
      );

      return { kind: 'StillOpen', proposalContractId: nextProposal.contractId };
    },

    reject({ proposalContractId, actor }) {
      const proposal = contracts.get(proposalContractId);
      assert(
        !!proposal &&
          proposal.templateId === 'CommercialAgreementProposal' &&
          proposal.active,
        'Active CommercialAgreementProposal not found'
      );
      assert(
        proposal.requiredParticipants.some((r) => r.party === actor),
        'Rejecting party must be a required participant'
      );
      assert(
        !proposal.accepted.includes(actor),
        'Rejecting party must not have already accepted'
      );
      proposal.active = false;

      void emit(
        createCommercialNetworkEvent({
          kind: 'AgreementUpdated',
          agreementId: proposal.sharedTerms.provvypayAgreementId,
          occurredAt: now(),
          name: proposal.sharedTerms.title,
          status: 'Rejected',
          providerId: 'canton',
          metadata: { rejectedBy: actor },
        })
      );
    },

    withdraw({ proposalContractId, platform }) {
      const proposal = contracts.get(proposalContractId);
      assert(
        !!proposal &&
          proposal.templateId === 'CommercialAgreementProposal' &&
          proposal.active,
        'Active CommercialAgreementProposal not found'
      );
      assert(proposal.platform === platform, 'Only Platform may withdraw');
      proposal.active = false;

      void emit(
        createCommercialNetworkEvent({
          kind: 'AgreementUpdated',
          agreementId: proposal.sharedTerms.provvypayAgreementId,
          occurredAt: now(),
          name: proposal.sharedTerms.title,
          status: 'Withdrawn',
          providerId: 'canton',
        })
      );
    },

    declareSettlementReady({ agreementContractId, platform }) {
      const agreement = contracts.get(agreementContractId);
      assert(
        !!agreement &&
          agreement.templateId === 'CommercialAgreement' &&
          agreement.active,
        'Active CommercialAgreement not found'
      );
      assert(agreement.platform === platform, 'Only Platform may declare SettlementReady');

      const ready: SettlementReadyContract = {
        templateId: 'SettlementReady',
        contractId: newCid('ready'),
        platform: agreement.platform,
        requiredParticipants: [...agreement.requiredParticipants],
        sharedTerms: { ...agreement.sharedTerms },
        agreementProvvypayId: agreement.sharedTerms.provvypayAgreementId,
        active: true,
      };
      contracts.set(ready.contractId, ready);

      void emit(
        createCommercialNetworkEvent({
          kind: 'SettlementReady',
          agreementId: agreement.sharedTerms.provvypayAgreementId,
          settlementId: ready.contractId,
          occurredAt: now(),
          providerId: 'canton',
          metadata: {
            platformDisplayName: 'Provvypay Platform',
            stage: 'SettlementReady',
          },
        })
      );

      return ready;
    },

    getContract(contractId) {
      return contracts.get(contractId) ?? null;
    },

    getActiveProposal,
    getActiveAgreement,
    getSettlementReady,
    project,

    listActiveContracts() {
      return [...contracts.values()].filter((c) => c.active);
    },

    hydrateAgreement(state) {
      const agreementId = state.provvypayAgreementId;
      for (const [cid, contract] of [...contracts.entries()]) {
        const matches =
          (contract.templateId === 'CommercialAgreementProposal' &&
            contract.sharedTerms.provvypayAgreementId === agreementId) ||
          (contract.templateId === 'CommercialAgreement' &&
            contract.sharedTerms.provvypayAgreementId === agreementId) ||
          (contract.templateId === 'SettlementReady' &&
            contract.agreementProvvypayId === agreementId);
        if (matches) contracts.delete(cid);
      }

      if (
        state.proposalContractId &&
        (state.stage === 'Proposed' || state.stage === 'PartiallyBound')
      ) {
        const proposal: CommercialAgreementProposalContract = {
          templateId: 'CommercialAgreementProposal',
          contractId: state.proposalContractId,
          platform: state.platformParty,
          requiredParticipants: [...state.requiredParticipants],
          accepted: [...state.acceptedParties],
          sharedTerms: { ...state.sharedTerms },
          active: true,
        };
        contracts.set(proposal.contractId, proposal);
      }

      if (
        state.agreementContractId &&
        (state.stage === 'Bound' || state.stage === 'SettlementReady')
      ) {
        const agreement: CommercialAgreementContract = {
          templateId: 'CommercialAgreement',
          contractId: state.agreementContractId,
          platform: state.platformParty,
          requiredParticipants: [...state.requiredParticipants],
          sharedTerms: { ...state.sharedTerms },
          active: true,
        };
        contracts.set(agreement.contractId, agreement);
      }

      if (state.settlementReadyContractId && state.stage === 'SettlementReady') {
        const ready: SettlementReadyContract = {
          templateId: 'SettlementReady',
          contractId: state.settlementReadyContractId,
          platform: state.platformParty,
          requiredParticipants: [...state.requiredParticipants],
          sharedTerms: { ...state.sharedTerms },
          agreementProvvypayId: agreementId,
          active: true,
        };
        contracts.set(ready.contractId, ready);
      }
    },

    reset() {
      contracts.clear();
    },
  };
}
