/**
 * Mediated adapter between Commercial Network Layer and Canton.
 *
 * Responsibilities only:
 *   - create CommercialAgreementProposal
 *   - exercise Accept / Reject / Withdraw
 *   - exercise DeclareSettlementReady
 *   - subscribe to ledger events (normalized to CommercialNetworkEvent)
 *
 * No business logic. No UI. No forecasting / automation / accounting.
 */

import type { CommercialNetworkEvent } from '@/lib/commercial-network/events';
import type { Unsubscribe } from '@/lib/commercial-network/types';
import type {
  CantonWorkflowProjection,
  CommercialAgreementContract,
  CommercialAgreementProposalContract,
  ProposalAcceptResult,
  RequiredParticipant,
  SettlementReadyContract,
  SharedTerms,
} from '@/lib/commercial-network/providers/canton/workflow-types';
import type { CantonLedgerRuntime } from '@/lib/commercial-network/providers/canton/canton-ledger-runtime';

export type CantonLedgerMode = 'simulated' | 'localnet';

export type CantonLedgerEventHandler = (
  event: CommercialNetworkEvent
) => void | Promise<void>;

export type CreateProposalInput = {
  platform: string;
  requiredParticipants: RequiredParticipant[];
  sharedTerms: SharedTerms;
};

export type CantonLedgerAdapter = {
  readonly mode: CantonLedgerMode;

  validateConnection(): Promise<{ connected: boolean; error: string | null }>;

  createProposal(
    input: CreateProposalInput
  ): Promise<{ proposalContractId: string }>;

  accept(input: {
    proposalContractId: string;
    actor: string;
  }): Promise<ProposalAcceptResult>;

  reject(input: { proposalContractId: string; actor: string }): Promise<void>;

  withdraw(input: {
    proposalContractId: string;
    platform: string;
  }): Promise<void>;

  declareSettlementReady(input: {
    agreementContractId: string;
    platform: string;
  }): Promise<{ settlementReadyContractId: string }>;

  getActiveProposal(
    provvypayAgreementId: string
  ): Promise<CommercialAgreementProposalContract | null>;

  getActiveAgreement(
    provvypayAgreementId: string
  ): Promise<CommercialAgreementContract | null>;

  getSettlementReady(
    provvypayAgreementId: string
  ): Promise<SettlementReadyContract | null>;

  project(provvypayAgreementId: string): Promise<CantonWorkflowProjection | null>;

  subscribe(handler: CantonLedgerEventHandler): Unsubscribe;

  /** Available only for the simulated test double. */
  getSimulatedRuntime?(): CantonLedgerRuntime | undefined;
};

export type LocalNetAdapterConfig = {
  /** App Provider JSON API base, e.g. http://localhost:3975 */
  jsonApiBaseUrl: string;
  /** Bearer token (OAuth2 or Quickstart static token). */
  authToken: string;
  /** Package name as uploaded / referenced by #name syntax */
  packageName: string;
  /** Daml module */
  moduleName: string;
  applicationId: string;
  /** Optional party → JSON API base when counterparties use another participant */
  partyJsonApiBaseUrl?: Record<string, string>;
  /** Optional party → auth token override */
  partyAuthToken?: Record<string, string>;
  fetchImpl?: typeof fetch;
};
