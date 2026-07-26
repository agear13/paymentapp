/**
 * LocalNet JSON Ledger API adapter (Quickstart-aligned).
 *
 * Talks to the participant JSON API the same way Quickstart scripts do
 * (see docker/create-app-install-request/run.sh and docs JSON API tutorial).
 *
 * Mediates: Create / Exercise only. No business logic.
 */

import {
  createCommercialNetworkEvent,
  type CommercialNetworkEvent,
} from '@/lib/commercial-network/events';
import type {
  CantonLedgerAdapter,
  CantonLedgerEventHandler,
  LocalNetAdapterConfig,
} from '@/lib/commercial-network/providers/canton/canton-ledger-adapter';
import {
  allRequiredAccepted,
  pendingRoles,
  type CantonWorkflowProjection,
  type CantonWorkflowStage,
  type CommercialAgreementContract,
  type CommercialAgreementProposalContract,
  type ProposalAcceptResult,
  type RequiredParticipant,
  type SettlementReadyContract,
  type SharedTerms,
} from '@/lib/commercial-network/providers/canton/workflow-types';

type Json = Record<string, unknown>;

type TrackedState = {
  platform: string;
  requiredParticipants: RequiredParticipant[];
  sharedTerms: SharedTerms;
  accepted: string[];
  proposalContractId: string | null;
  agreementContractId: string | null;
  settlementReadyContractId: string | null;
  stage: CantonWorkflowStage;
};

function templateId(config: LocalNetAdapterConfig, template: string): string {
  return `#${config.packageName}:${config.moduleName}:${template}`;
}

