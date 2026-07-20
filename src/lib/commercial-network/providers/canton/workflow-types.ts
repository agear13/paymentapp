/**
 * TypeScript mirror of SharedCommercialAgreement.Workflow Daml types.
 *
 * Source of truth for ledger semantics: canton/cn-quickstart/quickstart/daml/
 * shared-commercial-agreement/daml/SharedCommercialAgreement/Workflow.daml
 *
 * UI narration: "Provvypay Platform" / "Platform"
 * Daml field: platform (AppProvider analogue)
 */

export type RequiredParticipant = {
  /** Ledger party id */
  party: string;
  /** Role label — Venue | Promoter | Artist (UI may say DJ for Artist) */
  role: string;
};

export type SharedTerms = {
  provvypayAgreementId: string;
  revision: number;
  title: string;
  currency: string;
  summary: string;
};

export type ProposalAcceptResult =
  | { kind: 'StillOpen'; proposalContractId: string }
  | { kind: 'Bound'; agreementContractId: string };

export type CommercialAgreementProposalContract = {
  templateId: 'CommercialAgreementProposal';
  contractId: string;
  platform: string;
  requiredParticipants: RequiredParticipant[];
  accepted: string[];
  sharedTerms: SharedTerms;
  active: boolean;
};

export type CommercialAgreementContract = {
  templateId: 'CommercialAgreement';
  contractId: string;
  platform: string;
  requiredParticipants: RequiredParticipant[];
  sharedTerms: SharedTerms;
  active: boolean;
};

export type SettlementReadyContract = {
  templateId: 'SettlementReady';
  contractId: string;
  platform: string;
  requiredParticipants: RequiredParticipant[];
  sharedTerms: SharedTerms;
  agreementProvvypayId: string;
  active: boolean;
};

export type CantonWorkflowContract =
  | CommercialAgreementProposalContract
  | CommercialAgreementContract
  | SettlementReadyContract;

/** Projected workflow stage for Provvypay Commercial Domain / Ops Workspace. */
export type CantonWorkflowStage =
  | 'Proposed'
  | 'PartiallyBound'
  | 'Bound'
  | 'SettlementReady'
  | 'Rejected'
  | 'Withdrawn';

export type CantonWorkflowProjection = {
  provvypayAgreementId: string;
  stage: CantonWorkflowStage;
  revision: number;
  title: string;
  currency: string;
  summary: string;
  platformParty: string;
  /** UI label for platform party */
  platformDisplayName: 'Provvypay Platform';
  requiredParticipants: RequiredParticipant[];
  acceptedParties: string[];
  pendingRoles: string[];
  proposalContractId: string | null;
  agreementContractId: string | null;
  settlementReadyContractId: string | null;
  updatedAt: string;
};

export function allRequiredAccepted(
  required: RequiredParticipant[],
  accepted: string[]
): boolean {
  return required.every((r) => accepted.includes(r.party));
}

export function pendingRoles(
  required: RequiredParticipant[],
  accepted: string[]
): string[] {
  return required.filter((r) => !accepted.includes(r.party)).map((r) => r.role);
}
