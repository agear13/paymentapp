import type { ExtractionReadinessAssessment } from './extraction-readiness';
import type { AgreementType } from './classify-agreement-type';

export type CommercialStructureMetrics = {
  agreementType: AgreementType | null;
  agreementTypeLabel: string;
  agreementOwner: string | null;
  participantCount: number;
  deliverableCount: number;
  operationalObligationCount: number;
  compensationTermCount: number;
  settlementEventCount: number;
  revenueShareAgreementCount: number;
  fixedPaymentAgreementCount: number;
  hybridCompensationCount: number;
  milestonePaymentCount: number;
  instalmentPaymentCount: number;
  conditionalPaymentCount: number;
  estimatedFixedCommitment: number;
  variableRevenueBases: string[];
  settlementBlockers: string[];
};

export type ParticipantCommercialCard = {
  participantId: string;
  name: string;
  role: string;
  serviceCategory: string | null;
  deliverables: string[];
  operationalObligations: string[];
  compensationTerms: string[];
  settlementSchedule: string[];
  dependencies: string[];
};

export type CommercialStructureOverview = {
  bulletPoints: string[];
};

export type UnifiedSettlementScheduleEntry = {
  participantId: string;
  participantName: string;
  compensationSummary: string[];
  settlementTriggers: string[];
};

export type CommercialGraphSnapshot = {
  schemaVersion: 'v5';
  agreementOwner: string | null;
  agreementOwnerResponsibilities: string[];
  commercialStructure: CommercialStructureMetrics;
  commercialSummary: string;
  commercialStructureOverview: CommercialStructureOverview;
  participantCards: ParticipantCommercialCard[];
  settlementSchedule: UnifiedSettlementScheduleEntry[];
  operationalObligations: { participant: string; items: string[] }[];
  compensationTerms: { participant: string; items: string[] }[];
  readinessAssessment?: ExtractionReadinessAssessment;
};