function commandId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLocalNetJsonApiAdapter(
  config: LocalNetAdapterConfig
): CantonLedgerAdapter {
  const fetchFn = config.fetchImpl ?? fetch;
  const handlers = new Set<CantonLedgerEventHandler>();
  const byAgreement = new Map<string, TrackedState>();

  async function emit(event: CommercialNetworkEvent): Promise<void> {
    for (const handler of [...handlers]) {
      await handler(event);
    }
  }

  function endpointFor(party: string): { baseUrl: string; token: string } {
    return {
      baseUrl: (config.partyJsonApiBaseUrl?.[party] ?? config.jsonApiBaseUrl).replace(
        /\/$/,
        ''
      ),
      token: config.partyAuthToken?.[party] ?? config.authToken,
    };
  }

  async function submitAndWait(
    party: string,
    body: Json
  ): Promise<Json> {
    const { baseUrl, token } = endpointFor(party);
    const res = await fetchFn(`${baseUrl}/v2/commands/submit-and-wait-for-transaction-tree`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Ledger API ${res.status}: ${text}`);
    }
    return text ? (JSON.parse(text) as Json) : {};
  }

  function extractCreatedContractIds(tree: Json): Array<{
    contractId: string;
    templateId: string;
  }> {
    const results: Array<{ contractId: string; templateId: string }> = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const obj = node as Json;
      const created =
        (obj.CreatedEvent as Json | undefined) ??
        (obj.created as Json | undefined) ??
        ((obj.kind as Json | undefined)?.CreatedEvent as Json | undefined);
      if (created && typeof created.contractId === 'string') {
        const tid =
          typeof created.templateId === 'string'
            ? created.templateId
            : typeof (created.templateId as Json | undefined)?.entityName === 'string'
              ? String((created.templateId as Json).entityName)
              : '';
        results.push({ contractId: created.contractId, templateId: tid });
      }
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) value.forEach(walk);
        else walk(value);
      }
    };
    walk(tree);
    return results;
  }

  function findCreated(
    tree: Json,
    templateSuffix: string
  ): string | null {
    const created = extractCreatedContractIds(tree);
    const match = created.find(
      (c) =>
        c.templateId.endsWith(`:${templateSuffix}`) ||
        c.templateId.endsWith(templateSuffix) ||
        c.templateId.includes(templateSuffix)
    );
    return match?.contractId ?? created[0]?.contractId ?? null;
  }

  function projectFromState(state: TrackedState): CantonWorkflowProjection {
    return {
      provvypayAgreementId: state.sharedTerms.provvypayAgreementId,
      stage: state.stage,
      revision: state.sharedTerms.revision,
      title: state.sharedTerms.title,
      currency: state.sharedTerms.currency,
      summary: state.sharedTerms.summary,
      platformParty: state.platform,
      platformDisplayName: 'Provvypay Platform',
      requiredParticipants: state.requiredParticipants,
      acceptedParties: [...state.accepted],
      pendingRoles: pendingRoles(state.requiredParticipants, state.accepted),
      proposalContractId: state.proposalContractId,
      agreementContractId: state.agreementContractId,
      settlementReadyContractId: state.settlementReadyContractId,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    mode: 'localnet',

    async validateConnection() {
      try {
        const baseUrl = config.jsonApiBaseUrl.replace(/\/$/, '');
        const res = await fetchFn(`${baseUrl}/v2/version`, {
          headers: { Authorization: `Bearer ${config.authToken}` },
        });
        if (!res.ok) {
          return {
            connected: false,
            error: `JSON API not reachable (${res.status}) at ${baseUrl}`,
          };
        }
        return { connected: true, error: null };
      } catch (err) {
        return {
          connected: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async createProposal(input) {
      const tid = templateId(config, 'CommercialAgreementProposal');
      const tree = await submitAndWait(input.platform, {
        commands: [
          {
            CreateCommand: {
              templateId: tid,
              createArguments: {
                platform: input.platform,
                requiredParticipants: input.requiredParticipants.map((p) => ({
                  party: p.party,
                  role: p.role,
                })),
                accepted: [],
                sharedTerms: {
                  provvypayAgreementId: input.sharedTerms.provvypayAgreementId,
                  revision: input.sharedTerms.revision,
                  title: input.sharedTerms.title,
                  currency: input.sharedTerms.currency,
                  summary: input.sharedTerms.summary,
                },
              },
            },
          },
        ],
        workflowId: 'sca-create-proposal',
        applicationId: config.applicationId,
        commandId: commandId('sca-create'),
        actAs: [input.platform],
        readAs: [input.platform],
        deduplicationPeriod: { Empty: {} },
        submissionId: commandId('sub'),
        disclosedContracts: [],
        domainId: '',
        packageIdSelectionPreference: [],
      });

      const proposalContractId =
        findCreated(tree, 'CommercialAgreementProposal') ??
        (() => {
          throw new Error('Create Proposal succeeded but no contract id in tree');
        })();

      byAgreement.set(input.sharedTerms.provvypayAgreementId, {
        platform: input.platform,
        requiredParticipants: input.requiredParticipants,
        sharedTerms: input.sharedTerms,
        accepted: [],
        proposalContractId,
        agreementContractId: null,
        settlementReadyContractId: null,
        stage: 'Proposed',
      });

      await emit(
        createCommercialNetworkEvent({
          kind: 'AgreementCreated',
          agreementId: input.sharedTerms.provvypayAgreementId,
          occurredAt: new Date().toISOString(),
          name: input.sharedTerms.title,
          providerId: 'canton',
          payload: {
            stage: 'Proposed',
            contractId: proposalContractId,
            platformDisplayName: 'Provvypay Platform',
            mode: 'localnet',
          },
        })
      );

      return { proposalContractId };
    },

    async accept({ proposalContractId, actor }) {
      const state = [...byAgreement.values()].find(
        (s) => s.proposalContractId === proposalContractId
      );
      if (!state) {
        throw new Error(`Unknown proposal contract ${proposalContractId}`);
      }

      const tid = templateId(config, 'CommercialAgreementProposal');
      const tree = await submitAndWait(actor, {
        commands: [
          {
            ExerciseCommand: {
              templateId: tid,
              contractId: proposalContractId,
              choice: 'Accept',
              choiceArgument: { actor },
            },
          },
        ],
        workflowId: 'sca-accept',
        applicationId: config.applicationId,
        commandId: commandId('sca-accept'),
        actAs: [actor],
        readAs: [actor],
        deduplicationPeriod: { Empty: {} },
        submissionId: commandId('sub'),
        disclosedContracts: [],
        domainId: '',
        packageIdSelectionPreference: [],
      });

      const nextAccepted = [actor, ...state.accepted];
      state.accepted = nextAccepted;

      if (allRequiredAccepted(state.requiredParticipants, nextAccepted)) {
        const agreementContractId =
          findCreated(tree, 'CommercialAgreement') ??
          (() => {
            throw new Error('Bound Accept missing CommercialAgreement create');
          })();
        state.proposalContractId = null;
        state.agreementContractId = agreementContractId;
        state.stage = 'Bound';

        await emit(
          createCommercialNetworkEvent({
            kind: 'ParticipantApproved',
            agreementId: state.sharedTerms.provvypayAgreementId,
            participantId: actor,
            occurredAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
            providerId: 'canton',
            metadata: { stage: 'Bound', mode: 'localnet', agreementContractId },
          })
        );
        await emit(
          createCommercialNetworkEvent({
            kind: 'AgreementUpdated',
            agreementId: state.sharedTerms.provvypayAgreementId,
            occurredAt: new Date().toISOString(),
            name: state.sharedTerms.title,
            status: 'Bound',
            providerId: 'canton',
          })
        );

        return { kind: 'Bound', agreementContractId };
      }

      const nextProposalId =
        findCreated(tree, 'CommercialAgreementProposal') ??
        (() => {
          throw new Error('StillOpen Accept missing next proposal create');
        })();
      state.proposalContractId = nextProposalId;
      state.stage = 'PartiallyBound';

      await emit(
        createCommercialNetworkEvent({
          kind: 'ParticipantApproved',
          agreementId: state.sharedTerms.provvypayAgreementId,
          participantId: actor,
          occurredAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
          providerId: 'canton',
          metadata: {
            stage: 'PartiallyBound',
            mode: 'localnet',
            proposalContractId: nextProposalId,
            pendingRoles: pendingRoles(state.requiredParticipants, nextAccepted),
          },
        })
      );

      return { kind: 'StillOpen', proposalContractId: nextProposalId };
    },

    async reject({ proposalContractId, actor }) {
      const state = [...byAgreement.values()].find(
        (s) => s.proposalContractId === proposalContractId
      );
      const tid = templateId(config, 'CommercialAgreementProposal');
      await submitAndWait(actor, {
        commands: [
          {
            ExerciseCommand: {
              templateId: tid,
              contractId: proposalContractId,
              choice: 'Reject',
              choiceArgument: { actor },
            },
          },
        ],
        workflowId: 'sca-reject',
        applicationId: config.applicationId,
        commandId: commandId('sca-reject'),
        actAs: [actor],
        readAs: [actor],
        deduplicationPeriod: { Empty: {} },
        submissionId: commandId('sub'),
        disclosedContracts: [],
        domainId: '',
        packageIdSelectionPreference: [],
      });
      if (state) {
        state.proposalContractId = null;
        state.stage = 'Rejected';
        await emit(
          createCommercialNetworkEvent({
            kind: 'AgreementUpdated',
            agreementId: state.sharedTerms.provvypayAgreementId,
            occurredAt: new Date().toISOString(),
            name: state.sharedTerms.title,
            status: 'Rejected',
            providerId: 'canton',
            metadata: { mode: 'localnet', rejectedBy: actor },
          })
        );
      }
    },

    async withdraw({ proposalContractId, platform }) {
      const state = [...byAgreement.values()].find(
        (s) => s.proposalContractId === proposalContractId
      );
      const tid = templateId(config, 'CommercialAgreementProposal');
      await submitAndWait(platform, {
        commands: [
          {
            ExerciseCommand: {
              templateId: tid,
              contractId: proposalContractId,
              choice: 'Withdraw',
              choiceArgument: {},
            },
          },
        ],
        workflowId: 'sca-withdraw',
        applicationId: config.applicationId,
        commandId: commandId('sca-withdraw'),
        actAs: [platform],
        readAs: [platform],
        deduplicationPeriod: { Empty: {} },
        submissionId: commandId('sub'),
        disclosedContracts: [],
        domainId: '',
        packageIdSelectionPreference: [],
      });
      if (state) {
        state.proposalContractId = null;
        state.stage = 'Withdrawn';
        await emit(
          createCommercialNetworkEvent({
            kind: 'AgreementUpdated',
            agreementId: state.sharedTerms.provvypayAgreementId,
            occurredAt: new Date().toISOString(),
            name: state.sharedTerms.title,
            status: 'Withdrawn',
            providerId: 'canton',
            metadata: { mode: 'localnet' },
          })
        );
      }
    },

    async declareSettlementReady({ agreementContractId, platform }) {
      const state = [...byAgreement.values()].find(
        (s) => s.agreementContractId === agreementContractId
      );
      if (!state) {
        throw new Error(`Unknown agreement contract ${agreementContractId}`);
      }
      const tid = templateId(config, 'CommercialAgreement');
      const tree = await submitAndWait(platform, {
        commands: [
          {
            ExerciseCommand: {
              templateId: tid,
              contractId: agreementContractId,
              choice: 'DeclareSettlementReady',
              choiceArgument: {},
            },
          },
        ],
        workflowId: 'sca-settlement-ready',
        applicationId: config.applicationId,
        commandId: commandId('sca-ready'),
        actAs: [platform],
        readAs: [platform],
        deduplicationPeriod: { Empty: {} },
        submissionId: commandId('sub'),
        disclosedContracts: [],
        domainId: '',
        packageIdSelectionPreference: [],
      });

      const settlementReadyContractId =
        findCreated(tree, 'SettlementReady') ??
        (() => {
          throw new Error('DeclareSettlementReady missing SettlementReady create');
        })();

      state.settlementReadyContractId = settlementReadyContractId;
      state.stage = 'SettlementReady';

      await emit(
        createCommercialNetworkEvent({
          kind: 'SettlementReady',
          agreementId: state.sharedTerms.provvypayAgreementId,
          settlementId: settlementReadyContractId,
          occurredAt: new Date().toISOString(),
          providerId: 'canton',
          metadata: {
            platformDisplayName: 'Provvypay Platform',
            stage: 'SettlementReady',
            mode: 'localnet',
          },
        })
      );

      return { settlementReadyContractId };
    },

    async getActiveProposal(id) {
      const state = byAgreement.get(id);
      if (!state?.proposalContractId) return null;
      const contract: CommercialAgreementProposalContract = {
        templateId: 'CommercialAgreementProposal',
        contractId: state.proposalContractId,
        platform: state.platform,
        requiredParticipants: state.requiredParticipants,
        accepted: state.accepted,
        sharedTerms: state.sharedTerms,
        active: true,
      };
      return contract;
    },

    async getActiveAgreement(id) {
      const state = byAgreement.get(id);
      if (!state?.agreementContractId || state.stage === 'Proposed') return null;
      if (state.stage === 'Rejected' || state.stage === 'Withdrawn') return null;
      const contract: CommercialAgreementContract = {
        templateId: 'CommercialAgreement',
        contractId: state.agreementContractId,
        platform: state.platform,
        requiredParticipants: state.requiredParticipants,
        sharedTerms: state.sharedTerms,
        active: true,
      };
      return contract;
    },

    async getSettlementReady(id) {
      const state = byAgreement.get(id);
      if (!state?.settlementReadyContractId) return null;
      const contract: SettlementReadyContract = {
        templateId: 'SettlementReady',
        contractId: state.settlementReadyContractId,
        platform: state.platform,
        requiredParticipants: state.requiredParticipants,
        sharedTerms: state.sharedTerms,
        agreementProvvypayId: state.sharedTerms.provvypayAgreementId,
        active: true,
      };
      return contract;
    },

    async project(id) {
      const state = byAgreement.get(id);
      if (!state) return null;
      return projectFromState(state);
    },

    hydrateAgreement(state) {
      byAgreement.set(state.provvypayAgreementId, {
        platform: state.platformParty,
        requiredParticipants: state.requiredParticipants,
        sharedTerms: state.sharedTerms,
        accepted: [...state.acceptedParties],
        proposalContractId: state.proposalContractId,
        agreementContractId: state.agreementContractId,
        settlementReadyContractId: state.settlementReadyContractId,
        stage: state.stage,
      });
    },

    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}

/** Load LocalNet adapter config from environment (Quickstart LocalNet). */
export function localNetConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): LocalNetAdapterConfig {
  const jsonApiBaseUrl =
    env.CANTON_JSON_API_URL ?? 'http://localhost:3975';
  const authToken = env.CANTON_AUTH_TOKEN ?? '';
  if (!authToken) {
    throw new Error(
      'CANTON_AUTH_TOKEN is required for localnet mode (see docs/hackcanton-localnet.md)'
    );
  }
  return {
    jsonApiBaseUrl,
    authToken,
    packageName:
      env.CANTON_PACKAGE_NAME ?? 'provvypay-shared-commercial-agreement',
    moduleName:
      env.CANTON_MODULE_NAME ?? 'SharedCommercialAgreement.Workflow',
    applicationId: env.CANTON_APPLICATION_ID ?? 'provvypay-sca',
    partyJsonApiBaseUrl: env.CANTON_PARTY_JSON_API_URLS
      ? (JSON.parse(env.CANTON_PARTY_JSON_API_URLS) as Record<string, string>)
      : undefined,
    partyAuthToken: env.CANTON_PARTY_AUTH_TOKENS
      ? (JSON.parse(env.CANTON_PARTY_AUTH_TOKENS) as Record<string, string>)
      : undefined,
  };
}
