/**
 * Persisted Canton workflow state stored in deal_payload JSON.
 *
 * Survives serverless requests — contract IDs and acceptance progress are
 * re-hydrated into the ledger adapter before each exercise command.
 */

import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type {
  CantonWorkflowStage,
  RequiredParticipant,
  SharedTerms,
} from '@/lib/commercial-network/providers/canton/workflow-types';

export type CantonWorkflowPersistedState = {
  provvypayAgreementId: string;
  stage: CantonWorkflowStage;
  platformParty: string;
  requiredParticipants: RequiredParticipant[];
  acceptedParties: string[];
  sharedTerms: SharedTerms;
  proposalContractId: string | null;
  agreementContractId: string | null;
  settlementReadyContractId: string | null;
  ledgerMode?: string;
  updatedAt?: string;
  /** Last ledger command id for audit. */
  lastCommandId?: string;
  /** Last ledger transaction update id when available (LocalNet). */
  lastUpdateId?: string;
};

export const CANTON_WORKFLOW_DEAL_PAYLOAD_KEY = 'cantonWorkflow' as const;

type RecentDealWithCantonPayload = RecentDeal &
  Partial<Record<typeof CANTON_WORKFLOW_DEAL_PAYLOAD_KEY, unknown>>;

export function readCantonWorkflowFromDeal(
  deal: RecentDeal
): CantonWorkflowPersistedState | null {
  const raw = (deal as RecentDealWithCantonPayload)[CANTON_WORKFLOW_DEAL_PAYLOAD_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as Partial<CantonWorkflowPersistedState>;
  if (!state.provvypayAgreementId || !state.stage || !state.platformParty) {
    return null;
  }
  return {
    provvypayAgreementId: state.provvypayAgreementId,
    stage: state.stage,
    platformParty: state.platformParty,
    requiredParticipants: state.requiredParticipants ?? [],
    acceptedParties: state.acceptedParties ?? [],
    sharedTerms: state.sharedTerms ?? {
      provvypayAgreementId: state.provvypayAgreementId,
      revision: 0,
      title: deal.dealName,
      currency: deal.projectValueCurrency ?? 'AUD',
      summary: deal.dealName,
    },
    proposalContractId: state.proposalContractId ?? null,
    agreementContractId: state.agreementContractId ?? null,
    settlementReadyContractId: state.settlementReadyContractId ?? null,
    ledgerMode: state.ledgerMode,
    updatedAt: state.updatedAt,
    lastCommandId: state.lastCommandId,
    lastUpdateId: state.lastUpdateId,
  };
}

export function mergeCantonWorkflowIntoDeal(
  deal: RecentDeal,
  workflow: CantonWorkflowPersistedState
): RecentDeal {
  return {
    ...deal,
    [CANTON_WORKFLOW_DEAL_PAYLOAD_KEY]: workflow,
  } as RecentDeal;
}

export function cantonWorkflowFromProjection(input: {
  projection: {
    provvypayAgreementId: string;
    stage: CantonWorkflowStage;
    platformParty: string;
    requiredParticipants: RequiredParticipant[];
    acceptedParties: string[];
    revision: number;
    title: string;
    currency: string;
    summary: string;
    proposalContractId: string | null;
    agreementContractId: string | null;
    settlementReadyContractId: string | null;
    updatedAt: string;
  };
  ledgerMode: string;
  lastCommandId?: string;
  lastUpdateId?: string;
}): CantonWorkflowPersistedState {
  const { projection, ledgerMode, lastCommandId, lastUpdateId } = input;
  return {
    provvypayAgreementId: projection.provvypayAgreementId,
    stage: projection.stage,
    platformParty: projection.platformParty,
    requiredParticipants: projection.requiredParticipants,
    acceptedParties: projection.acceptedParties,
    sharedTerms: {
      provvypayAgreementId: projection.provvypayAgreementId,
      revision: projection.revision,
      title: projection.title,
      currency: projection.currency,
      summary: projection.summary,
    },
    proposalContractId: projection.proposalContractId,
    agreementContractId: projection.agreementContractId,
    settlementReadyContractId: projection.settlementReadyContractId,
    ledgerMode,
    updatedAt: projection.updatedAt,
    lastCommandId,
    lastUpdateId,
  };
}
